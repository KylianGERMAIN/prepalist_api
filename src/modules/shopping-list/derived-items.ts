import { EntityManager } from 'typeorm';
import { roundQuantity } from '../../common/quantity';
import { PlanSlot } from '../plan/entities/plan-slot.entity';
import { Plan } from '../plan/entities/plan.entity';
import {
  ShoppingItemSource,
  ShoppingListItem,
} from './entities/shopping-list-item.entity';

export interface DerivedLine {
  ingredientId: string;
  name: string;
  unit: string;
  quantity: number;
}

export interface DerivedDiff {
  toInsert: DerivedLine[];
  toUpdate: ShoppingListItem[];
  toDelete: ShoppingListItem[];
}

const keyOf = (ingredientId: string | null, unit: string | null) =>
  `${ingredientId}__${unit}`;

/** `slots` doivent porter `meal.ingredients.ingredient` : sinon aucun ingrédient n'est compté. */
export function computeDerived(slots: PlanSlot[]): DerivedLine[] {
  const byKey = new Map<string, DerivedLine>();
  for (const slot of slots) {
    for (const mi of slot.meal?.ingredients ?? []) {
      const key = keyOf(mi.ingredientId, mi.unit);
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

/**
 * Mute les items de `toUpdate` en place. Une coche survit sauf si la quantité
 * augmente ; un dérivé `dismissed` le reste sauf avec `restoreDismissed`, ou
 * s'il avait été coché (acheté) et que sa quantité augmente.
 * Le nom n'est jamais réécrit : il a pu être édité à la main.
 */
export function diffDerived(
  existing: ShoppingListItem[],
  lines: DerivedLine[],
  { restoreDismissed = false } = {},
): DerivedDiff {
  const remaining = new Map(
    existing.map((item) => [keyOf(item.ingredientId, item.unit), item]),
  );
  const diff: DerivedDiff = { toInsert: [], toUpdate: [], toDelete: [] };

  for (const line of lines) {
    const key = keyOf(line.ingredientId, line.unit);
    const item = remaining.get(key);
    if (!item) {
      diff.toInsert.push(line);
      continue;
    }
    remaining.delete(key);

    let changed = false;
    if (item.quantity !== line.quantity) {
      if (item.checked && (item.quantity ?? 0) < line.quantity) {
        // Déjà acheté, mais il en faut plus : même retiré de la liste, il revient.
        item.dismissed = false;
        item.checked = false;
      }
      item.quantity = line.quantity;
      changed = true;
    }
    if (restoreDismissed && item.dismissed) {
      item.dismissed = false;
      changed = true;
    }
    if (changed) {
      diff.toUpdate.push(item);
    }
  }

  diff.toDelete = [...remaining.values()];
  return diff;
}

/** Sérialise les écritures concurrentes sur un même plan jusqu'à la fin de la transaction. */
export async function lockPlan(
  manager: EntityManager,
  planId: string,
): Promise<void> {
  await manager
    .createQueryBuilder(Plan, 'plan')
    .setLock('pessimistic_write')
    .where('plan.id = :planId', { planId })
    .getOne();
}

/** À appeler sous `lockPlan`, dans la transaction qui a modifié les créneaux. */
export async function reconcileDerived(
  manager: EntityManager,
  planId: string,
  options: { restoreDismissed?: boolean } = {},
): Promise<void> {
  const slots = await manager.find(PlanSlot, {
    where: { planId },
    relations: { meal: { ingredients: { ingredient: true } } },
  });
  const existing = await manager.find(ShoppingListItem, {
    where: { planId, source: ShoppingItemSource.DERIVED },
  });
  const diff = diffDerived(existing, computeDerived(slots), options);

  if (diff.toDelete.length > 0) {
    await manager.remove(diff.toDelete);
  }
  if (diff.toUpdate.length > 0) {
    await manager.save(diff.toUpdate);
  }
  if (diff.toInsert.length > 0) {
    await manager.save(
      diff.toInsert.map((line) =>
        manager.create(ShoppingListItem, {
          planId,
          source: ShoppingItemSource.DERIVED,
          ...line,
          checked: false,
          dismissed: false,
        }),
      ),
    );
  }
}

/** Plans dont un créneau porte ce repas, triés : l'ordre des verrous évite les deadlocks. */
export async function planIdsUsingMeal(
  manager: EntityManager,
  mealId: string,
): Promise<string[]> {
  const rows = await manager
    .createQueryBuilder(PlanSlot, 'slot')
    .select('DISTINCT slot.plan_id', 'planId')
    .where('slot.meal_id = :mealId', { mealId })
    .orderBy('slot.plan_id')
    .getRawMany<{ planId: string }>();
  return rows.map((row) => row.planId);
}

/** `planIds` triés, comme les rend `planIdsUsingMeal`. */
export async function reconcilePlans(
  manager: EntityManager,
  planIds: string[],
): Promise<void> {
  for (const planId of planIds) {
    await lockPlan(manager, planId);
    await reconcileDerived(manager, planId);
  }
}
