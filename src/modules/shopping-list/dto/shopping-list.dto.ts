import { ApiProperty } from '@nestjs/swagger';
import { Aisle } from '../../../common/aisle';
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

  @ApiProperty({
    enum: Aisle,
    nullable: true,
    description:
      'Celui de l’ingrédient pour un article issu des plats ; null = « Autre ».',
  })
  aisle: Aisle | null;

  constructor(item: ShoppingListItem) {
    this.id = item.id;
    this.source = item.source;
    this.ingredientId = item.ingredientId;
    this.name = item.name;
    this.unit = item.unit;
    this.quantity = item.quantity;
    this.checked = item.checked;
    this.aisle = item.aisle ?? item.ingredient?.aisle ?? null;
  }
}

export class IncompleteMealDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

export class ShoppingListDto {
  @ApiProperty()
  planId: string;

  @ApiProperty({ description: 'Premier jour du plan (YYYY-MM-DD)' })
  startDate: string;

  @ApiProperty({ type: [ShoppingListItemDto] })
  items: ShoppingListItemDto[];

  @ApiProperty({
    description:
      'Articles issus des plats que l’utilisateur a supprimés de la liste ; la synchro les ramène',
  })
  dismissedCount: number;

  @ApiProperty({
    type: [IncompleteMealDto],
    description:
      'Repas planifiés sans ingrédient : la liste ne les couvre pas.',
  })
  incompleteMeals: IncompleteMealDto[];

  constructor(
    planId: string,
    startDate: string,
    items: ShoppingListItemDto[],
    dismissedCount: number,
    incompleteMeals: IncompleteMealDto[],
  ) {
    this.planId = planId;
    this.startDate = startDate;
    this.items = items;
    this.dismissedCount = dismissedCount;
    this.incompleteMeals = incompleteMeals;
  }
}
