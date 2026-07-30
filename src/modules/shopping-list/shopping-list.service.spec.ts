import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ShoppingListService } from './shopping-list.service';
import { ShoppingItemSource } from './entities/shopping-list-item.entity';

const mi = (
  ingredientId: string,
  name: string,
  unit: string,
  quantity: number,
) => ({
  ingredientId,
  unit,
  quantity,
  ingredient: { name },
});

const plan = (slots: unknown[]) => ({
  id: 'p1',
  userId: 'u1',
  startDate: '2024-07-01',
  dayCount: 7,
  slots,
});

const derivedItem = (
  id: string,
  ingredientId: string,
  unit: string,
  name: string,
  quantity: number,
  checked = false,
) => ({
  id,
  planId: 'p1',
  source: ShoppingItemSource.DERIVED,
  ingredientId,
  unit,
  name,
  quantity,
  checked,
});

describe('ShoppingListService', () => {
  let service: ShoppingListService;
  let planService: { ensureForUser: jest.Mock };
  let txRepo: {
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };
  let items: {
    count: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
    manager: { transaction: jest.Mock };
  };

  beforeEach(() => {
    planService = { ensureForUser: jest.fn() };
    txRepo = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((x: unknown) => ({ ...(x as object) })),
      save: jest.fn((x: unknown) => x),
      remove: jest.fn(),
    };
    items = {
      count: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn((x: unknown) => ({ ...(x as object) })),
      save: jest.fn((x: unknown) => x),
      remove: jest.fn(),
      manager: {
        transaction: jest.fn(
          async (cb: (m: unknown) => unknown) =>
            cb({ getRepository: () => txRepo }) as unknown,
        ),
      },
    };
    service = new ShoppingListService(items as never, planService as never);
  });

  describe('forPlan (lazy init)', () => {
    it('syncs when the list is entirely empty, then reads', async () => {
      planService.ensureForUser.mockResolvedValue(
        plan([
          {
            servings: 1,
            meal: { ingredients: [mi('i1', 'Tomate', 'g', 250)] },
          },
        ]),
      );
      items.count.mockResolvedValue(0);
      await service.forPlan('u1');
      expect(items.count).toHaveBeenCalledWith({ where: { planId: 'p1' } });
      expect(items.manager.transaction).toHaveBeenCalledTimes(1);
      expect(txRepo.create).toHaveBeenCalled();
      expect(items.find).toHaveBeenCalled();
    });

    it('does not sync when the list already holds items (e.g. a manual one)', async () => {
      planService.ensureForUser.mockResolvedValue(
        plan([
          {
            servings: 1,
            meal: { ingredients: [mi('i1', 'Tomate', 'g', 250)] },
          },
        ]),
      );
      items.count.mockResolvedValue(1);
      await service.forPlan('u1');
      expect(items.manager.transaction).not.toHaveBeenCalled();
    });

    it('propagates a failure raised while resolving the plan', async () => {
      planService.ensureForUser.mockRejectedValue(new Error('db down'));
      await expect(service.forPlan('u1')).rejects.toThrow('db down');
    });

    it('returns items sorted by name', async () => {
      planService.ensureForUser.mockResolvedValue(plan([]));
      items.count.mockResolvedValue(2);
      items.find.mockResolvedValue([
        derivedItem('b', 'i2', 'g', 'Tomate', 250),
        derivedItem('a', 'i1', 'g', 'Pates', 240),
      ]);
      const res = await service.forPlan('u1');
      expect(res.items.map((i) => i.name)).toEqual(['Pates', 'Tomate']);
    });
  });

  describe('sync (insert-only)', () => {
    it('inserts only the ingredients that are absent', async () => {
      planService.ensureForUser.mockResolvedValue(
        plan([
          {
            servings: 1,
            meal: {
              ingredients: [
                mi('i1', 'Tomate', 'g', 250),
                mi('i9', 'Basilic', 'g', 10),
              ],
            },
          },
        ]),
      );
      // i1 déjà présent -> seul i9 doit être inséré.
      txRepo.find.mockResolvedValue([
        derivedItem('it1', 'i1', 'g', 'Tomate', 250),
      ]);

      await service.sync('u1');

      expect(txRepo.create).toHaveBeenCalledTimes(1);
      expect(txRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ingredientId: 'i9',
          name: 'Basilic',
          quantity: 10,
          checked: false,
          source: ShoppingItemSource.DERIVED,
        }),
      );
    });

    it('does not touch the quantity of an existing item edited by the user', async () => {
      planService.ensureForUser.mockResolvedValue(
        plan([
          {
            servings: 1,
            meal: { ingredients: [mi('i1', 'Tomate', 'g', 250)] },
          },
        ]),
      );
      // Quantité éditée à 999 par l'utilisateur : le sync ne doit pas la réécrire.
      txRepo.find.mockResolvedValue([
        derivedItem('it1', 'i1', 'g', 'Tomate', 999),
      ]);

      await service.sync('u1');

      expect(txRepo.create).not.toHaveBeenCalled();
      expect(txRepo.save).not.toHaveBeenCalled();
    });

    it('never touches checked nor manual items', async () => {
      planService.ensureForUser.mockResolvedValue(
        plan([
          {
            servings: 1,
            meal: { ingredients: [mi('i1', 'Tomate', 'g', 250)] },
          },
        ]),
      );
      const checkedDerived = derivedItem('it1', 'i1', 'g', 'Tomate', 250, true);
      const manual = {
        id: 'itM',
        planId: 'p1',
        source: ShoppingItemSource.MANUAL,
        ingredientId: null,
        unit: 'lot',
        name: 'Éponges',
        quantity: 2,
        checked: true,
      };
      txRepo.find.mockResolvedValue([checkedDerived, manual]);

      await service.sync('u1');

      expect(txRepo.create).not.toHaveBeenCalled();
      expect(txRepo.save).not.toHaveBeenCalled();
      expect(txRepo.remove).not.toHaveBeenCalled();
    });

    it('is a no-op when the meals bring no new ingredient', async () => {
      planService.ensureForUser.mockResolvedValue(
        plan([
          {
            servings: 1,
            meal: { ingredients: [mi('i1', 'Tomate', 'g', 250)] },
          },
        ]),
      );
      txRepo.find.mockResolvedValue([
        derivedItem('it1', 'i1', 'g', 'Tomate', 250),
      ]);

      await service.sync('u1');

      expect(txRepo.save).not.toHaveBeenCalled();
    });

    it('compares against all current items, not only DERIVED', async () => {
      planService.ensureForUser.mockResolvedValue(
        plan([
          {
            servings: 1,
            meal: { ingredients: [mi('i1', 'Tomate', 'g', 250)] },
          },
        ]),
      );
      await service.sync('u1');
      expect(txRepo.find).toHaveBeenCalledWith({ where: { planId: 'p1' } });
    });

    it('propagates a write failure so the transaction rolls back', async () => {
      planService.ensureForUser.mockResolvedValue(
        plan([
          {
            servings: 1,
            meal: { ingredients: [mi('i1', 'Tomate', 'g', 250)] },
          },
        ]),
      );
      txRepo.find.mockResolvedValue([]);
      txRepo.save.mockRejectedValue(new Error('write failed'));

      await expect(service.sync('u1')).rejects.toThrow('write failed');
    });

    it('aggregates by ingredient + unit scaled by servings, rounded to 2 decimals', async () => {
      planService.ensureForUser.mockResolvedValue(
        plan([
          { servings: 1, meal: { ingredients: [mi('i1', 'Huile', 'l', 0.1)] } },
          { servings: 1, meal: { ingredients: [mi('i1', 'Huile', 'l', 0.2)] } },
        ]),
      );
      txRepo.find.mockResolvedValue([]);

      await service.sync('u1');

      expect(txRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 0.3 }),
      );
    });
  });

  describe('addItem', () => {
    it('creates a MANUAL item without ingredient', async () => {
      planService.ensureForUser.mockResolvedValue(plan([]));
      await service.addItem('u1', {
        name: 'Éponges',
        quantity: 2,
        unit: 'lot',
      });
      expect(items.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source: ShoppingItemSource.MANUAL,
          ingredientId: null,
          name: 'Éponges',
          quantity: 2,
          unit: 'lot',
          checked: false,
        }),
      );
    });
  });

  describe('updateItem', () => {
    it('toggles checked on a DERIVED item', async () => {
      items.findOne.mockResolvedValue(
        derivedItem('it1', 'i1', 'g', 'Tomate', 250, false),
      );
      const res = await service.updateItem('u1', 'it1', {
        checked: true,
      });
      expect(res.checked).toBe(true);
    });

    it('allows name/quantity/unit edits on a DERIVED item', async () => {
      items.findOne.mockResolvedValue(
        derivedItem('it1', 'i1', 'g', 'Tomate', 250),
      );
      const res = await service.updateItem('u1', 'it1', {
        name: 'Tomates cerises',
        quantity: 500,
        unit: 'kg',
      });
      expect(res.name).toBe('Tomates cerises');
      expect(res.quantity).toBe(500);
      expect(res.unit).toBe('kg');
    });

    it('allows content edits on a MANUAL item', async () => {
      items.findOne.mockResolvedValue({
        id: 'it9',
        planId: 'p1',
        source: ShoppingItemSource.MANUAL,
        ingredientId: null,
        unit: null,
        name: 'Éponges',
        quantity: null,
        checked: false,
      });
      const res = await service.updateItem('u1', 'it9', {
        name: 'Éponges (x2)',
        quantity: 2,
      });
      expect(res.name).toBe('Éponges (x2)');
      expect(res.quantity).toBe(2);
    });

    it('404s when the item does not belong to the user', async () => {
      items.findOne.mockResolvedValue(null);
      await expect(
        service.updateItem('u1', 'nope', { checked: true }),
      ).rejects.toThrow(NotFoundException);
    });

    // Verrouille la clause elle-même : sans `plan: { userId }`, n'importe quel
    // itemId deviendrait éditable, et le test 404 ci-dessus resterait vert.
    it('scopes the lookup to the caller via the plan relation', async () => {
      items.findOne.mockResolvedValue(
        derivedItem('it1', 'i1', 'g', 'Tomate', 250),
      );
      await service.updateItem('u1', 'it1', { checked: true });
      expect(items.findOne).toHaveBeenCalledWith({
        where: { id: 'it1', plan: { userId: 'u1' } },
      });
    });

    it('maps a unique-index violation (23505) to a 409', async () => {
      items.findOne.mockResolvedValue(
        derivedItem('it1', 'i1', 'g', 'Tomate', 250),
      );
      items.save.mockRejectedValue(
        new QueryFailedError('update', [], {
          code: '23505',
        } as unknown as Error),
      );
      await expect(
        service.updateItem('u1', 'it1', { unit: 'kg' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('removeItem', () => {
    it('removes an owned item', async () => {
      const item = derivedItem('it1', 'i1', 'g', 'Tomate', 250);
      items.findOne.mockResolvedValue(item);
      await service.removeItem('u1', 'it1');
      expect(items.remove).toHaveBeenCalledWith(item);
    });

    it('scopes the lookup to the caller via the plan relation', async () => {
      items.findOne.mockResolvedValue(
        derivedItem('it1', 'i1', 'g', 'Tomate', 250),
      );
      await service.removeItem('u1', 'it1');
      expect(items.findOne).toHaveBeenCalledWith({
        where: { id: 'it1', plan: { userId: 'u1' } },
      });
    });

    it('404s when the item does not belong to the user', async () => {
      items.findOne.mockResolvedValue(null);
      await expect(service.removeItem('u1', 'nope')).rejects.toThrow(
        NotFoundException,
      );
      expect(items.remove).not.toHaveBeenCalled();
    });
  });
});
