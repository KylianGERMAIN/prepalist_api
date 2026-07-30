import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { Meal } from '../meals/entities/meal.entity';
import { ShoppingListItem } from '../shopping-list/entities/shopping-list-item.entity';
import { UsersService } from '../users/users.service';
import { UpdateSlotDto } from './dto/update-slot.dto';
import { MealSlot, PlanSlot } from './entities/plan-slot.entity';
import { Plan } from './entities/plan.entity';
import { lastWeekdayOnOrBefore, today } from './plan-dates';

const MS_PER_DAY = 86_400_000;
const FRESHNESS_CAP_DAYS = 14; // au-delà, fraîcheur maximale
const LEFTOVER_PROBABILITY = 0.5; // dîner J -> déjeuner J+1
const DEFAULT_DAY_COUNT = 7;

@Injectable()
export class PlanService {
  constructor(
    @InjectRepository(Plan) private readonly plans: Repository<Plan>,
    @InjectRepository(PlanSlot)
    private readonly slots: Repository<PlanSlot>,
    @InjectRepository(Meal) private readonly meals: Repository<Meal>,
    @InjectRepository(ShoppingListItem)
    private readonly items: Repository<ShoppingListItem>,
    private readonly users: UsersService,
  ) {}

  /** Créneaux vides d'un plan : `dayCount` jours × (midi, soir). */
  private buildSlots(dayCount: number): PlanSlot[] {
    const slots: PlanSlot[] = [];
    for (let dayIndex = 0; dayIndex < dayCount; dayIndex++) {
      for (const slot of [MealSlot.LUNCH, MealSlot.DINNER]) {
        slots.push(
          this.slots.create({ dayIndex, slot, servings: 1, mealId: null }),
        );
      }
    }
    return slots;
  }

  /**
   * Plan courant de l'utilisateur, créé vide au premier accès. Il n'y a jamais
   * qu'un plan par compte : aucune date n'est nécessaire pour le retrouver.
   */
  async ensureForUser(userId: string): Promise<Plan> {
    const existing = await this.plans.findOne({ where: { userId } });
    if (existing) {
      return existing;
    }

    const { shoppingDay } = await this.users.findById(userId);
    const plan = this.plans.create({
      userId,
      startDate: lastWeekdayOnOrBefore(today(), shoppingDay),
      dayCount: DEFAULT_DAY_COUNT,
      slots: this.buildSlots(DEFAULT_DAY_COUNT),
    });
    return this.plans.save(plan);
  }

  /**
   * Remplit les créneaux **vides** par tirage pondéré (favori + fraîcheur −
   * doublon) ; les créneaux déjà assignés (manuellement) sont préservés.
   * Règle meal-prep : le dîner du jour J peut alimenter le déjeuner du jour J+1.
   */
  async generate(userId: string): Promise<Plan> {
    const plan = await this.ensureForUser(userId);
    const candidates = await this.meals.find();
    if (candidates.length === 0) {
      throw new BadRequestException('Aucune recette pour générer le plan');
    }

    const placed = new Map<string, number>();
    const dinnerByDay = new Map<number, string>();
    const ordered = [...plan.slots].sort(this.compareSlots);
    const changed: PlanSlot[] = [];

    for (const slot of ordered) {
      // Préserve une assignation existante et la prend en compte (doublons + restes).
      if (slot.mealId) {
        placed.set(slot.mealId, (placed.get(slot.mealId) ?? 0) + 1);
        if (slot.slot === MealSlot.DINNER) {
          dinnerByDay.set(slot.dayIndex, slot.mealId);
        }
        continue;
      }

      const prevDinner = dinnerByDay.get(slot.dayIndex - 1);
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
        dinnerByDay.set(slot.dayIndex, chosen);
      }
      changed.push(slot);
    }

    // Persiste uniquement la colonne FK des créneaux modifiés (sans l'objet
    // relation `meal` chargé en eager, qui sinon écraserait le mealId au save).
    if (changed.length > 0) {
      await this.slots.save(
        changed.map((s) => ({
          id: s.id,
          mealId: s.mealId,
        })) as DeepPartial<PlanSlot>[],
      );
    }
    return this.ensureForUser(userId);
  }

  /** Met à jour un créneau (repas / portions) du plan de l'utilisateur. */
  async updateSlot(
    userId: string,
    slotId: string,
    dto: UpdateSlotDto,
  ): Promise<Plan> {
    const plan = await this.ensureForUser(userId);
    const slot = plan.slots.find((s) => s.id === slotId);
    if (!slot) {
      throw new NotFoundException('Créneau introuvable');
    }

    const patch: DeepPartial<PlanSlot> = {};
    if (dto.mealId !== undefined) {
      if (dto.mealId !== null) {
        const meal = await this.meals.findOne({ where: { id: dto.mealId } });
        if (!meal) {
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
    return this.ensureForUser(userId);
  }

  /**
   * Vide le plan : tous les créneaux repassent à vide et la liste de courses est
   * purgée. Destructif et sans retour arrière — l'archivage viendra plus tard.
   *
   * Purge la liste ici plutôt que de laisser `sync` s'en charger : `sync` est
   * insert-only par conception, il ne supprime jamais un item existant.
   */
  async clearSlots(userId: string): Promise<Plan> {
    const plan = await this.ensureForUser(userId);
    await this.slots.update({ planId: plan.id }, { mealId: null });
    await this.items.delete({ planId: plan.id });
    return this.ensureForUser(userId);
  }

  /** Ordonne les créneaux : jour croissant, puis midi avant soir. */
  private compareSlots = (a: PlanSlot, b: PlanSlot): number => {
    if (a.dayIndex !== b.dayIndex) {
      return a.dayIndex - b.dayIndex;
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
      // `< 0` (et non `<= 0`) pour qu'un poids nul ne capture jamais le tirage.
      if (r < 0) {
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
    // `new Date(...)` défensif : le driver peut livrer une string sur timestamptz.
    const days = (Date.now() - new Date(lastCookedAt).getTime()) / MS_PER_DAY;
    return Math.min(days / FRESHNESS_CAP_DAYS, 1) * 2;
  }
}
