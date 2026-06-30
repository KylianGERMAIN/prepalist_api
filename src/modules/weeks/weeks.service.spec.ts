import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { MealSlot } from './entities/week-slot.entity';
import { WeeksService } from './weeks.service';

type TestSlot = {
  id: string;
  date: string;
  slot: MealSlot;
  mealId: string | null;
};

function buildEmptySlots(): TestSlot[] {
  const slots: TestSlot[] = [];
  const start = '2024-07-01';
  for (let d = 0; d < 7; d++) {
    const date = new Date(`${start}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + d);
    const iso = date.toISOString().slice(0, 10);
    for (const slot of [MealSlot.LUNCH, MealSlot.DINNER]) {
      slots.push({ id: `${iso}-${slot}`, date: iso, slot, mealId: null });
    }
  }
  return slots;
}

describe('WeeksService', () => {
  let service: WeeksService;
  let weeks: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let slots: { create: jest.Mock; save: jest.Mock; update: jest.Mock };
  let meals: { find: jest.Mock; findOne: jest.Mock };

  beforeEach(() => {
    weeks = {
      findOne: jest.fn(),
      create: jest.fn((x: unknown) => x),
      save: jest.fn((x: object) => Promise.resolve({ id: 'w1', ...x })),
    };
    slots = {
      create: jest.fn((x: unknown) => x),
      save: jest.fn((x: unknown) => Promise.resolve(x)),
      update: jest.fn(() => Promise.resolve()),
    };
    meals = { find: jest.fn(), findOne: jest.fn() };
    service = new WeeksService(weeks as never, slots as never, meals as never);
  });

  it('create builds 14 slots starting on the Monday', async () => {
    weeks.findOne.mockResolvedValue(null);
    await service.create('u1', { startDate: '2024-07-03' });
    const saved = weeks.save.mock.calls[0][0];
    expect(saved.startDate).toBe('2024-07-01');
    expect(saved.slots).toHaveLength(14);
  });

  it('create throws when a week already exists for the period', async () => {
    weeks.findOne.mockResolvedValue({ id: 'w1' });
    await expect(service.create('u1', {})).rejects.toThrow(ConflictException);
  });

  it('findCurrent throws when none exists', async () => {
    weeks.findOne.mockResolvedValue(null);
    await expect(service.findCurrent('u1')).rejects.toThrow(NotFoundException);
  });

  it('findOne throws when the week belongs to another user', async () => {
    weeks.findOne.mockResolvedValue({ id: 'w1', userId: 'other' });
    await expect(service.findOne('u1', 'w1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('generate fills every slot with a candidate meal', async () => {
    const weekSlots = buildEmptySlots();
    weeks.findOne.mockResolvedValue({
      id: 'w1',
      userId: 'u1',
      slots: weekSlots,
    });
    meals.find.mockResolvedValue([
      { id: 'm1', isFavorite: true, rating: 5, lastCookedAt: null },
      { id: 'm2', isFavorite: false, rating: 3, lastCookedAt: null },
    ]);
    await service.generate('u1', 'w1');
    expect(
      weekSlots.every(
        (s) => s.mealId !== null && ['m1', 'm2'].includes(s.mealId),
      ),
    ).toBe(true);
    expect(slots.save).toHaveBeenCalled();
  });

  it('generate throws when the user has no meals', async () => {
    weeks.findOne.mockResolvedValue({ id: 'w1', userId: 'u1', slots: [] });
    meals.find.mockResolvedValue([]);
    await expect(service.generate('u1', 'w1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('updateSlot assigns an owned meal and servings', async () => {
    const slot = { id: 's1', mealId: null, servings: 1 };
    weeks.findOne.mockResolvedValue({ id: 'w1', userId: 'u1', slots: [slot] });
    meals.findOne.mockResolvedValue({ id: 'm1', userId: 'u1' });
    await service.updateSlot('u1', 'w1', 's1', { mealId: 'm1', servings: 2 });
    expect(slots.update).toHaveBeenCalledWith('s1', {
      mealId: 'm1',
      servings: 2,
    });
  });

  it('updateSlot clears the meal when mealId is null', async () => {
    const slot = { id: 's1', mealId: 'm1', servings: 1 };
    weeks.findOne.mockResolvedValue({ id: 'w1', userId: 'u1', slots: [slot] });
    await service.updateSlot('u1', 'w1', 's1', { mealId: null });
    expect(slots.update).toHaveBeenCalledWith('s1', { mealId: null });
  });

  it('updateSlot rejects a meal owned by another user', async () => {
    const slot = { id: 's1', mealId: null, servings: 1 };
    weeks.findOne.mockResolvedValue({ id: 'w1', userId: 'u1', slots: [slot] });
    meals.findOne.mockResolvedValue({ id: 'm1', userId: 'other' });
    await expect(
      service.updateSlot('u1', 'w1', 's1', { mealId: 'm1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('updateSlot throws when the slot is missing', async () => {
    weeks.findOne.mockResolvedValue({ id: 'w1', userId: 'u1', slots: [] });
    await expect(
      service.updateSlot('u1', 'w1', 'sX', { servings: 2 }),
    ).rejects.toThrow(NotFoundException);
  });
});
