import { ApiProperty } from '@nestjs/swagger';

export class TagCountDto {
  @ApiProperty()
  name!: string;

  @ApiProperty({ description: 'Nombre de repas qui portent ce tag.' })
  count!: number;
}
