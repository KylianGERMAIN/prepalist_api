import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, Matches } from 'class-validator';

export class CreateWeekDto {
  @ApiProperty({
    required: false,
    description:
      'Date calendaire dans la semaine voulue (YYYY-MM-DD) ; ramenée au lundi. Défaut : semaine courante.',
  })
  @IsOptional()
  // Date pure uniquement : un datetime serait réinterprété selon le fuseau.
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate doit être au format YYYY-MM-DD',
  })
  @IsDateString()
  startDate?: string;
}
