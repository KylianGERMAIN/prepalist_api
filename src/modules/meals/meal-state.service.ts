import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { UpdateMealStateDto } from './dto/update-meal-state.dto';
import { Meal } from './entities/meal.entity';
import { UserMealState } from './entities/user-meal-state.entity';

export interface MealStateFields {
  isFavorite: boolean;
  rating: number | null;
  lastCookedAt: Date | null;
  timesCooked: number;
}

export type MealView = Meal & MealStateFields;

const NEVER_TOUCHED: MealStateFields = {
  isFavorite: false,
  rating: null,
  lastCookedAt: null,
  timesCooked: 0,
};

@Injectable()
export class MealStateService {
  constructor(
    @InjectRepository(UserMealState)
    private readonly states: Repository<UserMealState>,
  ) {}

  /** Absent de la Map = jamais touché par ce compte, pas « inconnu ». */
  async forUser(
    userId: string,
    mealIds: string[],
  ): Promise<Map<string, MealStateFields>> {
    if (mealIds.length === 0) {
      return new Map();
    }
    const rows = await this.states.find({
      where: { userId, mealId: In(mealIds) },
    });
    return new Map(rows.map((r) => [r.mealId, r]));
  }

  attach<T extends Meal>(
    meals: T[],
    states: Map<string, MealStateFields>,
  ): (T & MealStateFields)[] {
    return meals.map((meal) =>
      Object.assign(meal, states.get(meal.id) ?? NEVER_TOUCHED),
    );
  }

  /** Incrément en SQL, sinon deux cuissons concurrentes n'en compteraient qu'une. */
  markCooked(userId: string, mealId: string): Promise<void> {
    return this.states.query(
      `INSERT INTO "user_meal_state" ("user_id", "meal_id", "last_cooked_at", "times_cooked")
       VALUES ($1, $2, now(), 1)
       ON CONFLICT ("user_id", "meal_id") DO UPDATE SET
         "last_cooked_at" = now(),
         "times_cooked" = "user_meal_state"."times_cooked" + 1`,
      [userId, mealId],
    );
  }

  async patch(
    userId: string,
    mealId: string,
    dto: UpdateMealStateDto,
  ): Promise<void> {
    const patch: QueryDeepPartialEntity<UserMealState> = {};
    if (dto.isFavorite !== undefined) {
      patch.isFavorite = dto.isFavorite;
    }
    if (dto.rating !== undefined) {
      patch.rating = dto.rating;
    }
    if (Object.keys(patch).length === 0) {
      return;
    }
    await this.states.upsert(
      { userId, mealId, ...patch },
      { conflictPaths: ['userId', 'mealId'] },
    );
  }
}
