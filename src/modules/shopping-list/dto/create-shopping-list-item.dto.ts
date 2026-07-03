import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  unit?: string;
}
