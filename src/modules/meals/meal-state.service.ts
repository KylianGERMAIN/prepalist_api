import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UpdateMealStateDto } from './dto/update-meal-state.dto';
import { Meal } from './entities/meal.entity';
import { UserMealState } from './entities/user-meal-state.entity';

export interface MealStateFields {
  rating: number | null;
}

export type MealView = Meal & MealStateFields;

const NEVER_TOUCHED: MealStateFields = { rating: null };

@Injectable()
export class MealStateService {
  constructor(
    @InjectRepository(UserMealState)
    private readonly states: Repository<UserMealState>,
  ) {}

  async attachFor<T extends Meal>(
    userId: string,
    meals: T[],
  ): Promise<(T & MealStateFields)[]> {
    const states = await this.forUser(
      userId,
      meals.map((meal) => meal.id),
    );
    return meals.map((meal) => ({
      ...meal,
      ...(states.get(meal.id) ?? NEVER_TOUCHED),
    }));
  }

  /** Absent de la Map = jamais touché par ce compte, pas « inconnu ». */
  private async forUser(
    userId: string,
    mealIds: string[],
  ): Promise<Map<string, MealStateFields>> {
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
