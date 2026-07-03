import { ApiProperty } from '@nestjs/swagger';
import {
  ShoppingItemSource,
  ShoppingListItem,
} from '../entities/shopping-list-item.entity';

export class ShoppingListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: ShoppingItemSource })
  source: ShoppingItemSource;

  @ApiProperty({ type: String, nullable: true })
  ingredientId: string | null;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: String, nullable: true })
  unit: string | null;

  @ApiProperty({ type: Number, nullable: true })
  quantity: number | null;

  @ApiProperty()
  checked: boolean;

  constructor(item: ShoppingListItem) {
    this.id = item.id;
    this.source = item.source;
    this.ingredientId = item.ingredientId;
    this.name = item.name;
    this.unit = item.unit;
    this.quantity = item.quantity;
    this.checked = item.checked;
  }
}

export class ShoppingListDto {
  @ApiProperty()
  weekId: string;

  @ApiProperty({
    description: 'Début de semaine = jour de courses (YYYY-MM-DD)',
  })
  startDate: string;

  @ApiProperty({ type: [ShoppingListItemDto] })
  items: ShoppingListItemDto[];

  constructor(weekId: string, startDate: string, items: ShoppingListItemDto[]) {
    this.weekId = weekId;
    this.startDate = startDate;
    this.items = items;
  }
}
