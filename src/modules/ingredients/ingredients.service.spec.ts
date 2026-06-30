import { ConflictException } from '@nestjs/common';
import { IngredientsService } from './ingredients.service';

describe('IngredientsService', () => {
  let service: IngredientsService;
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(() => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
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

  it('create throws on a duplicate name', async () => {
    repo.findOne.mockResolvedValue({ id: 'i1' });
    await expect(service.create({ name: 'Tomate' })).rejects.toThrow(
      ConflictException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('create trims and persists a new ingredient', async () => {
    repo.findOne.mockResolvedValue(null);
    const ing = await service.create({ name: ' Tomate ', defaultUnit: 'g' });
    expect(repo.save).toHaveBeenCalled();
    expect(ing.name).toBe('Tomate');
  });
});
