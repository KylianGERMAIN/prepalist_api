import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UpdateMealStateDto } from './dto/update-meal-state.dto';
import { MealIngredient } from './entities/meal-ingredient.entity';
import { Meal } from './entities/meal.entity';
import { UserMealState } from './entities/user-meal-state.entity';

export interface MealStateFields {
  rating: number | null;
  /** 0 = repas « à compléter » : il ne nourrit pas la liste de courses. */
  ingredientCount: number;
}

export type MealView = Meal & MealStateFields;

const NEVER_RATED = { rating: null };

@Injectable()
export class MealStateService {
  constructor(
    @InjectRepository(UserMealState)
    private readonly states: Repository<UserMealState>,
    @InjectRepository(MealIngredient)
    private readonly mealIngredients: Repository<MealIngredient>,
  ) {}

  /** Note du compte et nombre d'ingrédients, en deux requêtes quel que soit le nombre de repas. */
  async attachFor<T extends Meal>(
    userId: string,
    meals: T[],
  ): Promise<(T & MealStateFields)[]> {
    const ids = meals.map((meal) => meal.id);
    const [states, counts] = await Promise.all([
      this.forUser(userId, ids),
      this.ingredientCounts(ids),
    ]);
    return meals.map((meal) => ({
      ...meal,
      ...(states.get(meal.id) ?? NEVER_RATED),
      ingredientCount: counts.get(meal.id) ?? 0,
    }));
  }

  private async ingredientCounts(
    mealIds: string[],
  ): Promise<Map<string, number>> {
    if (mealIds.length === 0) {
      return new Map();
    }
    const rows = await this.mealIngredients
      .createQueryBuilder('mi')
      .select('mi.meal_id', 'mealId')
      .addSelect('COUNT(*)::int', 'count')
      .where('mi.meal_id IN (:...mealIds)', { mealIds })
      .groupBy('mi.meal_id')
      .getRawMany<{ mealId: string; count: number }>();
    return new Map(rows.map((r) => [r.mealId, r.count]));
  }

  /** Absent de la Map = jamais touché par ce compte, pas « inconnu ». */
  private async forUser(
    userId: string,
    mealIds: string[],
  ): Promise<Map<string, { rating: number | null }>> {
    if (mealIds.length === 0) {
      return new Map();
    }
    const rows = await this.states.find({
      where: { userId, mealId: In(mealIds) },
    });
    // Champ par champ, et non la ligne entière : `attachFor` la fusionne dans
    // le repas, où `userId` et `mealId` de l'état écraseraient ceux de la recette.
    return new Map(rows.map((r) => [r.mealId, { rating: r.rating }]));
  }

  async patch(
    userId: string,
    mealId: string,
    dto: UpdateMealStateDto,
  ): Promise<void> {
    if (dto.rating === undefined) {
      return;
    }
    await this.states.upsert(
      { userId, mealId, rating: dto.rating },
      { conflictPaths: ['userId', 'mealId'] },
    );
  }
}
