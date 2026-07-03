import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Week } from '../weeks/entities/week.entity';
import { WeeksService } from '../weeks/weeks.service';
import { CreateShoppingListItemDto } from './dto/create-shopping-list-item.dto';
import { ShoppingListDto, ShoppingListItemDto } from './dto/shopping-list.dto';
import { UpdateShoppingListItemDto } from './dto/update-shopping-list-item.dto';
import {
  ShoppingItemSource,
  ShoppingListItem,
} from './entities/shopping-list-item.entity';

/** Ligne dérivée calculée depuis les plats, avant matérialisation. */
interface DerivedLine {
  ingredientId: string;
  name: string;
  unit: string;
  quantity: number;
}

@Injectable()
export class ShoppingListService {
  constructor(
    @InjectRepository(ShoppingListItem)
    private readonly items: Repository<ShoppingListItem>,
    private readonly weeks: WeeksService,
  ) {}

  /**
   * Liste de courses matérialisée d'une semaine. Init paresseuse : si aucune
   * ligne n'existe encore, on lance un `sync` pour peupler la table depuis les
   * plats, puis on relit — l'utilisateur voit sa liste sans action explicite.
   */
  async forWeek(userId: string, weekId: string): Promise<ShoppingListDto> {
    const week = await this.weeks.findOne(userId, weekId);
    // Compte les seuls DERIVED : un ajout manuel ne doit pas empêcher la
    // première matérialisation des items issus des plats.
    const derivedCount = await this.items.count({
      where: { weekId, source: ShoppingItemSource.DERIVED },
    });
    if (derivedCount === 0) {
      // ponytail: deux GET concurrents sur une semaine vide lanceraient deux
      // sync -> l'index unique partiel fait échouer le second (500). Acceptable
      // en app mono-utilisateur ; sous charge, avaler le conflit d'unicité ou
      // poser un verrou advisory sur weekId.
      await this.syncDerived(week);
    }
    return this.read(week);
  }

  /**
   * Resynchronise les items DERIVED depuis les plats de la semaine (idempotent) :
   * met à jour quantité/nom des lignes toujours présentes en conservant `checked`,
   * insère les nouveaux ingrédients, supprime les dérivés orphelins. Les items
   * MANUAL ne sont jamais touchés.
   */
  async sync(userId: string, weekId: string): Promise<ShoppingListDto> {
    const week = await this.weeks.findOne(userId, weekId);
    await this.syncDerived(week);
    return this.read(week);
  }

  /** Ajoute un item manuel (hors plats) à la liste. */
  async addItem(
    userId: string,
    weekId: string,
    dto: CreateShoppingListItemDto,
  ): Promise<ShoppingListItemDto> {
    await this.weeks.findOne(userId, weekId);
    const item = this.items.create({
      weekId,
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

  /**
   * Met à jour un item : `checked` sur n'importe quel item ; `name`/`quantity`/
   * `unit` uniquement sur un MANUAL (un DERIVED est piloté par les plats + sync).
   */
  async updateItem(
    userId: string,
    weekId: string,
    itemId: string,
    dto: UpdateShoppingListItemDto,
  ): Promise<ShoppingListItemDto> {
    const item = await this.findItem(userId, weekId, itemId);

    const editsContent =
      dto.name !== undefined ||
      dto.quantity !== undefined ||
      dto.unit !== undefined;
    if (editsContent && item.source !== ShoppingItemSource.MANUAL) {
      throw new BadRequestException(
        'Seuls les items manuels peuvent être édités (nom, quantité, unité)',
      );
    }

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

    const saved = await this.items.save(item);
    return new ShoppingListItemDto(saved);
  }

  /** Supprime un item de la liste. */
  async removeItem(
    userId: string,
    weekId: string,
    itemId: string,
  ): Promise<void> {
    const item = await this.findItem(userId, weekId, itemId);
    await this.items.remove(item);
  }

  /** Charge un item en garantissant l'ownership (semaine de l'utilisateur). */
  private async findItem(
    userId: string,
    weekId: string,
    itemId: string,
  ): Promise<ShoppingListItem> {
    await this.weeks.findOne(userId, weekId);
    const item = await this.items.findOne({ where: { id: itemId, weekId } });
    if (!item) {
      throw new NotFoundException('Item introuvable');
    }
    return item;
  }

  /** Lit la liste matérialisée triée par nom (fr, insensible à la casse). */
  private async read(week: Week): Promise<ShoppingListDto> {
    const items = await this.items.find({ where: { weekId: week.id } });
    items.sort((a, b) =>
      a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }),
    );
    return new ShoppingListDto(
      week.id,
      week.startDate,
      items.map((item) => new ShoppingListItemDto(item)),
    );
  }

  /**
   * Diff idempotent entre le calcul depuis les plats et les lignes DERIVED
   * persistées, dans une transaction (update / insert / delete atomiques).
   */
  private async syncDerived(week: Week): Promise<void> {
    const derived = this.computeDerived(week);
    await this.items.manager.transaction(async (manager) => {
      const repo = manager.getRepository(ShoppingListItem);
      const existing = await repo.find({
        where: { weekId: week.id, source: ShoppingItemSource.DERIVED },
      });
      const existingByKey = new Map(
        existing.map((item) => [
          this.keyOf(item.ingredientId, item.unit),
          item,
        ]),
      );

      const toSave: ShoppingListItem[] = [];
      for (const line of derived) {
        const key = this.keyOf(line.ingredientId, line.unit);
        const match = existingByKey.get(key);
        if (match) {
          // Conserve `checked` : seules quantité/nom suivent les plats.
          match.quantity = line.quantity;
          match.name = line.name;
          toSave.push(match);
          existingByKey.delete(key);
        } else {
          toSave.push(
            repo.create({
              weekId: week.id,
              source: ShoppingItemSource.DERIVED,
              ingredientId: line.ingredientId,
              name: line.name,
              unit: line.unit,
              quantity: line.quantity,
              checked: false,
            }),
          );
        }
      }

      // Ce qui reste dans la map n'est plus produit par les plats -> orphelin.
      const orphans = [...existingByKey.values()];
      if (orphans.length > 0) {
        await repo.remove(orphans);
      }
      if (toSave.length > 0) {
        await repo.save(toSave);
      }
    });
  }

  /**
   * Agrège les MealIngredient des créneaux assignés (quantité × portions),
   * groupés par ingrédient + unité, quantité arrondie à 2 décimales.
   */
  private computeDerived(week: Week): DerivedLine[] {
    // ponytail: un repas placé en dîner J + déjeuner J+1 (restes) est compté 2×.
    // Dédupliquer les restes demanderait de détecter les chaînes dîner->déjeuner,
    // fragile — à trancher si le sur-achat devient gênant.
    const byKey = new Map<string, DerivedLine>();
    for (const slot of week.slots) {
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
      // Arrondi à l'écriture : l'accumulation en float64 des numeric Postgres
      // peut produire 250.00000000000003 ; 2 décimales suffisent.
      quantity: Math.round(line.quantity * 100) / 100,
    }));
  }

  private keyOf(ingredientId: string | null, unit: string | null): string {
    return `${ingredientId}__${unit}`;
  }
}
