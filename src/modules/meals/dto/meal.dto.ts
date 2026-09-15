import { ApiProperty } from '@nestjs/swagger';
import { MealIngredient } from '../entities/meal-ingredient.entity';
import { MealSummaryDto } from './meal-summary.dto';

/** Le détail : le résumé plus les lignes d'ingrédients. */
export class MealDto extends MealSummaryDto {
  @ApiProperty({ type: () => [MealIngredient] })
  ingredients!: MealIngredient[];
}
