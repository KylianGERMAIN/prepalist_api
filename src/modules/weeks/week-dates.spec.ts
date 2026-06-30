import { addDays, startOfWeek } from './week-dates';

describe('week-dates', () => {
  it('startOfWeek returns Monday for a mid-week date', () => {
    // 2024-07-03 = mercredi -> lundi 2024-07-01
    expect(startOfWeek(new Date('2024-07-03T12:00:00Z'))).toBe('2024-07-01');
  });

  it('startOfWeek maps Sunday to the previous Monday', () => {
    // 2024-07-07 = dimanche -> 2024-07-01
    expect(startOfWeek(new Date('2024-07-07T12:00:00Z'))).toBe('2024-07-01');
  });

  it('startOfWeek of a Monday is itself', () => {
    expect(startOfWeek(new Date('2024-07-01T00:00:00Z'))).toBe('2024-07-01');
  });

  it('addDays crosses month and year boundaries', () => {
    expect(addDays('2024-07-31', 1)).toBe('2024-08-01');
    expect(addDays('2024-07-01', -1)).toBe('2024-06-30');
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01');
  });
});
