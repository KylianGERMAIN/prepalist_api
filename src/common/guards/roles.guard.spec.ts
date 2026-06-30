import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../modules/users/entities/user.entity';
import { RolesGuard } from './roles.guard';

function ctx(user: { role: UserRole } | undefined) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as never;
}

function guardWith(required: UserRole[] | undefined) {
  const reflector = { getAllAndOverride: () => required } as never;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('allows when no role is required', () => {
    expect(guardWith(undefined).canActivate(ctx({ role: UserRole.USER }))).toBe(
      true,
    );
  });

  it('allows when the user has a required role', () => {
    expect(
      guardWith([UserRole.ADMIN]).canActivate(ctx({ role: UserRole.ADMIN })),
    ).toBe(true);
  });

  it('forbids when the user lacks the role', () => {
    expect(() =>
      guardWith([UserRole.ADMIN]).canActivate(ctx({ role: UserRole.USER })),
    ).toThrow(ForbiddenException);
  });

  it('forbids when there is no authenticated user', () => {
    expect(() =>
      guardWith([UserRole.ADMIN]).canActivate(ctx(undefined)),
    ).toThrow(ForbiddenException);
  });
});
