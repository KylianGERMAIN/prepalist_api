import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/paginated.dto';

export class MealQueryDto extends PaginationQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  favorite?: boolean;

  @ApiProperty({ required: false, description: 'Filtre par tag exact' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiProperty({ required: false, description: 'Filtre par nom (ILike)' })
  @IsOptional()
  @IsString()
  name?: string;
}
