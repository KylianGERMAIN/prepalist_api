import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateSlotDto {
  @ApiProperty({
    required: false,
    type: String,
    nullable: true,
    description: 'Repas à assigner, ou null pour vider le créneau',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  mealId?: string | null;

  @ApiProperty({ required: false, minimum: 1, maximum: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  servings?: number;

  @ApiProperty({
    required: false,
    description:
      'true vide le créneau et le marque « dehors » ; assigner un repas le retire. Incompatible avec un mealId non nul.',
  })
  @IsOptional()
  @IsBoolean()
  away?: boolean;

  @ApiProperty({
    required: false,
    description:
      'Recopie le résultat du patch sur le créneau suivant (midi → soir, soir → midi du lendemain), en l’écrasant : le repas et les portions, ou l’état « dehors » (sans portions). 400 après le dernier dîner, ou si le créneau n’a ni repas ni état « dehors ».',
  })
  @IsOptional()
  @IsBoolean()
  alsoNext?: boolean;
}
