import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';

const secrets: Record<string, string> = {
  JWT_ACCESS_SECRET: 'access-secret',
  JWT_REFRESH_SECRET: 'refresh-secret',
};
const expiries: Record<string, string> = {
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
};

function makeService() {
  const config = {
    getOrThrow: (key: string) => secrets[key],
    get: (key: string, fallback?: string) => expiries[key] ?? fallback,
  };
  return new TokenService(new JwtService({}), config as never);
}

const user = { id: 'u1', email: 'a@b.c', role: 'USER' } as never;

describe('TokenService', () => {
  it('issues a token pair carrying the user claims', async () => {
    const svc = makeService();
    const pair = await svc.issueTokens(user);
    expect(typeof pair.accessToken).toBe('string');
    expect(typeof pair.refreshToken).toBe('string');

    const payload = await svc.verifyRefresh(pair.refreshToken);
    expect(payload.sub).toBe('u1');
    expect(payload.email).toBe('a@b.c');
    expect(payload.role).toBe('USER');
  });

  it('verifyRefresh rejects a token signed with another secret', async () => {
    const svc = makeService();
    const { accessToken } = await svc.issueTokens(user); // signé avec le secret ACCESS
    await expect(svc.verifyRefresh(accessToken)).rejects.toThrow();
  });

  it('verifyRefresh rejects a malformed token', async () => {
    const svc = makeService();
    await expect(svc.verifyRefresh('not-a-jwt')).rejects.toThrow();
  });
});
