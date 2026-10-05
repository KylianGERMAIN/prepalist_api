import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, ValidateIf } from 'class-validator';
import { Aisle } from '../../../common/aisle';
import { Unit } from '../../../common/unit';

export class UpdateIngredientDto {
  @ApiProperty({ required: false, enum: Aisle, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEnum(Aisle)
  aisle?: Aisle | null;

  @ApiProperty({ required: false, enum: Unit, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEnum(Unit)
  defaultUnit?: Unit | null;
}
