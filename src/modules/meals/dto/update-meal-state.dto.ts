import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateMealStateDto {
  // `type: Number` explicite : sur une union `number | null` le reflect
  // metadata rend Object, et le client généré tombe sur un type inutilisable.
  @ApiProperty({
    type: Number,
    required: false,
    nullable: true,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number | null;
}
