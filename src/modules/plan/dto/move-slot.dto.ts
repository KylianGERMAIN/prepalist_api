import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class MoveSlotDto {
  @ApiProperty({
    description:
      'Créneau de destination. Occupé, les deux créneaux échangent leur contenu.',
  })
  @IsUUID()
  targetSlotId!: string;
}
