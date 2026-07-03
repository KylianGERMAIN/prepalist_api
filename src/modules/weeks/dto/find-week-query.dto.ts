import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, Matches } from 'class-validator';

export class FindWeekQueryDto {
  @ApiProperty({
    description:
      'Date calendaire (YYYY-MM-DD) ; ramenée au début de semaine (jour de courses de l’utilisateur).',
  })
  // Date pure uniquement : un datetime serait réinterprété selon le fuseau.
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate doit être au format YYYY-MM-DD',
  })
  @IsDateString()
  startDate!: string;
}
