import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateShoppingListItemDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  checked?: boolean;

  @ApiProperty({
    required: false,
    description: 'Item MANUAL uniquement',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    required: false,
    minimum: 0,
    description: 'Item MANUAL uniquement',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiProperty({
    required: false,
    description: 'Item MANUAL uniquement',
  })
  @IsOptional()
  @IsString()
  unit?: string;
}
