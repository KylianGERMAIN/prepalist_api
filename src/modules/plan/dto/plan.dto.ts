import { ApiProperty } from '@nestjs/swagger';
import { MealSummaryDto } from '../../meals/dto/meal-summary.dto';
import { MealSlot } from '../entities/plan-slot.entity';

export class PlanSlotDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'Rang du jour dans le plan : 0 = premier jour.' })
  dayIndex!: number;

  @ApiProperty({ enum: MealSlot })
  slot!: MealSlot;

  @ApiProperty({ type: String, nullable: true })
  mealId!: string | null;

  @ApiProperty({ type: () => MealSummaryDto, nullable: true })
  meal!: MealSummaryDto | null;

  @ApiProperty()
  servings!: number;
}

export class PlanDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'Premier jour du plan (YYYY-MM-DD)' })
  startDate!: string;

  @ApiProperty()
  dayCount!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: [PlanSlotDto] })
  slots!: PlanSlotDto[];
}
