import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isEnum } from 'class-validator';
import { Repository } from 'typeorm';
import { isUniqueViolation } from '../../common/postgres-errors';
import { Unit } from '../../common/unit';
import { Plan } from '../plan/entities/plan.entity';
import { PlanService } from '../plan/plan.service';
import { CreateShoppingListItemDto } from './dto/create-shopping-list-item.dto';
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
      // Comparé à l'unité actuelle : un article antérieur au jeu fermé doit
      // rester éditable tant qu'on ne touche pas à son unité.
      if (dto.unit !== item.unit && !isEnum(dto.unit, Unit)) {
        throw new BadRequestException(
          `Unité invalide : ${Object.values(Unit).join(', ')}`,
        );
      }
      item.unit = dto.unit;
    }

    try {
      return new ShoppingListItemDto(await this.items.save(item));
    } catch (err) {
      if (!isUniqueViolation(err)) {
        throw err;
      }
      throw new ConflictException(
        `« ${item.name} » est déjà dans la liste avec l'unité ${item.unit}`,
      );
    }
  }

  async removeItem(userId: string, itemId: string): Promise<void> {
    const item = await this.findItem(userId, itemId);
    if (item.source === ShoppingItemSource.DERIVED) {
      await this.items.update(item.id, { dismissed: true });
    } else {
      await this.items.remove(item);
    }
  }

  // C'est la clause `plan: { userId }` qui porte l'ownership : la retirer ouvre
  // l'accès aux items de n'importe quel utilisateur.
  private async findItem(
    userId: string,
    itemId: string,
  ): Promise<ShoppingListItem> {
    const item = await this.items.findOne({
      where: { id: itemId, dismissed: false, plan: { userId } },
    });
    if (!item) {
      throw new NotFoundException('Item introuvable');
    }
    return item;
  }

  private async read(plan: Plan): Promise<ShoppingListDto> {
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
    );
  }
}
