import { MealSlot } from './entities/plan-slot.entity';
import { nextSlotOf } from './next-slot';

describe('nextSlotOf', () => {
  it('passe du midi au soir du même jour', () => {
    expect(nextSlotOf({ dayIndex: 3, slot: MealSlot.LUNCH }, 7)).toEqual({
      dayIndex: 3,
      slot: MealSlot.DINNER,
    });
  });

  it('passe du soir au midi du lendemain', () => {
    expect(nextSlotOf({ dayIndex: 3, slot: MealSlot.DINNER }, 7)).toEqual({
      dayIndex: 4,
      slot: MealSlot.LUNCH,
    });
  });

  it('n’a rien après le dernier dîner du plan', () => {
    expect(nextSlotOf({ dayIndex: 6, slot: MealSlot.DINNER }, 7)).toBeNull();
  });

  it('a encore un dîner après le dernier midi', () => {
    expect(nextSlotOf({ dayIndex: 6, slot: MealSlot.LUNCH }, 7)).toEqual({
      dayIndex: 6,
      slot: MealSlot.DINNER,
    });
  });
});
