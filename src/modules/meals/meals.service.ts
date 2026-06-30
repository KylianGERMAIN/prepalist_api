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

  /** Crée un repas pour l'utilisateur, avec ses lignes d'ingrédients. */
  async create(userId: string, dto: CreateMealDto): Promise<Meal> {
    const meal = this.meals.create({
      userId,
      name: dto.name,
      rating: dto.rating ?? null,
      isFavorite: dto.isFavorite ?? false,
      tags: dto.tags ?? [],
      ingredients: await this.buildIngredients(dto.ingredients ?? []),
    });
    return this.meals.save(meal);
  }

  /** Liste paginée des repas de l'utilisateur (sans ingrédients), avec filtres. */
  async findAll(
    userId: string,
    query: MealQueryDto,
  ): Promise<PaginatedDto<Meal>> {
    const qb = this.meals
      .createQueryBuilder('meal')
      .where('meal.user_id = :userId', { userId });

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

  /** Récupère un repas de l'utilisateur (ingrédients chargés) ou lève 404. */
  async findOne(userId: string, id: string): Promise<Meal> {
    const meal = await this.meals.findOne({ where: { id } });
    if (!meal || meal.userId !== userId) {
      throw new NotFoundException('Repas introuvable');
    }
    return meal;
  }

  /** Met à jour un repas ; remplace les ingrédients si la liste est fournie. */
  async update(userId: string, id: string, dto: UpdateMealDto): Promise<Meal> {
    const meal = await this.findOne(userId, id);

    if (dto.name !== undefined) meal.name = dto.name;
    if (dto.rating !== undefined) meal.rating = dto.rating;
    if (dto.isFavorite !== undefined) meal.isFavorite = dto.isFavorite;
    if (dto.tags !== undefined) meal.tags = dto.tags;
    if (dto.ingredients !== undefined) {
      meal.ingredients = await this.buildIngredients(dto.ingredients);
    }

    return this.meals.save(meal);
  }

  /** Supprime un repas de l'utilisateur (cascade sur les lignes d'ingrédients). */
  async remove(userId: string, id: string): Promise<void> {
    const meal = await this.findOne(userId, id);
    await this.meals.remove(meal);
  }

  /** Marque un repas comme cuisiné : incrément atomique + date la dernière fois. */
  async markCooked(userId: string, id: string): Promise<Meal> {
    await this.findOne(userId, id); // garde d'ownership + 404
    // Incrément en SQL pour éviter la perte de mise à jour (lost update) et le
    // rechargement inutile du graphe d'ingrédients par save().
    await this.meals.update(id, {
      timesCooked: () => '"times_cooked" + 1',
      lastCookedAt: new Date(),
    });
    return this.findOne(userId, id);
  }

  /** Construit les lignes d'ingrédients en validant que tous existent. */
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
