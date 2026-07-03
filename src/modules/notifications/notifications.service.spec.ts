import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let users: { find: jest.Mock };
  let weeks: { findOne: jest.Mock };

  beforeEach(() => {
    users = { find: jest.fn() };
    weeks = { findOne: jest.fn() };
    service = new NotificationsService(users as never, weeks as never);
  });

  it('reminds only users without an upcoming week', async () => {
    users.find.mockResolvedValue([
      { id: 'u1', email: 'a@t.dev', shoppingDay: 1 },
      { id: 'u2', email: 'b@t.dev', shoppingDay: 1 },
      { id: 'u3', email: 'c@t.dev', shoppingDay: 1 },
    ]);
    // seul u2 a planifié la semaine à venir
    weeks.findOne.mockImplementation(
      ({ where }: { where: { userId: string } }) =>
        Promise.resolve(where.userId === 'u2' ? { id: 'w' } : null),
    );
    expect(await service.sendWeeklyReminders()).toBe(2);
  });

  it('reminds nobody when every user has planned', async () => {
    users.find.mockResolvedValue([
      { id: 'u1', email: 'a@t.dev', shoppingDay: 1 },
    ]);
    weeks.findOne.mockResolvedValue({ id: 'w' });
    expect(await service.sendWeeklyReminders()).toBe(0);
  });

  it('targets the next start per shopping day (clock frozen on a Sunday)', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-07-07T18:00:00Z')); // dimanche
    users.find.mockResolvedValue([
      { id: 'u1', email: 'a@t.dev', shoppingDay: 1 },
    ]);
    weeks.findOne.mockResolvedValue(null);
    try {
      await service.sendWeeklyReminders();
    } finally {
      jest.useRealTimers();
    }
    // shoppingDay lundi : semaine courante 2024-07-01 -> à venir 2024-07-08
    expect(weeks.findOne.mock.calls[0][0].where).toEqual({
      userId: 'u1',
      startDate: '2024-07-08',
    });
  });

  it('shifts the target when the shopping day is Tuesday', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-07-07T18:00:00Z')); // dimanche
    users.find.mockResolvedValue([
      { id: 'u1', email: 'a@t.dev', shoppingDay: 2 },
    ]);
    weeks.findOne.mockResolvedValue(null);
    try {
      await service.sendWeeklyReminders();
    } finally {
      jest.useRealTimers();
    }
    // shoppingDay mardi : semaine courante 2024-07-02 -> à venir 2024-07-09
    expect(weeks.findOne.mock.calls[0][0].where.startDate).toBe('2024-07-09');
  });
});
