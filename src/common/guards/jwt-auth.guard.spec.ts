import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const ctx = { getHandler: () => ({}), getClass: () => ({}) } as never;

  it('bypasses authentication for @Public() routes', () => {
    const reflector = { getAllAndOverride: () => true } as never;
    const guard = new JwtAuthGuard(reflector);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
