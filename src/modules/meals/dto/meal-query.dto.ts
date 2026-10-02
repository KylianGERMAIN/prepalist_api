import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/paginated.dto';

export class MealQueryDto extends PaginationQueryDto {
  @ApiProperty({ required: false, description: 'Filtre par tag exact' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiProperty({ required: false, description: 'Filtre par nom (ILike)' })
  @IsOptional()
  @IsString()
  name?: string;
}
