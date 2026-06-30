import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let users: {
    create: jest.Mock;
    findByEmail: jest.Mock;
    findById: jest.Mock;
  };
  let tokens: { issueTokens: jest.Mock; verifyRefresh: jest.Mock };

  beforeEach(() => {
    users = { create: jest.fn(), findByEmail: jest.fn(), findById: jest.fn() };
    tokens = {
      issueTokens: jest
        .fn()
        .mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }),
      verifyRefresh: jest.fn(),
    };
    service = new AuthService(users as never, tokens as never);
  });

  it('register hashes the password before persisting', async () => {
    users.create.mockImplementation((email: string, hash: string) =>
      Promise.resolve({ id: '1', email, passwordHash: hash, role: 'USER' }),
    );
    const res = await service.register({
      email: 'a@b.c',
      password: 'password1',
    });
    const hash = users.create.mock.calls[0][1];
    expect(hash).not.toBe('password1');
    expect(await bcrypt.compare('password1', hash)).toBe(true);
    expect(res).toEqual({ accessToken: 'a', refreshToken: 'r' });
  });

  it('login rejects a wrong password', async () => {
    const hash = await bcrypt.hash('right', 10);
    users.findByEmail.mockResolvedValue({
      id: '1',
      email: 'a@b.c',
      passwordHash: hash,
      role: 'USER',
    });
    await expect(
      service.login({ email: 'a@b.c', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('login rejects an unknown email', async () => {
    users.findByEmail.mockResolvedValue(null);
    await expect(
      service.login({ email: 'x@y.z', password: 'whatever' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('login succeeds with the right password', async () => {
    const hash = await bcrypt.hash('right', 10);
    users.findByEmail.mockResolvedValue({
      id: '1',
      email: 'a@b.c',
      passwordHash: hash,
      role: 'USER',
    });
    const res = await service.login({ email: 'a@b.c', password: 'right' });
    expect(res.accessToken).toBe('a');
  });

  it('refresh rejects an invalid token', async () => {
    tokens.verifyRefresh.mockRejectedValue(new Error('bad'));
    await expect(service.refresh('bad')).rejects.toThrow(UnauthorizedException);
  });

  it('refresh issues a new pair for a valid token', async () => {
    tokens.verifyRefresh.mockResolvedValue({
      sub: '1',
      email: 'a@b.c',
      role: 'USER',
    });
    users.findById.mockResolvedValue({ id: '1', email: 'a@b.c', role: 'USER' });
    const res = await service.refresh('good');
    expect(res).toEqual({ accessToken: 'a', refreshToken: 'r' });
  });
});
