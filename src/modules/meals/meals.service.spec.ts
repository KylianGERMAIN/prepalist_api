import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MealsService } from './meals.service';

describe('MealsService', () => {
  let service: MealsService;
  let meals: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
    update: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let mealIngredients: { create: jest.Mock };
  let ingredients: { find: jest.Mock };

  beforeEach(() => {
    meals = {
      create: jest.fn((x: unknown) => x),
      save: jest.fn((x: object) => Promise.resolve({ id: 'm1', ...x })),
      findOne: jest.fn(),
      remove: jest.fn(() => Promise.resolve()),
      update: jest.fn(() => Promise.resolve()),
      createQueryBuilder: jest.fn(),
    };
    mealIngredients = { create: jest.fn((x: unknown) => x) };
    ingredients = { find: jest.fn() };
    service = new MealsService(
      meals as never,
      mealIngredients as never,
      ingredients as never,
    );
  });

  it('create builds a meal scoped to the user with validated ingredients', async () => {
    ingredients.find.mockResolvedValue([{ id: 'i1' }, { id: 'i2' }]);
    const meal = await service.create('u1', {
      name: 'Curry',
      ingredients: [
        { ingredientId: 'i1', quantity: 1, unit: 'g' },
        { ingredientId: 'i2', quantity: 2, unit: 'g' },
      ],
    });
    expect(meal.userId).toBe('u1');
    expect(meals.save).toHaveBeenCalled();
  });

  it('create rejects an unknown ingredient', async () => {
    ingredients.find.mockResolvedValue([{ id: 'i1' }]); // 1 trouvé sur 2 demandés
    await expect(
      service.create('u1', {
        name: 'Curry',
        ingredients: [
          { ingredientId: 'i1', quantity: 1, unit: 'g' },
          { ingredientId: 'i2', quantity: 2, unit: 'g' },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('findOne throws when the meal belongs to another user', async () => {
    meals.findOne.mockResolvedValue({ id: 'm1', userId: 'other' });
    await expect(service.findOne('u1', 'm1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('findOne throws when the meal is missing', async () => {
    meals.findOne.mockResolvedValue(null);
    await expect(service.findOne('u1', 'm1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('markCooked applies an atomic increment and dates the meal', async () => {
    meals.findOne.mockResolvedValue({ id: 'm1', userId: 'u1' });
    await service.markCooked('u1', 'm1');
    expect(meals.update).toHaveBeenCalledWith(
      'm1',
      expect.objectContaining({ lastCookedAt: expect.any(Date) }),
    );
  });

  it('remove deletes an owned meal', async () => {
    meals.findOne.mockResolvedValue({ id: 'm1', userId: 'u1' });
    await service.remove('u1', 'm1');
    expect(meals.remove).toHaveBeenCalled();
  });

  it('update replaces ingredients when the list is provided', async () => {
    meals.findOne.mockResolvedValue({
      id: 'm1',
      userId: 'u1',
      name: 'old',
      ingredients: [{ id: 'old' }],
    });
    ingredients.find.mockResolvedValue([{ id: 'i1' }]);
    await service.update('u1', 'm1', {
      name: 'new',
      ingredients: [{ ingredientId: 'i1', quantity: 1, unit: 'g' }],
    });
    const saved = meals.save.mock.calls[0][0];
    expect(saved.name).toBe('new');
    expect(saved.ingredients).toHaveLength(1);
  });

  it('update leaves ingredients untouched when omitted', async () => {
    meals.findOne.mockResolvedValue({
      id: 'm1',
      userId: 'u1',
      ingredients: [{ id: 'old' }],
    });
    await service.update('u1', 'm1', { rating: 4 });
    const saved = meals.save.mock.calls[0][0];
    expect(saved.ingredients).toEqual([{ id: 'old' }]);
    expect(saved.rating).toBe(4);
  });

  it('update rejects a duplicated ingredient', async () => {
    meals.findOne.mockResolvedValue({
      id: 'm1',
      userId: 'u1',
      ingredients: [],
    });
    await expect(
      service.update('u1', 'm1', {
        ingredients: [
          { ingredientId: 'i1', quantity: 1, unit: 'g' },
          { ingredientId: 'i1', quantity: 2, unit: 'g' },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('findAll applies one filter per provided query param', async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    meals.createQueryBuilder.mockReturnValue(qb);
    await service.findAll('u1', {
      page: 1,
      limit: 20,
      skip: 0,
      favorite: true,
      name: 'x',
      tag: 't',
    } as never);
    expect(qb.andWhere).toHaveBeenCalledTimes(3);
  });
});
