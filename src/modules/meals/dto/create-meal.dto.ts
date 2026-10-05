import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { normalizeTags } from '../tag';
import { MealIngredientDto } from './meal-ingredient.dto';

export class CreateMealDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({
    required: false,
    type: [String],
    description: 'Normalisés : minuscules, espaces réduits, doublons retirés.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  @ArrayMaxSize(20)
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) && value.every((t) => typeof t === 'string')
      ? normalizeTags(value)
      : value,
  )
  tags?: string[];

  @ApiProperty({
    required: false,
    type: String,
    nullable: true,
    maxLength: 5000,
    description:
      'Procédé, astuces. Espaces de bord retirés ; une chaîne vide ou blanche vaut null.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiProperty({ required: false, type: [MealIngredientDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MealIngredientDto)
  ingredients?: MealIngredientDto[];
}
