import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/paginated.dto';
import { normalizeTag } from '../tag';

export class MealQueryDto extends PaginationQueryDto {
  @ApiProperty({ required: false, description: 'true = repas sans ingrédient' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  incomplete?: boolean;

  @ApiProperty({
    required: false,
    description: 'Filtre par tag, normalisé comme à l’écriture',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeTag(value) : value,
  )
  tag?: string;

  @ApiProperty({ required: false, description: 'Filtre par nom (ILike)' })
  @IsOptional()
  @IsString()
  name?: string;
}
