import { PlanSlot } from '../plan/entities/plan-slot.entity';
import { computeDerived, DerivedLine, diffDerived } from './derived-items';
import {
  ShoppingItemSource,
  ShoppingListItem,
} from './entities/shopping-list-item.entity';

const slotWith = (
  servings: number,
  ingredients: [string, string, string, number][],
) =>
  ({
    servings,
    meal: {
      ingredients: ingredients.map(([ingredientId, name, unit, quantity]) => ({
        ingredientId,
        unit,
        quantity,
        ingredient: { name },
      })),
    },
  }) as unknown as PlanSlot;

const item = (
  ingredientId: string,
  unit: string,
  quantity: number,
  extra: Partial<ShoppingListItem> = {},
) =>
  ({
    id: `it-${ingredientId}`,
    planId: 'p1',
    source: ShoppingItemSource.DERIVED,
    ingredientId,
    name: 'Tomate',
    unit,
    quantity,
    checked: false,
    dismissed: false,
    ...extra,
  }) as ShoppingListItem;

const line = (
  ingredientId: string,
  unit: string,
  quantity: number,
): DerivedLine => ({ ingredientId, name: 'Tomate', unit, quantity });

describe('computeDerived', () => {
  it('aggregates by ingredient + unit scaled by servings, rounded to 2 decimals', () => {
    const lines = computeDerived([
      slotWith(1, [['i1', 'Huile', 'ml', 0.1]]),
      slotWith(2, [['i1', 'Huile', 'ml', 0.1]]),
    ]);
    expect(lines).toEqual([
      { ingredientId: 'i1', name: 'Huile', unit: 'ml', quantity: 0.3 },
    ]);
  });

  it('keeps one line per unit for the same ingredient', () => {
    const lines = computeDerived([
      slotWith(1, [
        ['i1', 'Jambon', 'g', 100],
        ['i1', 'Jambon', 'tranche', 2],
      ]),
    ]);
    expect(lines).toHaveLength(2);
  });

  it('ignores empty slots and meals without loaded ingredients', () => {
    const lines = computeDerived([
      { servings: 1, meal: null } as unknown as PlanSlot,
      { servings: 1, meal: {} } as unknown as PlanSlot,
    ]);
    expect(lines).toEqual([]);
  });
});

describe('diffDerived', () => {
  it('inserts new keys and deletes keys gone from the plan', () => {
    const gone = item('i9', 'g', 10);
    const diff = diffDerived([gone], [line('i1', 'g', 250)]);
    expect(diff.toInsert).toEqual([line('i1', 'g', 250)]);
    expect(diff.toDelete).toEqual([gone]);
    expect(diff.toUpdate).toEqual([]);
  });

  it('leaves an unchanged item alone, check included', () => {
    const kept = item('i1', 'g', 250, { checked: true });
    const diff = diffDerived([kept], [line('i1', 'g', 250)]);
    expect(diff.toUpdate).toEqual([]);
    expect(kept.checked).toBe(true);
  });

  it('unchecks an item whose quantity grows: there is more to buy', () => {
    const grown = item('i1', 'g', 250, { checked: true });
    const diff = diffDerived([grown], [line('i1', 'g', 500)]);
    expect(diff.toUpdate).toEqual([grown]);
    expect(grown).toMatchObject({ quantity: 500, checked: false });
  });

  it('keeps the check when the quantity shrinks', () => {
    const shrunk = item('i1', 'g', 500, { checked: true });
    diffDerived([shrunk], [line('i1', 'g', 250)]);
    expect(shrunk).toMatchObject({ quantity: 250, checked: true });
  });

  it('keeps a dismissed item dismissed on a plain reconcile', () => {
    const dismissed = item('i1', 'g', 250, { dismissed: true });
    const diff = diffDerived([dismissed], [line('i1', 'g', 250)]);
    expect(diff.toUpdate).toEqual([]);
    expect(diff.toInsert).toEqual([]);
    expect(dismissed.dismissed).toBe(true);
  });

  it('restores a dismissed item when asked to', () => {
    const dismissed = item('i1', 'g', 250, { dismissed: true });
    const diff = diffDerived([dismissed], [line('i1', 'g', 250)], {
      restoreDismissed: true,
    });
    expect(diff.toUpdate).toEqual([dismissed]);
    expect(dismissed.dismissed).toBe(false);
  });

  it('brings back a bought-then-removed item whose quantity grows', () => {
    const bought = item('i1', 'g', 250, { checked: true, dismissed: true });
    diffDerived([bought], [line('i1', 'g', 500)]);
    expect(bought).toMatchObject({
      quantity: 500,
      checked: false,
      dismissed: false,
    });
  });

  it('keeps an unchecked removed item hidden when its quantity grows', () => {
    const unwanted = item('i1', 'g', 250, { dismissed: true });
    diffDerived([unwanted], [line('i1', 'g', 500)]);
    expect(unwanted).toMatchObject({ quantity: 500, dismissed: true });
  });

  it('deletes a dismissed item whose key left the plan', () => {
    const dismissed = item('i1', 'g', 250, { dismissed: true });
    expect(diffDerived([dismissed], []).toDelete).toEqual([dismissed]);
  });
});
