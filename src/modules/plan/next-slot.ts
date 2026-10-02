import { MealSlot } from './entities/plan-slot.entity';

export interface SlotPosition {
  dayIndex: number;
  slot: MealSlot;
}

export function nextSlotOf(
  { dayIndex, slot }: SlotPosition,
  dayCount: number,
): SlotPosition | null {
  if (slot === MealSlot.LUNCH) {
    return { dayIndex, slot: MealSlot.DINNER };
  }
  return dayIndex + 1 < dayCount
    ? { dayIndex: dayIndex + 1, slot: MealSlot.LUNCH }
    : null;
}
