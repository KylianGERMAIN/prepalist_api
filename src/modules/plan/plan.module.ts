import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Meal } from '../meals/entities/meal.entity';
import { MealsModule } from '../meals/meals.module';
import { UsersModule } from '../users/users.module';
import { PlanSlot } from './entities/plan-slot.entity';
import { Plan } from './entities/plan.entity';
import { PlanController } from './plan.controller';
import { PlanService } from './plan.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Plan, PlanSlot, Meal]),
    MealsModule,
    UsersModule,
  ],
  controllers: [PlanController],
  providers: [PlanService],
  exports: [PlanService],
})
export class PlanModule {}
