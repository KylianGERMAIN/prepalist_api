import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Week } from '../weeks/entities/week.entity';
import { ShoppingListDto, ShoppingListItemDto } from './dto/shopping-list.dto';

@Injectable()
export class ShoppingListService {
  constructor(
    @InjectRepository(Week) private readonly weeks: Repository<Week>,
  ) {}

  /**
   * Agrège la liste de courses d'une semaine à partir des MealIngredient de
   * ses créneaux assignés (quantité × portions), groupés par ingrédient + unité.
   * Tout le graphe semaine -> créneaux -> repas -> ingrédients est chargé en
   * eager : une seule requête.
   */
  async forWeek(userId: string, weekId: string): Promise<ShoppingListDto> {
    const week = await this.weeks.findOne({ where: { id: weekId } });
    if (!week || week.userId !== userId) {
      throw new NotFoundException('Semaine introuvable');
    }

    // ponytail: un repas placé en dîner J + déjeuner J+1 (restes) est compté 2×.
    // Dédupliquer les restes demanderait de détecter les chaînes dîner->déjeuner,
    // fragile — à trancher si le sur-achat devient gênant.
    const byKey = new Map<string, ShoppingListItemDto>();
    for (const slot of week.slots) {
      if (!slot.meal) {
        continue;
      }
      for (const mi of slot.meal.ingredients ?? []) {
        const key = `${mi.ingredientId}__${mi.unit}`;
        const quantity = mi.quantity * slot.servings;
        const existing = byKey.get(key);
        if (existing) {
          existing.quantity += quantity;
        } else {
          byKey.set(
            key,
            new ShoppingListItemDto(
              mi.ingredientId,
              mi.ingredient.name,
              mi.unit,
              quantity,
            ),
          );
        }
      }
    }

    const items = [...byKey.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    return new ShoppingListDto(week.id, week.startDate, items);
  }
}
