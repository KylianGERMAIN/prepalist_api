import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { Meal } from '../meals/entities/meal.entity';
import { CreateWeekDto } from './dto/create-week.dto';
import { UpdateSlotDto } from './dto/update-slot.dto';
import { MealSlot, WeekSlot } from './entities/week-slot.entity';
import { Week } from './entities/week.entity';
import { addDays, startOfWeek } from './week-dates';

const DAYS_IN_WEEK = 7;
const MS_PER_DAY = 86_400_000;
const FRESHNESS_CAP_DAYS = 14; // au-delà, fraîcheur maximale
const LEFTOVER_PROBABILITY = 0.5; // dîner J -> déjeuner J+1

@Injectable()
export class WeeksService {
  constructor(
    @InjectRepository(Week) private readonly weeks: Repository<Week>,
    @InjectRepository(WeekSlot)
    private readonly slots: Repository<WeekSlot>,
    @InjectRepository(Meal) private readonly meals: Repository<Meal>,
  ) {}

  /** Crée une semaine (lundi -> dimanche) avec 14 créneaux vides. */
  async create(userId: string, dto: CreateWeekDto): Promise<Week> {
    const start = startOfWeek(
      dto.startDate ? new Date(dto.startDate) : new Date(),
    );
    const existing = await this.weeks.findOne({
      where: { userId, startDate: start },
    });
    if (existing) {
      throw new ConflictException('Une semaine existe déjà pour cette période');
    }

    const slots: WeekSlot[] = [];
    for (let d = 0; d < DAYS_IN_WEEK; d++) {
      const date = addDays(start, d);
      for (const slot of [MealSlot.LUNCH, MealSlot.DINNER]) {
        slots.push(
          this.slots.create({ date, slot, servings: 1, mealId: null }),
        );
      }
    }

    const week = this.weeks.create({ userId, startDate: start, slots });
    return this.weeks.save(week);
  }

  /** Semaine contenant aujourd'hui (lundi courant) ou 404. */
  async findCurrent(userId: string): Promise<Week> {
    const start = startOfWeek(new Date());
    const week = await this.weeks.findOne({
      where: { userId, startDate: start },
    });
    if (!week) {
      throw new NotFoundException('Aucune semaine pour la période courante');
    }
    return week;
  }

  /** Récupère une semaine de l'utilisateur (créneaux chargés) ou 404. */
  async findOne(userId: string, id: string): Promise<Week> {
    const week = await this.weeks.findOne({ where: { id } });
    if (!week || week.userId !== userId) {
      throw new NotFoundException('Semaine introuvable');
    }
    return week;
  }

  /**
   * Remplit les créneaux par tirage pondéré (favori + fraîcheur − doublon).
   * Règle meal-prep : le dîner du jour J peut alimenter le déjeuner du jour J+1.
   */
  async generate(userId: string, id: string): Promise<Week> {
    const week = await this.findOne(userId, id);
    const candidates = await this.meals.find({ where: { userId } });
    if (candidates.length === 0) {
      throw new BadRequestException('Aucune recette pour générer la semaine');
    }

    const placed = new Map<string, number>();
    const dinnerByDate = new Map<string, string>();
    const ordered = [...week.slots].sort(this.compareSlots);

    for (const slot of ordered) {
      const prevDinner = dinnerByDate.get(addDays(slot.date, -1));
      const useLeftover =
        slot.slot === MealSlot.LUNCH &&
        prevDinner !== undefined &&
        Math.random() < LEFTOVER_PROBABILITY;

      const chosen = useLeftover
        ? prevDinner
        : this.pickWeighted(candidates, placed);

      slot.mealId = chosen;
      placed.set(chosen, (placed.get(chosen) ?? 0) + 1);
      if (slot.slot === MealSlot.DINNER) {
        dinnerByDate.set(slot.date, chosen);
      }
    }

    // Persiste uniquement la colonne FK (sans l'objet relation `meal` chargé en
    // eager, qui sinon écraserait le mealId lors du save).
    await this.slots.save(
      ordered.map((s) => ({
        id: s.id,
        mealId: s.mealId,
      })) as DeepPartial<WeekSlot>[],
    );
    return this.findOne(userId, id);
  }

  /** Met à jour un créneau (repas / portions) après contrôle d'ownership. */
  async updateSlot(
    userId: string,
    weekId: string,
    slotId: string,
    dto: UpdateSlotDto,
  ): Promise<Week> {
    const week = await this.findOne(userId, weekId);
    const slot = week.slots.find((s) => s.id === slotId);
    if (!slot) {
      throw new NotFoundException('Créneau introuvable');
    }

    const patch: DeepPartial<WeekSlot> = {};
    if (dto.mealId !== undefined) {
      if (dto.mealId !== null) {
        const meal = await this.meals.findOne({ where: { id: dto.mealId } });
        if (!meal || meal.userId !== userId) {
          throw new BadRequestException('Repas introuvable');
        }
      }
      patch.mealId = dto.mealId;
    }
    if (dto.servings !== undefined) {
      patch.servings = dto.servings;
    }

    // update() écrit les colonnes directement (évite le conflit FK/relation).
    await this.slots.update(slotId, patch);
    return this.findOne(userId, weekId);
  }

  /** Ordonne les créneaux : date croissante, puis midi avant soir. */
  private compareSlots = (a: WeekSlot, b: WeekSlot): number => {
    if (a.date !== b.date) {
      return a.date < b.date ? -1 : 1;
    }
    return a.slot === b.slot ? 0 : a.slot === MealSlot.LUNCH ? -1 : 1;
  };

  /** Tirage pondéré : favori + note + fraîcheur, fortement pénalisé si déjà placé. */
  private pickWeighted(meals: Meal[], placed: Map<string, number>): string {
    const weights = meals.map(
      (meal) => this.baseScore(meal) * Math.pow(0.2, placed.get(meal.id) ?? 0),
    );
    const total = weights.reduce((sum, w) => sum + w, 0);
    let r = Math.random() * total;
    for (let i = 0; i < meals.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        return meals[i].id;
      }
    }
    return meals[meals.length - 1].id;
  }

  /** Score de base d'une recette (toujours > 0). */
  private baseScore(meal: Meal): number {
    const favorite = meal.isFavorite ? 2 : 0;
    const rating = ((meal.rating ?? 3) / 5) * 2; // 0.4 … 2
    const freshness = this.freshnessScore(meal.lastCookedAt); // 0 … 2
    return 1 + favorite + rating + freshness;
  }

  /** Plus la recette n'a pas été cuisinée depuis longtemps, plus elle remonte. */
  private freshnessScore(lastCookedAt: Date | null): number {
    if (!lastCookedAt) {
      return 2; // jamais cuisinée -> priorité max
    }
    const days = (Date.now() - lastCookedAt.getTime()) / MS_PER_DAY;
    return Math.min(days / FRESHNESS_CAP_DAYS, 1) * 2;
  }
}
