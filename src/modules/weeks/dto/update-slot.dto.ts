import { ApiProperty } from '@nestjs/swagger';
import {
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
}
