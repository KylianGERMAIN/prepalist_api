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
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CreateMealDto } from './dto/create-meal.dto';
import { MealQueryDto } from './dto/meal-query.dto';
import { MealDto } from './dto/meal.dto';
import { PaginatedMealsDto } from './dto/paginated-meals.dto';
import { UpdateMealStateDto } from './dto/update-meal-state.dto';
import { UpdateMealDto } from './dto/update-meal.dto';
import { MealsService } from './meals.service';

@ApiTags('meals')
@ApiBearerAuth()
@Controller('meals')
export class MealsController {
  constructor(private readonly meals: MealsService) {}

  @Get()
  @ApiOperation({
    summary: 'Liste paginée du catalogue de repas (filtres favorite/tag/name)',
  })
  @ApiOkResponse({ type: PaginatedMealsDto })
  findAll(@CurrentUser('id') userId: string, @Query() query: MealQueryDto) {
    return this.meals.findAll(userId, query);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Crée un repas (admin uniquement)' })
  @ApiCreatedResponse({ type: MealDto })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateMealDto) {
    return this.meals.create(userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’un repas (avec ingrédients)' })
  @ApiOkResponse({ type: MealDto })
  findOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.meals.findOneFor(userId, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Met à jour la recette (admin uniquement)' })
  @ApiOkResponse({ type: MealDto })
  update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMealDto,
  ) {
    return this.meals.update(userId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprime un repas (admin uniquement)' })
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.meals.remove(id);
  }

  @Patch(':id/state')
  @ApiOperation({
    summary: 'Favori et note du repas pour le compte appelant',
  })
  @ApiOkResponse({ type: MealDto })
  updateState(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMealStateDto,
  ) {
    return this.meals.updateState(userId, id, dto);
  }

  @Post(':id/cooked')
  @ApiOperation({
    summary: 'Marque un repas comme cuisiné par le compte appelant',
  })
  @ApiCreatedResponse({ type: MealDto })
  markCooked(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.meals.markCooked(userId, id);
  }
}
