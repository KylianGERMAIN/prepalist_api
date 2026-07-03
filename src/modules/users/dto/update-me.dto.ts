import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateMeDto {
  @ApiProperty({
    minimum: 0,
    maximum: 6,
    description: 'Jour de courses (0 = dimanche … 6 = samedi).',
  })
  @IsInt()
  @Min(0)
  @Max(6)
  shoppingDay!: number;
}
