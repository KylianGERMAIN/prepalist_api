import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { Ingredient } from './entities/ingredient.entity';

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

  /** Crée un ingrédient ; lève ConflictException si le nom existe déjà. */
  async create(dto: CreateIngredientDto): Promise<Ingredient> {
    const name = dto.name.trim();
    const exists = await this.ingredients.findOne({
      where: { name: ILike(name) },
    });
    if (exists) {
      throw new ConflictException('Un ingrédient porte déjà ce nom');
    }
    const ingredient = this.ingredients.create({
      name,
      defaultUnit: dto.defaultUnit?.trim() ?? null,
    });
    return this.ingredients.save(ingredient);
  }
}
