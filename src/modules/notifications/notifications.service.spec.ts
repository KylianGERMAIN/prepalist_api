import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let users: { find: jest.Mock };
  let weeks: { find: jest.Mock };

  beforeEach(() => {
    users = { find: jest.fn() };
    weeks = { find: jest.fn() };
    service = new NotificationsService(users as never, weeks as never);
  });

  it('reminds only users without an upcoming week', async () => {
    users.find.mockResolvedValue([
      { id: 'u1', email: 'a@t.dev' },
      { id: 'u2', email: 'b@t.dev' },
      { id: 'u3', email: 'c@t.dev' },
    ]);
    weeks.find.mockResolvedValue([{ userId: 'u2' }]); // seul u2 a planifié
    expect(await service.sendWeeklyReminders()).toBe(2);
  });

  it('reminds nobody when every user has planned', async () => {
    users.find.mockResolvedValue([{ id: 'u1', email: 'a@t.dev' }]);
    weeks.find.mockResolvedValue([{ userId: 'u1' }]);
    expect(await service.sendWeeklyReminders()).toBe(0);
  });

  it('targets the upcoming Monday', async () => {
    users.find.mockResolvedValue([]);
    weeks.find.mockResolvedValue([]);
    await service.sendWeeklyReminders();
    const where = weeks.find.mock.calls[0][0].where;
    // startDate doit être un lundi (YYYY-MM-DD) dans le futur
    expect(new Date(`${where.startDate}T00:00:00Z`).getUTCDay()).toBe(1);
  });
});
