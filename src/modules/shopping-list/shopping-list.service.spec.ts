import { NotFoundException } from '@nestjs/common';
import { ShoppingListService } from './shopping-list.service';

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

describe('ShoppingListService', () => {
  let service: ShoppingListService;
  let weeks: { findOne: jest.Mock };

  beforeEach(() => {
    weeks = { findOne: jest.fn() };
    service = new ShoppingListService(weeks as never);
  });

  it('throws when the week belongs to another user', async () => {
    weeks.findOne.mockResolvedValue({ id: 'w1', userId: 'other', slots: [] });
    await expect(service.forWeek('u1', 'w1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns empty items when no slot has a meal', async () => {
    weeks.findOne.mockResolvedValue({
      id: 'w1',
      userId: 'u1',
      startDate: '2024-07-01',
      slots: [{ servings: 1, meal: null }],
    });
    const res = await service.forWeek('u1', 'w1');
    expect(res.items).toEqual([]);
  });

  it('aggregates by ingredient + unit, scaled by servings, sorted by name', async () => {
    weeks.findOne.mockResolvedValue({
      id: 'w1',
      userId: 'u1',
      startDate: '2024-07-01',
      slots: [
        {
          servings: 2,
          meal: {
            ingredients: [
              mi('i1', 'Tomate', 'g', 100),
              mi('i2', 'Pates', 'g', 120),
            ],
          },
        },
        { servings: 1, meal: { ingredients: [mi('i1', 'Tomate', 'g', 50)] } },
      ],
    });
    const res = await service.forWeek('u1', 'w1');
    expect(res.items.find((i) => i.ingredientId === 'i1')?.quantity).toBe(250);
    expect(res.items.find((i) => i.ingredientId === 'i2')?.quantity).toBe(240);
    expect(res.items.map((i) => i.name)).toEqual(['Pates', 'Tomate']);
  });

  it('keeps different units of the same ingredient separate', async () => {
    weeks.findOne.mockResolvedValue({
      id: 'w1',
      userId: 'u1',
      startDate: '2024-07-01',
      slots: [
        {
          servings: 1,
          meal: {
            ingredients: [
              mi('i1', 'Lait', 'ml', 200),
              mi('i1', 'Lait', 'cl', 5),
            ],
          },
        },
      ],
    });
    const res = await service.forWeek('u1', 'w1');
    expect(res.items).toHaveLength(2);
    expect(res.items.find((i) => i.unit === 'ml')?.quantity).toBe(200);
    expect(res.items.find((i) => i.unit === 'cl')?.quantity).toBe(5);
  });

  it('rounds float accumulation to 2 decimals', async () => {
    weeks.findOne.mockResolvedValue({
      id: 'w1',
      userId: 'u1',
      startDate: '2024-07-01',
      slots: [
        { servings: 1, meal: { ingredients: [mi('i1', 'Huile', 'l', 0.1)] } },
        { servings: 1, meal: { ingredients: [mi('i1', 'Huile', 'l', 0.2)] } },
      ],
    });
    const res = await service.forWeek('u1', 'w1');
    expect(res.items[0].quantity).toBe(0.3); // et non 0.30000000000000004
  });
});
