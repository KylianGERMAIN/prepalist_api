import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { IngredientQueryDto } from './dto/ingredient-query.dto';
import { Ingredient } from './entities/ingredient.entity';
import { IngredientsService } from './ingredients.service';

@ApiTags('ingredients')
@ApiBearerAuth()
@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredients: IngredientsService) {}

  @Get()
  @ApiOperation({ summary: 'Recherche dans le catalogue d’ingrédients' })
  @ApiOkResponse({ type: [Ingredient] })
  search(@Query() query: IngredientQueryDto) {
    return this.ingredients.search(query.search);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Ajoute un ingrédient au catalogue (admin uniquement)',
  })
  @ApiCreatedResponse({ type: Ingredient })
  create(@Body() dto: CreateIngredientDto) {
    return this.ingredients.create(dto);
  }
}
