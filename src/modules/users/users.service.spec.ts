import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { In } from 'typeorm';
import { UserRole } from './entities/user.entity';
import { UsersService } from './users.service';

const configWith = (adminEmails?: string) =>
  ({ get: () => adminEmails }) as unknown as ConfigService;

describe('UsersService', () => {
  let service: UsersService;
  let repo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };

  beforeEach(() => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn((x: unknown) => x),
      save: jest.fn((x: object) => Promise.resolve({ id: '1', ...x })),
      update: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    service = new UsersService(repo as never, configWith());
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

  it('updateShoppingDay persists the new day', async () => {
    repo.findOne.mockResolvedValue({ id: '1', shoppingDay: 1 });
    const user = await service.updateShoppingDay('1', 2);
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ shoppingDay: 2 }),
    );
    expect(user.shoppingDay).toBe(2);
  });

  it('updateShoppingDay throws when the user is missing', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.updateShoppingDay('nope', 2)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('create registers a listed admin email as USER: register proves no ownership', async () => {
    service = new UsersService(repo as never, configWith('boss@prepa.list'));
    repo.findOne.mockResolvedValue(null);
    const user = await service.create('boss@prepa.list', 'hash');
    expect(user.role).toBe(UserRole.USER);
  });

  it('bootstrap promotes existing listed accounts', async () => {
    service = new UsersService(
      repo as never,
      configWith('Boss@Prepa.List,other@x.y'),
    );
    await service.onApplicationBootstrap();
    expect(repo.update).toHaveBeenCalledWith(
      { email: In(['boss@prepa.list', 'other@x.y']), role: UserRole.USER },
      { role: UserRole.ADMIN },
    );
  });

  it('bootstrap touches nothing without ADMIN_EMAILS', async () => {
    await service.onApplicationBootstrap();
    expect(repo.update).not.toHaveBeenCalled();
  });
});
