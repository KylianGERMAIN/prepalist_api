import { ApiProperty } from '@nestjs/swagger';

/**
 * Aperçu d'un repas pour la liste GET /meals : tous les champs de Meal SAUF
 * `ingredients` (la liste ne les charge pas — voir findAll). Le détail
 * GET /meals/:id renvoie le `Meal` complet.
 */
export class MealSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  name!: string;

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
