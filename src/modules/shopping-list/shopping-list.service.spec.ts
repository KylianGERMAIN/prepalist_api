import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { Unit } from '../../common/unit';
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
  let planService: {
    ensureForUser: jest.Mock;
    ensureForUserWithIngredients: jest.Mock;
  };
  let txRepo: {
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
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
    planService = {
      ensureForUser: jest.fn(),
      ensureForUserWithIngredients: jest.fn(),
    };
    // Même plan aux deux profondeurs par défaut ; le test « agrège depuis la
    // lecture profonde » les dissocie, c'est lui qui verrouille le chargement.
    planService.ensureForUserWithIngredients.mockImplementation(() =>
      planService.ensureForUser(),
    );
    txRepo = {
      create: jest.fn((x: unknown) => ({ ...(x as object) })),
      save: jest.fn((x: unknown) => x),
      delete: jest.fn(),
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

    // Sans cette dissociation, revenir au plan peu profond garderait la suite
    // verte pendant que la liste sortirait vide en prod (`ingredients ?? []`).
    it('aggregates from the deep read, not from the plan without ingredients', async () => {
      planService.ensureForUser.mockResolvedValue(
        plan([{ servings: 1, meal: {} }]),
      );
      planService.ensureForUserWithIngredients.mockResolvedValue(
        plan([
          {
            servings: 1,
            meal: { ingredients: [mi('i1', 'Tomate', 'g', 250)] },
          },
        ]),
      );
      items.count.mockResolvedValue(0);

      await service.forPlan('u1');

      expect(txRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ ingredientId: 'i1', quantity: 250 }),
      );
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

  describe('sync (rewrite)', () => {
    const tomatoPlan = () =>
      plan([
        {
          servings: 1,
          meal: { ingredients: [mi('i1', 'Tomate', 'g', 250)] },
        },
      ]);

    it('deletes only the DERIVED items of the plan, never the MANUAL ones', async () => {
      planService.ensureForUser.mockResolvedValue(tomatoPlan());

      await service.sync('u1');

      expect(txRepo.delete).toHaveBeenCalledWith({
        planId: 'p1',
        source: ShoppingItemSource.DERIVED,
      });
    });

    it('recreates every line from the meals, unchecked, with the recipe unit', async () => {
      planService.ensureForUser.mockResolvedValue(tomatoPlan());

      await service.sync('u1');

      expect(txRepo.create).toHaveBeenCalledWith({
        planId: 'p1',
        source: ShoppingItemSource.DERIVED,
        ingredientId: 'i1',
        name: 'Tomate',
        unit: 'g',
        quantity: 250,
        checked: false,
      });
      expect(txRepo.delete.mock.invocationCallOrder[0]).toBeLessThan(
        txRepo.save.mock.invocationCallOrder[0],
      );
    });

    it('empties the derived items when the plan has no meal left', async () => {
      planService.ensureForUser.mockResolvedValue(plan([]));

      await service.sync('u1');

      expect(txRepo.delete).toHaveBeenCalled();
      expect(txRepo.save).not.toHaveBeenCalled();
    });

    it('swallows the unique violation of a concurrent sync, then reads', async () => {
      planService.ensureForUser.mockResolvedValue(tomatoPlan());
      txRepo.save.mockRejectedValue(
        new QueryFailedError('INSERT', [], { code: '23505' } as never),
      );

      await expect(service.sync('u1')).resolves.toBeDefined();
      expect(items.find).toHaveBeenCalledWith({ where: { planId: 'p1' } });
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
        where: { id: 'it1', plan: { userId: 'u1' } },
      });
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
