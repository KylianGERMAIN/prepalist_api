import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsPositive, IsString, IsUUID } from 'class-validator';

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
