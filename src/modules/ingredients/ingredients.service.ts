import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { Ingredient } from './entities/ingredient.entity';

/** Vrai si l'erreur est une violation de contrainte unique Postgres (23505). */
function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; driverError?: { code?: string } };
  return (e?.driverError?.code ?? e?.code) === '23505';
}

@Injectable()
export class IngredientsService {
  constructor(
    @InjectRepository(Ingredient)
    private readonly ingredients: Repository<Ingredient>,
  ) {}

  /** Liste les ingrédients du catalogue, filtrés par nom (ILike) si fourni. */
  search(term?: string): Promise<Ingredient[]> {
    return this.ingredients.find({
      where: term ? { name: ILike(`%${term}%`) } : {},
      order: { name: 'ASC' },
      take: 50,
    });
  }

  /** Crée un ingrédient ; lève ConflictException si le nom existe déjà (casse ignorée). */
  async create(dto: CreateIngredientDto): Promise<Ingredient> {
    const name = dto.name.trim();
    // Même sémantique que l'index UNIQUE(LOWER(name)) : égalité exacte
    // insensible à la casse (pas un pattern LIKE).
    const exists = await this.ingredients
      .createQueryBuilder('ingredient')
      .where('LOWER(ingredient.name) = LOWER(:name)', { name })
      .getOne();
    if (exists) {
      throw new ConflictException('Un ingrédient porte déjà ce nom');
    }
    const ingredient = this.ingredients.create({
      name,
      defaultUnit: dto.defaultUnit?.trim() ?? null,
    });
    try {
      return await this.ingredients.save(ingredient);
    } catch (err) {
      // Course : deux créations concurrentes passent le pré-check ; l'index
      // rejette la seconde (23505) -> 409 plutôt qu'une 500.
      if (isUniqueViolation(err)) {
        throw new ConflictException('Un ingrédient porte déjà ce nom');
      }
      throw err;
    }
  }
}
