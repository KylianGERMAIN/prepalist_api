import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsPositive, IsUUID } from 'class-validator';
import { Unit } from '../../../common/unit';

export class MealIngredientDto {
  @ApiProperty()
  @IsUUID()
  ingredientId!: string;

  @ApiProperty()
  @IsPositive()
  quantity!: number;

  @ApiProperty({ enum: Unit })
  @IsEnum(Unit)
  unit!: Unit;
}
