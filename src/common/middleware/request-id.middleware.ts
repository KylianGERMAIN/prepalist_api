import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

/**
 * Attache un identifiant de requête (`req.id`) repris du header `x-request-id`
 * ou généré, et le renvoie dans la réponse pour la corrélation des logs.
 */
export function requestId(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const id = (req.headers['x-request-id'] as string) || randomUUID();
  (req as Request & { id: string }).id = id;
  res.setHeader('X-Request-Id', id);
  next();
}
