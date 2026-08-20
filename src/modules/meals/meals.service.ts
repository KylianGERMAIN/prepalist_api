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
import { UpdateMealStateDto } from './dto/update-meal-state.dto';
import { UpdateMealDto } from './dto/update-meal.dto';
import { MealIngredient } from './entities/meal-ingredient.entity';
import { Meal, MealStatus } from './entities/meal.entity';
import { MealStateService, MealView } from './meal-state.service';

const FAVORITE_OF_USER = `EXISTS (
  SELECT 1 FROM "user_meal_state" s
  WHERE s."meal_id" = meal.id AND s."user_id" = :userId AND s."is_favorite"
)`;

@Injectable()
export class MealsService {
  constructor(
    @InjectRepository(Meal) private readonly meals: Repository<Meal>,
    @InjectRepository(MealIngredient)
    private readonly mealIngredients: Repository<MealIngredient>,
    @InjectRepository(Ingredient)
    private readonly ingredients: Repository<Ingredient>,
    private readonly state: MealStateService,
  ) {}

  /** Création réservée à l'admin : la recette entre au catalogue de l'application. */
  async create(userId: string, dto: CreateMealDto): Promise<MealView> {
    const meal = this.meals.create({
      name: dto.name,
      userId: null,
      status: MealStatus.PUBLISHED,
      tags: dto.tags ?? [],
      ingredients: await this.buildIngredients(dto.ingredients ?? []),
    });
    const saved = await this.meals.save(meal);
    // Relit : les lignes de buildIngredients n'ont pas leur relation `ingredient`
    // hydratée, la réponse omettrait le nom de l'ingrédient.
    return this.findOneFor(userId, saved.id);
  }

  /** Sans les `ingredients` : la liste n'expose qu'un résumé (MealSummaryDto). */
  async findAll(
    userId: string,
    query: MealQueryDto,
  ): Promise<PaginatedDto<MealView>> {
    const qb = this.meals.createQueryBuilder('meal');

    if (query.favorite !== undefined) {
      qb.andWhere(
        query.favorite ? FAVORITE_OF_USER : `NOT ${FAVORITE_OF_USER}`,
        { userId },
      );
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

    const states = await this.state.forUser(
      userId,
      items.map((meal) => meal.id),
    );
    return new PaginatedDto(
      this.state.attach(items, states),
      total,
      query.page,
      query.limit,
    );
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

  async findOneFor(userId: string, id: string): Promise<MealView> {
    const meal = await this.findOne(id);
    const states = await this.state.forUser(userId, [id]);
    return this.state.attach([meal], states)[0];
  }

  /** `dto.ingredients` remplace la liste entière, il ne la complète pas. */
  async update(
    userId: string,
    id: string,
    dto: UpdateMealDto,
  ): Promise<MealView> {
    const meal = await this.findOne(id);

    if (dto.name !== undefined) meal.name = dto.name;
    if (dto.tags !== undefined) meal.tags = dto.tags;
    if (dto.ingredients !== undefined) {
      meal.ingredients = await this.buildIngredients(dto.ingredients);
    }

    await this.meals.save(meal);
    // Même raison que dans `create` : la réponse doit avoir la forme du GET.
    return this.findOneFor(userId, id);
  }

  async remove(id: string): Promise<void> {
    const meal = await this.findOne(id);
    await this.meals.remove(meal);
  }

  async markCooked(userId: string, id: string): Promise<MealView> {
    await this.findOne(id); // 404 si absent
    await this.state.markCooked(userId, id);
    return this.findOneFor(userId, id);
  }

  async updateState(
    userId: string,
    id: string,
    dto: UpdateMealStateDto,
  ): Promise<MealView> {
    await this.findOne(id); // 404 si absent
    await this.state.patch(userId, id, dto);
    return this.findOneFor(userId, id);
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
