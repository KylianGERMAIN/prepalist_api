import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let repo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };

  beforeEach(() => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn((x: unknown) => x),
      save: jest.fn((x: object) => Promise.resolve({ id: '1', ...x })),
    };
    service = new UsersService(repo as never);
  });

  it('create throws on a duplicate email', async () => {
    repo.findOne.mockResolvedValue({ id: '1' });
    await expect(service.create('a@b.c', 'hash')).rejects.toThrow(
      ConflictException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('create persists a new user', async () => {
    repo.findOne.mockResolvedValue(null);
    const user = await service.create('a@b.c', 'hash');
    expect(repo.save).toHaveBeenCalled();
    expect(user.email).toBe('a@b.c');
  });

  it('findById throws when missing', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findById('nope')).rejects.toThrow(NotFoundException);
  });
});
