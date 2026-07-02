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
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
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
    summary: 'Liste paginée du catalogue de repas (filtres favorite/tag/name)',
  })
  @ApiOkResponse({ type: PaginatedMealsDto })
  findAll(@Query() query: MealQueryDto) {
    return this.meals.findAll(query);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Crée un repas (admin uniquement)' })
  @ApiCreatedResponse({ type: Meal })
  create(@Body() dto: CreateMealDto) {
    return this.meals.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’un repas (avec ingrédients)' })
  @ApiOkResponse({ type: Meal })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.meals.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Met à jour un repas (admin uniquement)' })
  @ApiOkResponse({ type: Meal })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMealDto) {
    return this.meals.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprime un repas (admin uniquement)' })
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.meals.remove(id);
  }

  @Post(':id/cooked')
  @ApiOperation({ summary: 'Marque un repas comme cuisiné' })
  @ApiCreatedResponse({ type: Meal })
  markCooked(@Param('id', ParseUUIDPipe) id: string) {
    return this.meals.markCooked(id);
  }
}
