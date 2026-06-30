import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

/** Injecte l'utilisateur authentifié (ou une de ses propriétés) dans un handler. */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    return data ? request.user?.[data] : request.user;
  },
);
