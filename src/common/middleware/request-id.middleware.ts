import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un `x-request-id` entrant n'est repris que s'il est un UUID : il finit dans les logs et la réponse. */
export function requestId(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.headers['x-request-id'];
  const id =
    typeof incoming === 'string' && UUID.test(incoming)
      ? incoming
      : randomUUID();
  (req as Request & { id: string }).id = id;
  res.setHeader('X-Request-Id', id);
  next();
}
