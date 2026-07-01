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
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateMealDto } from './dto/create-meal.dto';
import { MealQueryDto } from './dto/meal-query.dto';
import { PaginatedMealsDto } from './dto/paginated-meals.dto';
import { UpdateMealDto } from './dto/update-meal.dto';
import { Meal } from './entities/meal.entity';
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
  @ApiOkResponse({ type: PaginatedMealsDto })
  findAll(@CurrentUser('id') userId: string, @Query() query: MealQueryDto) {
    return this.meals.findAll(userId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Crée un repas' })
  @ApiCreatedResponse({ type: Meal })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateMealDto) {
    return this.meals.create(userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’un repas (avec ingrédients)' })
  @ApiOkResponse({ type: Meal })
  findOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.meals.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Met à jour un repas' })
  @ApiOkResponse({ type: Meal })
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
  @ApiNoContentResponse()
  remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.meals.remove(userId, id);
  }

  @Post(':id/cooked')
  @ApiOperation({ summary: 'Marque un repas comme cuisiné' })
  @ApiCreatedResponse({ type: Meal })
  markCooked(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.meals.markCooked(userId, id);
  }
}
