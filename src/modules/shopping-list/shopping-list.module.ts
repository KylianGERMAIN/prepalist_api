import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanModule } from '../plan/plan.module';
import { ShoppingListItem } from './entities/shopping-list-item.entity';
import { ShoppingListController } from './shopping-list.controller';
import { ShoppingListService } from './shopping-list.service';

@Module({
  imports: [TypeOrmModule.forFeature([ShoppingListItem]), PlanModule],
  controllers: [ShoppingListController],
  providers: [ShoppingListService],
})
export class ShoppingListModule {}
