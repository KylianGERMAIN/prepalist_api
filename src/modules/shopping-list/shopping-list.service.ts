import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isEnum } from 'class-validator';
import { EntityManager, FindOptionsWhere, In, Repository } from 'typeorm';
import { isUniqueViolation } from '../../common/postgres-errors';
import { Unit } from '../../common/unit';
import { PlanService, PlanView } from '../plan/plan.service';
import { CreateShoppingListItemDto } from './dto/create-shopping-list-item.dto';
import { ClearScope } from './dto/remove-shopping-list-items.dto';
import { ShoppingListDto, ShoppingListItemDto } from './dto/shopping-list.dto';
import { UpdateShoppingListItemDto } from './dto/update-shopping-list-item.dto';
import { lockPlan, reconcileDerived } from './derived-items';
import {
  ShoppingItemSource,
  ShoppingListItem,
} from './entities/shopping-list-item.entity';

@Injectable()
export class ShoppingListService {
  constructor(
    @InjectRepository(ShoppingListItem)
    private readonly items: Repository<ShoppingListItem>,
    private readonly plan: PlanService,
  ) {}

  async forPlan(userId: string): Promise<ShoppingListDto> {
    return this.read(await this.plan.ensureForUser(userId));
  }

  /** Recalcule les dérivés et ramène ceux supprimés à la main ; les coches survivent. */
  async sync(userId: string): Promise<ShoppingListDto> {
    const plan = await this.plan.ensureForUser(userId);
    await this.items.manager.transaction(async (manager) => {
      await lockPlan(manager, plan.id);
      await reconcileDerived(manager, plan.id, { restoreDismissed: true });
    });
    return this.read(plan);
  }

  /** Les ids qui ne sont pas dans la liste de l'appelant sont ignorés, sans erreur. */
  async removeItems(
    userId: string,
    itemIds: string[],
  ): Promise<ShoppingListDto> {
    return this.discard(userId, { id: In(itemIds) });
  }

  async clear(userId: string, scope: ClearScope): Promise<ShoppingListDto> {
    return this.discard(
      userId,
      scope === ClearScope.CHECKED ? { checked: true } : {},
    );
  }

  // Même règle que `removeItem` : un dérivé devient une tombstone, sinon la
  // prochaine réconciliation le ramènerait ; un manuel est supprimé.
  private async discard(
    userId: string,
    where: FindOptionsWhere<ShoppingListItem>,
  ): Promise<ShoppingListDto> {
    const plan = await this.plan.ensureForUser(userId);
    await this.items.manager.transaction(async (manager) => {
      await lockPlan(manager, plan.id);
      await manager.update(
        ShoppingListItem,
        {
          ...where,
          planId: plan.id,
          source: ShoppingItemSource.DERIVED,
          dismissed: false,
        },
        { dismissed: true },
      );
      await manager.delete(ShoppingListItem, {
        ...where,
        planId: plan.id,
        source: ShoppingItemSource.MANUAL,
      });
    });
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
      unit: dto.unit,
      quantity: dto.quantity ?? null,
      checked: false,
    });
    const saved = await this.items.save(item);
    return new ShoppingListItemDto(saved);
  }

  async updateItem(
    userId: string,
    itemId: string,
    dto: UpdateShoppingListItemDto,
  ): Promise<ShoppingListItemDto> {
    return this.items.manager.transaction(async (manager) => {
      const item = await this.findLocked(manager, userId, itemId);

      if (dto.checked !== undefined) {
        item.checked = dto.checked;
      }
      if (dto.name !== undefined) {
        item.name = dto.name;
      }
      if (dto.quantity !== undefined) {
        item.quantity = dto.quantity;
      }
      if (dto.unit !== undefined && dto.unit !== item.unit) {
        // Comparé à l'unité actuelle : un article antérieur au jeu fermé doit
        // rester éditable tant qu'on ne touche pas à son unité.
        if (!isEnum(dto.unit, Unit)) {
          throw new BadRequestException(
            `Unité invalide : ${Object.values(Unit).join(', ')}`,
          );
        }
        if (item.source === ShoppingItemSource.DERIVED) {
          // Une tombstone occupe sa clé dans l'index unique : invisible, elle
          // ferait refuser le changement d'unité avec un 409 incompréhensible.
          await manager.delete(ShoppingListItem, {
            planId: item.planId,
            source: ShoppingItemSource.DERIVED,
            ingredientId: item.ingredientId,
            unit: dto.unit,
            dismissed: true,
          });
        }
        item.unit = dto.unit;
      }

      try {
        return new ShoppingListItemDto(await manager.save(item));
      } catch (err) {
        if (!isUniqueViolation(err)) {
          throw err;
        }
        throw new ConflictException(
          `« ${item.name} » est déjà dans la liste avec l'unité ${item.unit}`,
        );
      }
    });
  }

  async removeItem(userId: string, itemId: string): Promise<void> {
    await this.items.manager.transaction(async (manager) => {
      const item = await this.findLocked(manager, userId, itemId);
      if (item.source === ShoppingItemSource.DERIVED) {
        await manager.update(ShoppingListItem, item.id, { dismissed: true });
      } else {
        await manager.remove(item);
      }
    });
  }

  // Relu sous le verrou du plan : lu avant, l'item serait réécrit par-dessus une
  // réconciliation concurrente (coche ou quantité perdue).
  private async findLocked(
    manager: EntityManager,
    userId: string,
    itemId: string,
  ): Promise<ShoppingListItem> {
    const { planId } = await this.findItem(manager, userId, itemId);
    await lockPlan(manager, planId);
    return this.findItem(manager, userId, itemId);
  }

  // C'est la clause `plan: { userId }` qui porte l'ownership : la retirer ouvre
  // l'accès aux items de n'importe quel utilisateur.
  private async findItem(
    manager: EntityManager,
    userId: string,
    itemId: string,
  ): Promise<ShoppingListItem> {
    const item = await manager.findOne(ShoppingListItem, {
      where: { id: itemId, dismissed: false, plan: { userId } },
    });
    if (!item) {
      throw new NotFoundException('Item introuvable');
    }
    return item;
  }

  private async read(plan: PlanView): Promise<ShoppingListDto> {
    const [items, dismissedCount] = await Promise.all([
      this.items.find({ where: { planId: plan.id, dismissed: false } }),
      this.items.count({ where: { planId: plan.id, dismissed: true } }),
    ]);
    items.sort((a, b) =>
      a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }),
    );
    return new ShoppingListDto(
      plan.id,
      plan.startDate,
      items.map((item) => new ShoppingListItemDto(item)),
      dismissedCount,
      this.incompleteMeals(plan),
    );
  }

  private incompleteMeals(plan: PlanView): { id: string; name: string }[] {
    const byId = new Map<string, string>();
    for (const slot of plan.slots) {
      if (slot.meal && slot.meal.ingredientCount === 0) {
        byId.set(slot.meal.id, slot.meal.name);
      }
    }
    return [...byId]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }
}
