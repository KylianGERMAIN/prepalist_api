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

  it('anchors on Europe/Paris: Sunday 23:00 UTC is already Monday in Paris', () => {
    // 2024-07-07 23:00 UTC = 2024-07-08 01:00 à Paris (été, UTC+2) -> lundi 08
    expect(startOfWeek(new Date('2024-07-07T23:00:00Z'))).toBe('2024-07-08');
  });

  it('startOfWeek with a Tuesday shopping day returns the previous Tuesday', () => {
    // 2024-07-04 = jeudi, shoppingDay=2 (mardi) -> mardi 2024-07-02
    expect(startOfWeek(new Date('2024-07-04T12:00:00Z'), 2)).toBe('2024-07-02');
  });

  it('startOfWeek on the shopping day itself returns that day', () => {
    // 2024-07-02 = mardi, shoppingDay=2 -> lui-même
    expect(startOfWeek(new Date('2024-07-02T12:00:00Z'), 2)).toBe('2024-07-02');
  });

  it('startOfWeek with a Sunday shopping day (0) wraps correctly', () => {
    // 2024-07-04 = jeudi, shoppingDay=0 (dimanche) -> dimanche 2024-06-30
    expect(startOfWeek(new Date('2024-07-04T12:00:00Z'), 0)).toBe('2024-06-30');
  });

  it('addDays crosses month and year boundaries', () => {
    expect(addDays('2024-07-31', 1)).toBe('2024-08-01');
    expect(addDays('2024-07-01', -1)).toBe('2024-06-30');
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01');
  });
});
