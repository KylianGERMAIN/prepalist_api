import { ApiProperty } from '@nestjs/swagger';
import { MealStatus } from '../entities/meal.entity';

/** `ingredients` absent par choix : seul GET /meals/:id les charge. */
export class MealSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Compte propriétaire, null pour une recette de l’application.',
  })
  userId!: string | null;

  @ApiProperty({ enum: MealStatus })
  status!: MealStatus;

  @ApiProperty({ type: Number, nullable: true, minimum: 1, maximum: 5 })
  rating!: number | null;

  @ApiProperty()
  isFavorite!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastCookedAt!: string | null;

  @ApiProperty()
  timesCooked!: number;

  @ApiProperty({ type: [String] })
  tags!: string[];

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}
