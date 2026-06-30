import { ConflictException } from '@nestjs/common';
import { IngredientsService } from './ingredients.service';

describe('IngredientsService', () => {
  let service: IngredientsService;
  let repo: {
    find: jest.Mock;
    createQueryBuilder: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  /** Stub le pré-check createQueryBuilder().where().getOne(). */
  function mockExisting(existing: unknown) {
    repo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(existing),
    });
  }

  beforeEach(() => {
    repo = {
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
      create: jest.fn((x: unknown) => x),
      save: jest.fn((x: object) => Promise.resolve({ id: 'i1', ...x })),
    };
    service = new IngredientsService(repo as never);
  });

  it('search applies a name filter when a term is given', async () => {
    repo.find.mockResolvedValue([]);
    await service.search('tom');
    expect(repo.find.mock.calls[0][0].where).toBeDefined();
  });

  it('search without term lists all', async () => {
    repo.find.mockResolvedValue([]);
    await service.search();
    expect(repo.find.mock.calls[0][0].where).toEqual({});
  });

  it('create throws on a case-insensitive duplicate name', async () => {
    mockExisting({ id: 'i1' });
    await expect(service.create({ name: 'Tomate' })).rejects.toThrow(
      ConflictException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('create trims and persists a new ingredient', async () => {
    mockExisting(null);
    const ing = await service.create({ name: ' Tomate ', defaultUnit: 'g' });
    expect(repo.save).toHaveBeenCalled();
    expect(ing.name).toBe('Tomate');
  });

  it('create maps a unique-violation race (23505) to ConflictException', async () => {
    mockExisting(null);
    repo.save.mockRejectedValue({ driverError: { code: '23505' } });
    await expect(service.create({ name: 'Tomate' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('create rethrows non-unique DB errors', async () => {
    mockExisting(null);
    repo.save.mockRejectedValue(new Error('connection lost'));
    await expect(service.create({ name: 'Tomate' })).rejects.toThrow(
      'connection lost',
    );
  });
});
