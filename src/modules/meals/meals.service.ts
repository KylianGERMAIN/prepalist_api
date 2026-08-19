import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PaginatedDto } from '../../common/dto/paginated.dto';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { CreateMealDto } from './dto/create-meal.dto';
import { MealIngredientDto } from './dto/meal-ingredient.dto';
import { MealQueryDto } from './dto/meal-query.dto';
import { UpdateMealDto } from './dto/update-meal.dto';
import { MealIngredient } from './entities/meal-ingredient.entity';
import { Meal } from './entities/meal.entity';

@Injectable()
export class MealsService {
  constructor(
    @InjectRepository(Meal) private readonly meals: Repository<Meal>,
    @InjectRepository(MealIngredient)
    private readonly mealIngredients: Repository<MealIngredient>,
    @InjectRepository(Ingredient)
    private readonly ingredients: Repository<Ingredient>,
  ) {}

  async create(dto: CreateMealDto): Promise<Meal> {
    const meal = this.meals.create({
      name: dto.name,
      rating: dto.rating ?? null,
      isFavorite: dto.isFavorite ?? false,
      tags: dto.tags ?? [],
      ingredients: await this.buildIngredients(dto.ingredients ?? []),
    });
    const saved = await this.meals.save(meal);
    // Relit : les lignes de buildIngredients n'ont pas leur relation `ingredient`
    // hydratée, la réponse omettrait le nom de l'ingrédient.
    return this.findOne(saved.id);
  }

  /** Sans les `ingredients` : la liste n'expose qu'un résumé (MealSummaryDto). */
  async findAll(query: MealQueryDto): Promise<PaginatedDto<Meal>> {
    const qb = this.meals.createQueryBuilder('meal');

    if (query.favorite !== undefined) {
      qb.andWhere('meal.is_favorite = :favorite', { favorite: query.favorite });
    }
    if (query.name) {
      qb.andWhere('meal.name ILIKE :name', { name: `%${query.name}%` });
    }
    if (query.tag) {
      qb.andWhere(':tag = ANY(meal.tags)', { tag: query.tag });
    }

    const [items, total] = await qb
      .orderBy('meal.created_at', 'DESC')
      .skip(query.skip)
      .take(query.limit)
      .getManyAndCount();

    return new PaginatedDto(items, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<Meal> {
    // `ingredients` chargés : `update` les remplace en bloc, et sans la
    // collection en mémoire `orphanedRowAction` n'a aucun orphelin à supprimer.
    const meal = await this.meals.findOne({
      where: { id },
      relations: { ingredients: { ingredient: true } },
    });
    if (!meal) {
      throw new NotFoundException('Repas introuvable');
    }
    return meal;
  }

  /** `dto.ingredients` remplace la liste entière, il ne la complète pas. */
  async update(id: string, dto: UpdateMealDto): Promise<Meal> {
    const meal = await this.findOne(id);

    if (dto.name !== undefined) meal.name = dto.name;
    if (dto.rating !== undefined) meal.rating = dto.rating;
    if (dto.isFavorite !== undefined) meal.isFavorite = dto.isFavorite;
    if (dto.tags !== undefined) meal.tags = dto.tags;
    if (dto.ingredients !== undefined) {
      meal.ingredients = await this.buildIngredients(dto.ingredients);
    }

    await this.meals.save(meal);
    // Même raison que dans `create` : la réponse doit avoir la forme du GET.
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const meal = await this.findOne(id);
    await this.meals.remove(meal);
  }

  async markCooked(id: string): Promise<Meal> {
    await this.findOne(id); // 404 si absent
    // Incrément en SQL et non via save() : évite le lost update.
    await this.meals.update(id, {
      timesCooked: () => '"times_cooked" + 1',
      lastCookedAt: new Date(),
    });
    return this.findOne(id);
  }

  private async buildIngredients(
    items: MealIngredientDto[],
  ): Promise<MealIngredient[]> {
    if (items.length === 0) {
      return [];
    }
    const ids = items.map((i) => i.ingredientId);
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length !== ids.length) {
      throw new BadRequestException(
        'Un même ingrédient est présent en double dans le repas',
      );
    }
    const found = await this.ingredients.find({ where: { id: In(uniqueIds) } });
    if (found.length !== uniqueIds.length) {
      throw new BadRequestException(
        'Un ou plusieurs ingrédients sont introuvables',
      );
    }
    return items.map((i) =>
      this.mealIngredients.create({
        ingredientId: i.ingredientId,
        quantity: i.quantity,
        unit: i.unit,
      }),
    );
  }
}
