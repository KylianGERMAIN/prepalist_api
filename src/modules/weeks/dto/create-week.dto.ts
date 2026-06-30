import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class CreateWeekDto {
  @ApiProperty({
    required: false,
    description:
      'Date dans la semaine voulue (YYYY-MM-DD) ; ramenée au lundi. Défaut : semaine courante.',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;
}
