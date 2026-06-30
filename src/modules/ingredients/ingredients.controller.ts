import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { IngredientQueryDto } from './dto/ingredient-query.dto';
import { IngredientsService } from './ingredients.service';

@ApiTags('ingredients')
@ApiBearerAuth()
@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredients: IngredientsService) {}

  @Get()
  @ApiOperation({ summary: 'Recherche dans le catalogue d’ingrédients' })
  search(@Query() query: IngredientQueryDto) {
    return this.ingredients.search(query.search);
  }

  @Post()
  @ApiOperation({ summary: 'Ajoute un ingrédient au catalogue' })
  create(@Body() dto: CreateIngredientDto) {
    return this.ingredients.create(dto);
  }
}
