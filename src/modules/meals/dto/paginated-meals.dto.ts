import { ApiProperty } from '@nestjs/swagger';
import { MealSummaryDto } from './meal-summary.dto';

// Duplique `PaginatedDto` : Swagger ne nomme pas les génériques, le front n'en
// tirerait aucun type.
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
