import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Meal } from '../meals/entities/meal.entity';
import { ShoppingListItem } from '../shopping-list/entities/shopping-list-item.entity';
import { UsersModule } from '../users/users.module';
import { PlanSlot } from './entities/plan-slot.entity';
import { Plan } from './entities/plan.entity';
import { PlanController } from './plan.controller';
import { PlanService } from './plan.service';

@Module({
  imports: [
    // ShoppingListItem, et non ShoppingListModule : `clear` purge la liste, mais
    // importer le module créerait un cycle (shopping-list dépend de PlanService).
    TypeOrmModule.forFeature([Plan, PlanSlot, Meal, ShoppingListItem]),
    UsersModule,
  ],
  controllers: [PlanController],
  providers: [PlanService],
  exports: [PlanService],
})
export class PlanModule {}
