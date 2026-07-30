import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlanService } from './plan.service';
import { MealSlot } from './entities/plan-slot.entity';

const meal = (
  id: string,
  extra: Partial<{
    isFavorite: boolean;
    rating: number;
    lastCookedAt: Date | null;
  }> = {},
) => ({
  id,
  isFavorite: false,
  rating: 3,
  lastCookedAt: null,
  ...extra,
});

const slot = (
  id: string,
  dayIndex: number,
  s: MealSlot,
  mealId: string | null = null,
) => ({ id, dayIndex, slot: s, mealId, servings: 1 });

const planOf = (slots: unknown[]) => ({
  id: 'p1',
  userId: 'u1',
  startDate: '2026-06-30',
  dayCount: 7,
  slots,
});

describe('PlanService', () => {
  let service: PlanService;
  let plans: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let slots: { create: jest.Mock; save: jest.Mock; update: jest.Mock };
  let meals: { find: jest.Mock; findOne: jest.Mock };
  let items: { delete: jest.Mock };
  let users: { findById: jest.Mock };

  beforeEach(() => {
    plans = {
      findOne: jest.fn(),
      create: jest.fn((x: unknown) => ({ ...(x as object) })),
      save: jest.fn((x: unknown) => x),
    };
    slots = {
      create: jest.fn((x: unknown) => ({ ...(x as object) })),
      save: jest.fn((x: unknown) => x),
      update: jest.fn(),
    };
    meals = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn() };
    items = { delete: jest.fn() };
    users = { findById: jest.fn().mockResolvedValue({ shoppingDay: 2 }) };
    service = new PlanService(
      plans as never,
      slots as never,
      meals as never,
      items as never,
      users as never,
    );
  });

  describe('ensureForUser', () => {
    it('renvoie le plan existant sans en créer un second', async () => {
      plans.findOne.mockResolvedValue(planOf([]));
      const res = await service.ensureForUser('u1');
      expect(res.id).toBe('p1');
      expect(plans.save).not.toHaveBeenCalled();
    });

    it('cherche par utilisateur seul : aucune date en critère', async () => {
      plans.findOne.mockResolvedValue(planOf([]));
      await service.ensureForUser('u1');
      expect(plans.findOne).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    });

    it('crée un plan de 7 jours × 2 créneaux au premier accès', async () => {
      plans.findOne.mockResolvedValue(null);
      await service.ensureForUser('u1');
      const created = plans.create.mock.calls[0][0] as {
        slots: { dayIndex: number; slot: MealSlot }[];
        dayCount: number;
      };
      expect(created.dayCount).toBe(7);
      expect(created.slots).toHaveLength(14);
      expect(created.slots.map((s) => s.dayIndex)).toEqual([
        0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
      ]);
      // Jour 0 = jour de courses, midi inclus : le modèle est symétrique.
      expect(created.slots[0].slot).toBe(MealSlot.LUNCH);
      expect(created.slots[1].slot).toBe(MealSlot.DINNER);
    });

    it('ancre startDate sur le dernier jour de courses de l’utilisateur', async () => {
      plans.findOne.mockResolvedValue(null);
      users.findById.mockResolvedValue({ shoppingDay: 2 }); // mardi
      await service.ensureForUser('u1');
      const { startDate } = plans.create.mock.calls[0][0] as {
        startDate: string;
      };
      // Un mardi, quelle que soit la date du jour où tourne le test.
      expect(new Date(`${startDate}T00:00:00Z`).getUTCDay()).toBe(2);
    });
  });

  describe('generate', () => {
    it('refuse de générer sans aucune recette', async () => {
      plans.findOne.mockResolvedValue(planOf([]));
      meals.find.mockResolvedValue([]);
      await expect(service.generate('u1')).rejects.toThrow(BadRequestException);
    });

    it('préserve les créneaux déjà assignés et ne remplit que les vides', async () => {
      const assigned = slot('s1', 0, MealSlot.LUNCH, 'm-fixed');
      const empty = slot('s2', 0, MealSlot.DINNER);
      plans.findOne.mockResolvedValue(planOf([assigned, empty]));
      meals.find.mockResolvedValue([meal('m1')]);

      await service.generate('u1');

      const saved = slots.save.mock.calls[0][0] as { id: string }[];
      expect(saved.map((s) => s.id)).toEqual(['s2']);
      expect(assigned.mealId).toBe('m-fixed');
    });

    it('n’écrit que les colonnes id et mealId des créneaux modifiés', async () => {
      plans.findOne.mockResolvedValue(planOf([slot('s1', 0, MealSlot.LUNCH)]));
      meals.find.mockResolvedValue([meal('m1')]);

      await service.generate('u1');

      const saved = slots.save.mock.calls[0][0] as Record<string, unknown>[];
      expect(Object.keys(saved[0]).sort()).toEqual(['id', 'mealId']);
    });

    it('peut reprendre le dîner du jour J au déjeuner du jour J+1 (restes)', async () => {
      const dinner = slot('s1', 0, MealSlot.DINNER, 'm-dinner');
      const nextLunch = slot('s2', 1, MealSlot.LUNCH);
      plans.findOne.mockResolvedValue(planOf([dinner, nextLunch]));
      meals.find.mockResolvedValue([meal('m1')]);
      // Force le tirage "restes" (probabilité 0.5).
      const random = jest.spyOn(Math, 'random').mockReturnValue(0);

      await service.generate('u1');

      expect(nextLunch.mealId).toBe('m-dinner');
      random.mockRestore();
    });
  });

  describe('updateSlot', () => {
    it('404 quand le créneau n’appartient pas au plan de l’utilisateur', async () => {
      plans.findOne.mockResolvedValue(planOf([slot('s1', 0, MealSlot.LUNCH)]));
      await expect(
        service.updateSlot('u1', 'inconnu', { servings: 2 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuse un mealId inexistant', async () => {
      plans.findOne.mockResolvedValue(planOf([slot('s1', 0, MealSlot.LUNCH)]));
      meals.findOne.mockResolvedValue(null);
      await expect(
        service.updateSlot('u1', 's1', { mealId: 'nope' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepte mealId null pour vider le créneau, sans vérifier de repas', async () => {
      plans.findOne.mockResolvedValue(
        planOf([slot('s1', 0, MealSlot.LUNCH, 'm1')]),
      );
      await service.updateSlot('u1', 's1', { mealId: null });
      expect(meals.findOne).not.toHaveBeenCalled();
      expect(slots.update).toHaveBeenCalledWith('s1', { mealId: null });
    });
  });

  describe('clearSlots', () => {
    it('vide les repas du plan et purge la liste de courses', async () => {
      plans.findOne.mockResolvedValue(planOf([slot('s1', 0, MealSlot.LUNCH)]));
      await service.clearSlots('u1');
      expect(slots.update).toHaveBeenCalledWith(
        { planId: 'p1' },
        { mealId: null },
      );
      expect(items.delete).toHaveBeenCalledWith({ planId: 'p1' });
    });
  });
});
