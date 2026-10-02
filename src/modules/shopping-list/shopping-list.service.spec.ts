import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { Unit } from '../../common/unit';
import { In } from 'typeorm';
import { lockPlan, reconcileDerived } from './derived-items';
import { ClearScope } from './dto/remove-shopping-list-items.dto';
import { ShoppingListService } from './shopping-list.service';
import { ShoppingItemSource } from './entities/shopping-list-item.entity';

jest.mock('./derived-items', () => ({
  lockPlan: jest.fn(),
  reconcileDerived: jest.fn(),
}));

const plan = () => ({
  id: 'p1',
  userId: 'u1',
  startDate: '2024-07-01',
  dayCount: 7,
  slots: [],
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
  let manager: object;
  let items: {
    count: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    manager: { transaction: jest.Mock };
  };

  beforeEach(() => {
    jest.mocked(lockPlan).mockClear();
    jest.mocked(reconcileDerived).mockReset();
    planService = { ensureForUser: jest.fn().mockResolvedValue(plan()) };
    // Délègue aux mocks du repository : les assertions restent sur `items`.
    manager = {
      findOne: jest.fn((_: unknown, options: unknown) =>
        items.findOne(options),
      ),
      save: jest.fn((x: unknown) => items.save(x)),
      update: jest.fn((_: unknown, id: unknown, patch: unknown) =>
        items.update(id, patch),
      ),
      remove: jest.fn((x: unknown) => items.remove(x)),
      delete: jest.fn(),
    };
    items = {
      count: jest.fn().mockResolvedValue(0),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn((x: unknown) => ({ ...(x as object) })),
      save: jest.fn((x: unknown) => x),
      update: jest.fn(),
      remove: jest.fn(),
      manager: {
        transaction: jest.fn(
          async (cb: (m: unknown) => unknown) => cb(manager) as unknown,
        ),
      },
    };
    service = new ShoppingListService(items as never, planService as never);
  });

  describe('forPlan', () => {
    it('reads without writing, even on an empty list', async () => {
      await service.forPlan('u1');
      expect(items.manager.transaction).not.toHaveBeenCalled();
      expect(reconcileDerived).not.toHaveBeenCalled();
    });

    it('hides dismissed items and reports how many there are', async () => {
      items.count.mockResolvedValue(3);
      const res = await service.forPlan('u1');
      expect(items.find).toHaveBeenCalledWith({
        where: { planId: 'p1', dismissed: false },
      });
      expect(items.count).toHaveBeenCalledWith({
        where: { planId: 'p1', dismissed: true },
      });
      expect(res.dismissedCount).toBe(3);
    });

    it('returns items sorted by name', async () => {
      items.find.mockResolvedValue([
        derivedItem('b', 'i2', 'g', 'Tomate', 250),
        derivedItem('a', 'i1', 'g', 'Pates', 240),
      ]);
      const res = await service.forPlan('u1');
      expect(res.items.map((i) => i.name)).toEqual(['Pates', 'Tomate']);
    });

    it('propagates a failure raised while resolving the plan', async () => {
      planService.ensureForUser.mockRejectedValue(new Error('db down'));
      await expect(service.forPlan('u1')).rejects.toThrow('db down');
    });
  });

  describe('sync', () => {
    it('reconciles under the plan lock and restores dismissed items', async () => {
      await service.sync('u1');
      expect(lockPlan).toHaveBeenCalledWith(manager, 'p1');
      expect(reconcileDerived).toHaveBeenCalledWith(manager, 'p1', {
        restoreDismissed: true,
      });
      expect(jest.mocked(lockPlan).mock.invocationCallOrder[0]).toBeLessThan(
        jest.mocked(reconcileDerived).mock.invocationCallOrder[0],
      );
    });

    it('propagates a write failure so the transaction rolls back', async () => {
      jest
        .mocked(reconcileDerived)
        .mockRejectedValue(new Error('write failed'));
      await expect(service.sync('u1')).rejects.toThrow('write failed');
    });
  });

  describe('removeItems / clear', () => {
    const managerOf = () => manager as { update: jest.Mock; delete: jest.Mock };

    it('tombstones the DERIVED and deletes the MANUAL among the given ids, under the lock', async () => {
      managerOf().update = jest.fn();
      await service.removeItems('u1', ['a', 'b']);
      expect(lockPlan).toHaveBeenCalledWith(manager, 'p1');
      expect(managerOf().update).toHaveBeenCalledWith(
        expect.anything(),
        {
          id: In(['a', 'b']),
          planId: 'p1',
          source: ShoppingItemSource.DERIVED,
          dismissed: false,
        },
        { dismissed: true },
      );
      expect(managerOf().delete).toHaveBeenCalledWith(expect.anything(), {
        id: In(['a', 'b']),
        planId: 'p1',
        source: ShoppingItemSource.MANUAL,
      });
    });

    it('narrows the clear to checked items', async () => {
      managerOf().update = jest.fn();
      await service.clear('u1', ClearScope.CHECKED);
      expect(managerOf().delete).toHaveBeenCalledWith(expect.anything(), {
        checked: true,
        planId: 'p1',
        source: ShoppingItemSource.MANUAL,
      });
    });

    it('clears every item of the plan', async () => {
      managerOf().update = jest.fn();
      await service.clear('u1', ClearScope.ALL);
      expect(managerOf().delete).toHaveBeenCalledWith(expect.anything(), {
        planId: 'p1',
        source: ShoppingItemSource.MANUAL,
      });
    });
  });

  describe('addItem', () => {
    it('creates a MANUAL item without ingredient', async () => {
      planService.ensureForUser.mockResolvedValue(plan());
      await service.addItem('u1', {
        name: 'Éponges',
        quantity: 2,
        unit: Unit.BOX,
      });
      expect(items.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source: ShoppingItemSource.MANUAL,
          ingredientId: null,
          name: 'Éponges',
          quantity: 2,
          unit: 'boîte',
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

    it('lets a DERIVED item take another unit of the closed set', async () => {
      items.findOne.mockResolvedValue(
        derivedItem('it1', 'i1', 'pièce', 'Avocat', 5),
      );
      const res = await service.updateItem('u1', 'it1', { unit: 'gousse' });
      expect(res.unit).toBe('gousse');
    });

    it('allows name/quantity edits on a DERIVED item, unit resent unchanged', async () => {
      items.findOne.mockResolvedValue(
        derivedItem('it1', 'i1', 'g', 'Tomate', 250),
      );
      const res = await service.updateItem('u1', 'it1', {
        name: 'Tomates cerises',
        quantity: 500,
        unit: 'g',
      });
      expect(res.name).toBe('Tomates cerises');
      expect(res.quantity).toBe(500);
      expect(res.unit).toBe('g');
    });

    it.each(['gousses', 'sachet', null])(
      'refuses the unit %p on a DERIVED item',
      async (unit) => {
        items.findOne.mockResolvedValue(
          derivedItem('it1', 'i1', 'pièce', 'Avocat', 5),
        );
        await expect(
          service.updateItem('u1', 'it1', { unit: unit as string }),
        ).rejects.toThrow(BadRequestException);
      },
    );

    it('409s when the new unit collides with another derived line', async () => {
      items.findOne.mockResolvedValue(
        derivedItem('it1', 'i1', 'pièce', 'Avocat', 5),
      );
      items.save.mockRejectedValue(
        new QueryFailedError('UPDATE', [], { code: '23505' } as never),
      );
      await expect(
        service.updateItem('u1', 'it1', { unit: 'g' }),
      ).rejects.toThrow(ConflictException);
    });

    const manualItem = (unit: string | null) => ({
      id: 'it9',
      planId: 'p1',
      source: ShoppingItemSource.MANUAL,
      ingredientId: null,
      unit,
      name: 'Éponges',
      quantity: 2,
      checked: false,
    });

    it('refuses a free unit on a MANUAL item', async () => {
      items.findOne.mockResolvedValue(manualItem('pièce'));
      await expect(
        service.updateItem('u1', 'it9', { unit: 'sachet' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('keeps a legacy MANUAL unit resent unchanged', async () => {
      items.findOne.mockResolvedValue(manualItem('sachet'));
      const res = await service.updateItem('u1', 'it9', {
        name: 'Éponges vertes',
        unit: 'sachet',
      });
      expect(res.unit).toBe('sachet');
    });

    it('refuses to clear the unit of a MANUAL item', async () => {
      items.findOne.mockResolvedValue(manualItem('boîte'));
      await expect(
        service.updateItem('u1', 'it9', { unit: null as unknown as string }),
      ).rejects.toThrow(BadRequestException);
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
        where: { id: 'it1', dismissed: false, plan: { userId: 'u1' } },
      });
    });
  });

  describe('removeItem', () => {
    it('dismisses a DERIVED item instead of deleting it', async () => {
      items.findOne.mockResolvedValue(
        derivedItem('it1', 'i1', 'g', 'Tomate', 250),
      );
      await service.removeItem('u1', 'it1');
      expect(items.update).toHaveBeenCalledWith('it1', { dismissed: true });
      expect(items.remove).not.toHaveBeenCalled();
    });

    it('deletes a MANUAL item', async () => {
      const item = {
        ...derivedItem('it1', 'i1', 'g', 'Éponges', 2),
        source: ShoppingItemSource.MANUAL,
      };
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
        where: { id: 'it1', dismissed: false, plan: { userId: 'u1' } },
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
