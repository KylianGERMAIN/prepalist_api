import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUniqueViolation } from '../../common/postgres-errors';
import { roundQuantity } from '../../common/quantity';
import { Plan } from '../plan/entities/plan.entity';
import { PlanService } from '../plan/plan.service';
import { CreateShoppingListItemDto } from './dto/create-shopping-list-item.dto';
import { ShoppingListDto, ShoppingListItemDto } from './dto/shopping-list.dto';
import { UpdateShoppingListItemDto } from './dto/update-shopping-list-item.dto';
import {
  ShoppingItemSource,
  ShoppingListItem,
} from './entities/shopping-list-item.entity';

interface DerivedLine {
  ingredientId: string;
  name: string;
  unit: string;
  quantity: number;
}

@Injectable()
export class ShoppingListService {
  private readonly logger = new Logger(ShoppingListService.name);

  constructor(
    @InjectRepository(ShoppingListItem)
    private readonly items: Repository<ShoppingListItem>,
    private readonly plan: PlanService,
  ) {}

  /** Écrit : la première lecture d'un plan vide peuple la table depuis les plats. */
  async forPlan(userId: string): Promise<ShoppingListDto> {
    const plan = await this.plan.ensureForUser(userId);
    // Compter tous les items et pas seulement les DERIVED : sinon cocher ou
    // supprimer le dernier dérivé ré-injecte toute la liste au prochain GET.
    // Repose sur l'UI, qui fait toujours un GET avant tout ajout manuel.
    const count = await this.items.count({ where: { planId: plan.id } });
    if (count === 0) {
      try {
        // Relu en profond ici seulement : la jointure des ingrédients se paie à
        // l'init, pas à chaque lecture d'une liste déjà peuplée.
        await this.syncDerived(
          await this.plan.ensureForUserWithIngredients(userId),
        );
      } catch (err) {
        // Deux GET concurrents sur un plan vide lancent deux sync ; l'index unique
        // partiel fait échouer le second, dont le travail est déjà fait.
        if (!isUniqueViolation(err)) {
          throw err;
        }
        this.logger.warn(
          `Init concurrente de la liste du plan ${plan.id} : conflit avalé`,
        );
      }
    }
    return this.read(plan);
  }

  async sync(userId: string): Promise<ShoppingListDto> {
    const plan = await this.plan.ensureForUserWithIngredients(userId);
    await this.syncDerived(plan);
    return this.read(plan);
  }

  async addItem(
    userId: string,
    dto: CreateShoppingListItemDto,
  ): Promise<ShoppingListItemDto> {
    const plan = await this.plan.ensureForUser(userId);
    const item = this.items.create({
      planId: plan.id,
      source: ShoppingItemSource.MANUAL,
      ingredientId: null,
      name: dto.name,
      unit: dto.unit ?? null,
      quantity: dto.quantity ?? null,
      checked: false,
    });
    const saved = await this.items.save(item);
    return new ShoppingListItemDto(saved);
  }

  /** Un item DERIVED est éditable comme un MANUAL : la liste appartient à l'utilisateur. */
  async updateItem(
    userId: string,
    itemId: string,
    dto: UpdateShoppingListItemDto,
  ): Promise<ShoppingListItemDto> {
    const item = await this.findItem(userId, itemId);

    if (dto.checked !== undefined) {
      item.checked = dto.checked;
    }
    if (dto.name !== undefined) {
      item.name = dto.name;
    }
    if (dto.quantity !== undefined) {
      item.quantity = dto.quantity;
    }
    if (dto.unit !== undefined) {
      item.unit = dto.unit;
    }

    try {
      const saved = await this.items.save(item);
      return new ShoppingListItemDto(saved);
    } catch (err) {
      // Éditer un DERIVED peut amener sa clé (ingredientId, unit) sur celle d'un
      // autre dérivé, et collisionner l'index unique partiel.
      if (isUniqueViolation(err)) {
        throw new ConflictException(
          'Un item dérivé identique (ingrédient + unité) existe déjà',
        );
      }
      throw err;
    }
  }

  async removeItem(userId: string, itemId: string): Promise<void> {
    const item = await this.findItem(userId, itemId);
    await this.items.remove(item);
  }

  // C'est la clause `plan: { userId }` qui porte l'ownership : la retirer ouvre
  // l'accès aux items de n'importe quel utilisateur.
  private async findItem(
    userId: string,
    itemId: string,
  ): Promise<ShoppingListItem> {
    const item = await this.items.findOne({
      where: { id: itemId, plan: { userId } },
    });
    if (!item) {
      throw new NotFoundException('Item introuvable');
    }
    return item;
  }

  private async read(plan: Plan): Promise<ShoppingListDto> {
    const items = await this.items.find({ where: { planId: plan.id } });
    items.sort((a, b) =>
      a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }),
    );
    return new ShoppingListDto(
      plan.id,
      plan.startDate,
      items.map((item) => new ShoppingListItemDto(item)),
    );
  }

  // Insert-only : jamais de mise à jour de quantité ni de suppression d'orphelin,
  // sinon les éditions manuelles de l'utilisateur seraient écrasées.
  // `plan` vient d'`ensureForUserWithIngredients` : sans les ingrédients chargés,
  // l'agrégation rend une liste vide sans lever d'erreur.
  private async syncDerived(plan: Plan): Promise<void> {
    const derived = this.computeDerived(plan);
    if (derived.length === 0) {
      return;
    }
    await this.items.manager.transaction(async (manager) => {
      const repo = manager.getRepository(ShoppingListItem);
      const existing = await repo.find({ where: { planId: plan.id } });
      const existingKeys = new Set(
        existing.map((item) => this.keyOf(item.ingredientId, item.unit)),
      );

      const toInsert = derived
        .filter(
          (line) => !existingKeys.has(this.keyOf(line.ingredientId, line.unit)),
        )
        .map((line) =>
          repo.create({
            planId: plan.id,
            source: ShoppingItemSource.DERIVED,
            ingredientId: line.ingredientId,
            name: line.name,
            unit: line.unit,
            quantity: line.quantity,
            checked: false,
          }),
        );

      if (toInsert.length > 0) {
        await repo.save(toInsert);
      }
    });
  }

  private computeDerived(plan: Plan): DerivedLine[] {
    // ponytail: un repas placé en dîner J + déjeuner J+1 (restes) est compté 2×.
    // Détecter les chaînes dîner->déjeuner si le sur-achat devient gênant.
    const byKey = new Map<string, DerivedLine>();
    for (const slot of plan.slots) {
      if (!slot.meal) {
        continue;
      }
      for (const mi of slot.meal.ingredients ?? []) {
        const key = this.keyOf(mi.ingredientId, mi.unit);
        const quantity = mi.quantity * slot.servings;
        const existing = byKey.get(key);
        if (existing) {
          existing.quantity += quantity;
        } else {
          byKey.set(key, {
            ingredientId: mi.ingredientId,
            name: mi.ingredient.name,
            unit: mi.unit,
            quantity,
          });
        }
      }
    }

    return [...byKey.values()].map((line) => ({
      ...line,
      quantity: roundQuantity(line.quantity),
    }));
  }

  private keyOf(ingredientId: string | null, unit: string | null): string {
    return `${ingredientId}__${unit}`;
  }
}
