import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { isUniqueViolation } from '../../common/postgres-errors';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { Ingredient } from './entities/ingredient.entity';

@Injectable()
export class IngredientsService {
  constructor(
    @InjectRepository(Ingredient)
    private readonly ingredients: Repository<Ingredient>,
  ) {}

  search(term?: string): Promise<Ingredient[]> {
    return this.ingredients.find({
      where: term ? { name: ILike(`%${term}%`) } : {},
      order: { name: 'ASC' },
      take: 50,
    });
  }

  async create(dto: CreateIngredientDto): Promise<Ingredient> {
    const name = dto.name.trim();
    // Égalité exacte insensible à la casse, pas un LIKE : même sémantique que
    // l'index UNIQUE(LOWER(name)).
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
      // Course : deux créations concurrentes passent le pré-check ci-dessus.
      if (isUniqueViolation(err)) {
        throw new ConflictException('Un ingrédient porte déjà ce nom');
      }
      throw err;
    }
  }
}
