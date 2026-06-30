import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateMealDto } from './dto/create-meal.dto';
import { MealQueryDto } from './dto/meal-query.dto';
import { UpdateMealDto } from './dto/update-meal.dto';
import { MealsService } from './meals.service';

@ApiTags('meals')
@ApiBearerAuth()
@Controller('meals')
export class MealsController {
  constructor(private readonly meals: MealsService) {}

  @Get()
  @ApiOperation({
    summary: 'Liste paginée des repas (filtres favorite/tag/name)',
  })
  findAll(@CurrentUser('id') userId: string, @Query() query: MealQueryDto) {
    return this.meals.findAll(userId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Crée un repas' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateMealDto) {
    return this.meals.create(userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’un repas (avec ingrédients)' })
  findOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.meals.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Met à jour un repas' })
  update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMealDto,
  ) {
    return this.meals.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprime un repas' })
  remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.meals.remove(userId, id);
  }

  @Post(':id/cooked')
  @ApiOperation({ summary: 'Marque un repas comme cuisiné' })
  markCooked(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.meals.markCooked(userId, id);
  }
}
