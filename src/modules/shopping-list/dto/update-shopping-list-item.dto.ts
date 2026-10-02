import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  IsEnum,
  ValidateIf,
} from 'class-validator';
import { Aisle } from '../../../common/aisle';

export class UpdateShoppingListItemDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  checked?: boolean;

  @ApiProperty({ required: false, maxLength: 200 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({
    required: false,
    enum: Aisle,
    nullable: true,
    description:
      'Rayon d’un article manuel. Sur un article issu des plats, 400 s’il diffère du rayon de son ingrédient.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEnum(Aisle)
  aisle?: Aisle | null;
}
