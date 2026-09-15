import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { MealIngredient } from './entities/meal-ingredient.entity';
import { Meal } from './entities/meal.entity';
import { UserMealState } from './entities/user-meal-state.entity';
import { MealStateService } from './meal-state.service';
import { MealsController } from './meals.controller';
import { MealsService } from './meals.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Meal, MealIngredient, Ingredient, UserMealState]),
  ],
  controllers: [MealsController],
  providers: [MealsService, MealStateService],
  exports: [MealsService, MealStateService],
})
export class MealsModule {}
