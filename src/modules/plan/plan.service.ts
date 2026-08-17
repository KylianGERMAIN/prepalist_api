import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { isUniqueViolation } from '../../common/postgres-errors';
import { Meal } from '../meals/entities/meal.entity';
import {
  ShoppingItemSource,
  ShoppingListItem,
} from '../shopping-list/entities/shopping-list-item.entity';
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
    private readonly users: UsersService,
  ) {}

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

  /** Un seul plan par compte : aucune date n'entre dans sa recherche. */
  async ensureForUser(userId: string): Promise<Plan> {
    const existing = await this.plans.findOne({ where: { userId } });
    if (existing) {
      return existing;
    }

    const plan = this.plans.create({
      userId,
      startDate: await this.anchorFor(userId),
      dayCount: DEFAULT_DAY_COUNT,
      slots: this.buildSlots(DEFAULT_DAY_COUNT),
    });

    try {
      return await this.plans.save(plan);
    } catch (err) {
      // Course au premier accès : deux requêtes passent le findOne avant l'insert,
      // l'unicité (user_id) fait échouer la seconde.
      if (isUniqueViolation(err)) {
        const winner = await this.plans.findOne({ where: { userId } });
        if (winner) {
          return winner;
        }
        // Conflit mais plus rien à relire : le compte a disparu entre les deux (CASCADE).
        throw new ConflictException('Plan indisponible, réessaie');
      }
      throw err;
    }
  }

  private async anchorFor(userId: string): Promise<string> {
    const { shoppingDay } = await this.users.findById(userId);
    return lastWeekdayOnOrBefore(today(), shoppingDay);
  }

  /** Ne remplit que les créneaux vides : une assignation manuelle n'est jamais écrasée. */
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

    // La seule colonne FK, sans la relation `meal` chargée en eager : au save elle
    // écraserait le mealId qu'on vient de poser.
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
   * Vide les créneaux et les items DERIVED ; les MANUAL survivent.
   * Seul geste qui déplace `startDate` — aucun autre appel ne réancre le plan.
   */
  async clearSlots(userId: string): Promise<Plan> {
    const plan = await this.ensureForUser(userId);
    const startDate = await this.anchorFor(userId);

    // Atomique : des créneaux vidés avec des dérivés survivants afficheraient les
    // ingrédients d'un plan disparu, et l'init paresseuse exige une liste vide pour
    // rattraper.
    await this.plans.manager.transaction(async (manager) => {
      await manager.update(PlanSlot, { planId: plan.id }, { mealId: null });
      await manager.delete(ShoppingListItem, {
        planId: plan.id,
        source: ShoppingItemSource.DERIVED,
      });
      await manager.update(Plan, { id: plan.id }, { startDate });
    });

    return this.ensureForUser(userId);
  }

  private compareSlots = (a: PlanSlot, b: PlanSlot): number => {
    if (a.dayIndex !== b.dayIndex) {
      return a.dayIndex - b.dayIndex;
    }
    return a.slot === b.slot ? 0 : a.slot === MealSlot.LUNCH ? -1 : 1;
  };

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

  /** Le `1 +` garantit un score non nul : un poids nul n'est jamais tiré. */
  private baseScore(meal: Meal): number {
    const favorite = meal.isFavorite ? 2 : 0;
    const rating = ((meal.rating ?? 3) / 5) * 2; // 0.4 … 2
    const freshness = this.freshnessScore(meal.lastCookedAt); // 0 … 2
    return 1 + favorite + rating + freshness;
  }

  /** Croît avec l'ancienneté. */
  private freshnessScore(lastCookedAt: Date | null): number {
    if (!lastCookedAt) {
      return 2; // jamais cuisinée -> priorité max
    }
    // `new Date(...)` défensif : le driver peut livrer une string sur timestamptz.
    const days = (Date.now() - new Date(lastCookedAt).getTime()) / MS_PER_DAY;
    return Math.min(days / FRESHNESS_CAP_DAYS, 1) * 2;
  }
}
