import { ApiProperty } from '@nestjs/swagger';
import { Meal } from '../entities/meal.entity';

/**
 * Forme de la réponse paginée de GET /meals pour Swagger (type nommé côté front).
 * Décrit ce que renvoie réellement `PaginatedDto<Meal>` à l'exécution.
 */
export class PaginatedMealsDto {
  @ApiProperty({ type: [Meal] })
  items!: Meal[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}
