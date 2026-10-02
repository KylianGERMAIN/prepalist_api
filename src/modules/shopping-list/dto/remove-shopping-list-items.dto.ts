import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsUUID,
} from 'class-validator';

export class RemoveShoppingListItemsDto {
  @ApiProperty({
    type: [String],
    minItems: 1,
    maxItems: 200,
    description: 'Les ids hors de la liste de l’appelant sont ignorés.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  itemIds!: string[];
}

export enum ClearScope {
  ALL = 'all',
  CHECKED = 'checked',
}

export class ClearShoppingListQueryDto {
  @ApiProperty({ enum: ClearScope })
  @IsEnum(ClearScope)
  scope!: ClearScope;
}
