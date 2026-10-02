import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Aisle } from '../../../common/aisle';
import { Unit } from '../../../common/unit';

export class CreateShoppingListItemDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiProperty({ enum: Unit })
  @IsEnum(Unit)
  unit!: Unit;

  @ApiProperty({
    required: false,
    enum: Aisle,
    nullable: true,
    description: 'Rayon d’un article manuel. null = « Autre ».',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEnum(Aisle)
  aisle?: Aisle | null;
}
