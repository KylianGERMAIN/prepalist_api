import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeeksModule } from '../weeks/weeks.module';
import { ShoppingListItem } from './entities/shopping-list-item.entity';
import { ShoppingListController } from './shopping-list.controller';
import { ShoppingListService } from './shopping-list.service';

@Module({
  imports: [TypeOrmModule.forFeature([ShoppingListItem]), WeeksModule],
  controllers: [ShoppingListController],
  providers: [ShoppingListService],
})
export class ShoppingListModule {}
