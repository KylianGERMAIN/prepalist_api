import { BadRequestException, NotFoundException } from '@nestjs/common';
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

const week = (slots: unknown[]) => ({
  id: 'w1',
  userId: 'u1',
  startDate: '2024-07-01',
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
  weekId: 'w1',
  source: ShoppingItemSource.DERIVED,
  ingredientId,
  unit,
  name,
  quantity,
  checked,
});

describe('ShoppingListService', () => {
  let service: ShoppingListService;
  let weeks: { findOne: jest.Mock };
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
    weeks = { findOne: jest.fn() };
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
    service = new ShoppingListService(items as never, weeks as never);
  });

  describe('forWeek (lazy init)', () => {
    it('syncs when no derived line exists yet, then reads', async () => {
      weeks.findOne.mockResolvedValue(week([]));
      items.count.mockResolvedValue(0);
      await service.forWeek('u1', 'w1');
      expect(items.count).toHaveBeenCalledWith({
        where: { weekId: 'w1', source: ShoppingItemSource.DERIVED },
      });
      expect(items.manager.transaction).toHaveBeenCalledTimes(1);
      expect(items.find).toHaveBeenCalled();
    });

    it('syncs on a manual-first week (a MANUAL row exists but no DERIVED yet)', async () => {
      // Le count ne porte que sur les DERIVED : la présence d'un item manuel
      // ne doit pas court-circuiter la première matérialisation des plats.
      weeks.findOne.mockResolvedValue(week([]));
      items.count.mockResolvedValue(0);
      await service.forWeek('u1', 'w1');
      expect(items.manager.transaction).toHaveBeenCalledTimes(1);
    });

    it('does not sync when derived items already exist', async () => {
      weeks.findOne.mockResolvedValue(week([]));
      items.count.mockResolvedValue(3);
      await service.forWeek('u1', 'w1');
      expect(items.manager.transaction).not.toHaveBeenCalled();
    });

    it('propagates the 404 from an unowned week', async () => {
      weeks.findOne.mockRejectedValue(new NotFoundException());
      await expect(service.forWeek('u1', 'w1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns items sorted by name', async () => {
      weeks.findOne.mockResolvedValue(week([]));
      items.count.mockResolvedValue(2);
      items.find.mockResolvedValue([
        derivedItem('b', 'i2', 'g', 'Tomate', 250),
        derivedItem('a', 'i1', 'g', 'Pates', 240),
      ]);
      const res = await service.forWeek('u1', 'w1');
      expect(res.items.map((i) => i.name)).toEqual(['Pates', 'Tomate']);
    });
  });

  describe('sync (idempotent diff)', () => {
    it('is a no-op on re-sync without change and keeps checked', async () => {
      weeks.findOne.mockResolvedValue(
        week([
          {
            servings: 2,
            meal: { ingredients: [mi('i1', 'Tomate', 'g', 125)] },
          },
        ]),
      );
      txRepo.find.mockResolvedValue([
        derivedItem('it1', 'i1', 'g', 'Tomate', 250, true),
      ]);

      await service.sync('u1', 'w1');

      const saved = txRepo.save.mock.calls[0][0] as Array<{
        id: string;
        quantity: number;
        checked: boolean;
      }>;
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({
        id: 'it1',
        quantity: 250,
        checked: true,
      });
      expect(txRepo.remove).not.toHaveBeenCalled();
      expect(txRepo.create).not.toHaveBeenCalled();
    });

    it('updates quantity/name of a still-present derived line, preserving checked', async () => {
      weeks.findOne.mockResolvedValue(
        week([
          {
            servings: 1,
            meal: { ingredients: [mi('i1', 'Tomate', 'g', 250)] },
          },
        ]),
      );
      txRepo.find.mockResolvedValue([
        derivedItem('it1', 'i1', 'g', 'Tomate', 100, true),
      ]);

      await service.sync('u1', 'w1');

      const saved = txRepo.save.mock.calls[0][0] as Array<{
        quantity: number;
        checked: boolean;
      }>;
      expect(saved[0]).toMatchObject({ quantity: 250, checked: true });
    });

    it('inserts new ingredients as unchecked', async () => {
      weeks.findOne.mockResolvedValue(
        week([
          {
            servings: 1,
            meal: { ingredients: [mi('i9', 'Basilic', 'g', 10)] },
          },
        ]),
      );
      txRepo.find.mockResolvedValue([]);

      await service.sync('u1', 'w1');

      expect(txRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ingredientId: 'i9',
          name: 'Basilic',
          unit: 'g',
          quantity: 10,
          checked: false,
          source: ShoppingItemSource.DERIVED,
        }),
      );
    });

    it('deletes derived lines no longer produced by the meals', async () => {
      weeks.findOne.mockResolvedValue(
        week([
          {
            servings: 1,
            meal: { ingredients: [mi('i1', 'Tomate', 'g', 250)] },
          },
        ]),
      );
      const orphan = derivedItem('it2', 'i2', 'g', 'Pates', 240);
      txRepo.find.mockResolvedValue([
        derivedItem('it1', 'i1', 'g', 'Tomate', 250),
        orphan,
      ]);

      await service.sync('u1', 'w1');

      expect(txRepo.remove).toHaveBeenCalledWith([orphan]);
    });

    it('only reads DERIVED rows, leaving MANUAL untouched', async () => {
      weeks.findOne.mockResolvedValue(week([]));
      txRepo.find.mockResolvedValue([]);

      await service.sync('u1', 'w1');

      expect(txRepo.find).toHaveBeenCalledWith({
        where: { weekId: 'w1', source: ShoppingItemSource.DERIVED },
      });
      expect(txRepo.remove).not.toHaveBeenCalled();
    });

    it('propagates a write failure so the transaction rolls back', async () => {
      weeks.findOne.mockResolvedValue(
        week([
          {
            servings: 1,
            meal: { ingredients: [mi('i1', 'Tomate', 'g', 250)] },
          },
        ]),
      );
      txRepo.find.mockResolvedValue([]);
      txRepo.save.mockRejectedValue(new Error('write failed'));

      await expect(service.sync('u1', 'w1')).rejects.toThrow('write failed');
    });

    it('aggregates by ingredient + unit scaled by servings, rounded to 2 decimals', async () => {
      weeks.findOne.mockResolvedValue(
        week([
          { servings: 1, meal: { ingredients: [mi('i1', 'Huile', 'l', 0.1)] } },
          { servings: 1, meal: { ingredients: [mi('i1', 'Huile', 'l', 0.2)] } },
        ]),
      );
      txRepo.find.mockResolvedValue([]);

      await service.sync('u1', 'w1');

      expect(txRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 0.3 }),
      );
    });
  });

  describe('addItem', () => {
    it('creates a MANUAL item without ingredient', async () => {
      weeks.findOne.mockResolvedValue(week([]));
      await service.addItem('u1', 'w1', {
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
      weeks.findOne.mockResolvedValue(week([]));
      items.findOne.mockResolvedValue(
        derivedItem('it1', 'i1', 'g', 'Tomate', 250, false),
      );
      const res = await service.updateItem('u1', 'w1', 'it1', {
        checked: true,
      });
      expect(res.checked).toBe(true);
    });

    it('rejects content edits on a DERIVED item', async () => {
      weeks.findOne.mockResolvedValue(week([]));
      items.findOne.mockResolvedValue(
        derivedItem('it1', 'i1', 'g', 'Tomate', 250),
      );
      await expect(
        service.updateItem('u1', 'w1', 'it1', { name: 'Autre' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows content edits on a MANUAL item', async () => {
      weeks.findOne.mockResolvedValue(week([]));
      items.findOne.mockResolvedValue({
        id: 'it9',
        weekId: 'w1',
        source: ShoppingItemSource.MANUAL,
        ingredientId: null,
        unit: null,
        name: 'Éponges',
        quantity: null,
        checked: false,
      });
      const res = await service.updateItem('u1', 'w1', 'it9', {
        name: 'Éponges (x2)',
        quantity: 2,
      });
      expect(res.name).toBe('Éponges (x2)');
      expect(res.quantity).toBe(2);
    });

    it('404s when the item does not belong to the week', async () => {
      weeks.findOne.mockResolvedValue(week([]));
      items.findOne.mockResolvedValue(null);
      await expect(
        service.updateItem('u1', 'w1', 'nope', { checked: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeItem', () => {
    it('removes an owned item', async () => {
      weeks.findOne.mockResolvedValue(week([]));
      const item = derivedItem('it1', 'i1', 'g', 'Tomate', 250);
      items.findOne.mockResolvedValue(item);
      await service.removeItem('u1', 'w1', 'it1');
      expect(items.remove).toHaveBeenCalledWith(item);
    });
  });
});
