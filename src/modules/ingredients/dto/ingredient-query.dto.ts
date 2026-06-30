import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class IngredientQueryDto {
  @ApiProperty({ required: false, description: 'Filtre par nom (ILike)' })
  @IsOptional()
  @IsString()
  search?: string;
}
