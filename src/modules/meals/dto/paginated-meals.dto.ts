import { ApiProperty } from '@nestjs/swagger';
import { MealSummaryDto } from './meal-summary.dto';

/**
 * Forme de la réponse paginée de GET /meals pour Swagger (type nommé côté front).
 * Les items sont des résumés (sans ingrédients) : la liste reste légère.
 */
export class PaginatedMealsDto {
  @ApiProperty({ type: [MealSummaryDto] })
  items!: MealSummaryDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}
