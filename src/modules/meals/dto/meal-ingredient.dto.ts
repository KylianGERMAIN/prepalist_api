import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsPositive, IsString, IsUUID } from 'class-validator';

/** Ligne d'ingrédient fournie à la création/màj d'un repas. */
export class MealIngredientDto {
  @ApiProperty()
  @IsUUID()
  ingredientId!: string;

  @ApiProperty()
  @IsPositive()
  quantity!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  unit!: string;
}
