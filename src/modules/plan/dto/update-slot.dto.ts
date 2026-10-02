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
      'Recopie le repas et les portions du créneau, une fois le patch appliqué, sur le suivant (midi → soir, soir → midi du lendemain), en l’écrasant. 400 après le dernier dîner, ou si le créneau est vide.',
  })
  @IsOptional()
  @IsBoolean()
  alsoNext?: boolean;
}
