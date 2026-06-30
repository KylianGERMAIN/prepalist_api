import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MealsService } from './meals.service';

describe('MealsService', () => {
  let service: MealsService;
  let meals: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
  };
  let mealIngredients: { create: jest.Mock };
  let ingredients: { find: jest.Mock };

  beforeEach(() => {
    meals = {
      create: jest.fn((x: unknown) => x),
      save: jest.fn((x: object) => Promise.resolve({ id: 'm1', ...x })),
      findOne: jest.fn(),
      remove: jest.fn(() => Promise.resolve()),
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

  it('markCooked increments the counter and dates the meal', async () => {
    meals.findOne.mockResolvedValue({
      id: 'm1',
      userId: 'u1',
      timesCooked: 2,
      lastCookedAt: null,
    });
    const res = await service.markCooked('u1', 'm1');
    expect(res.timesCooked).toBe(3);
    expect(res.lastCookedAt).toBeInstanceOf(Date);
  });

  it('remove deletes an owned meal', async () => {
    meals.findOne.mockResolvedValue({ id: 'm1', userId: 'u1' });
    await service.remove('u1', 'm1');
    expect(meals.remove).toHaveBeenCalled();
  });
});
