import { ApiProperty } from '@nestjs/swagger';

export class ShoppingListItemDto {
  @ApiProperty()
  ingredientId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  unit: string;

  @ApiProperty()
  quantity: number;

  constructor(
    ingredientId: string,
    name: string,
    unit: string,
    quantity: number,
  ) {
    this.ingredientId = ingredientId;
    this.name = name;
    this.unit = unit;
    this.quantity = quantity;
  }
}

export class ShoppingListDto {
  @ApiProperty()
  weekId: string;

  @ApiProperty({ description: 'Lundi de la semaine (YYYY-MM-DD)' })
  startDate: string;

  @ApiProperty({ type: [ShoppingListItemDto] })
  items: ShoppingListItemDto[];

  constructor(weekId: string, startDate: string, items: ShoppingListItemDto[]) {
    this.weekId = weekId;
    this.startDate = startDate;
    this.items = items;
  }
}
