import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Unit } from '../../../common/unit';

export class CreateIngredientDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: Unit, required: false, nullable: true })
  @IsOptional()
  @IsEnum(Unit)
  defaultUnit?: Unit;
}
