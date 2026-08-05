import { QueryFailedError } from 'typeorm';

/** `unique_violation` : le code SQLSTATE de Postgres pour un conflit d'unicité. */
const UNIQUE_VIOLATION = '23505';

/**
 * Vrai si l'erreur est une violation d'unicité Postgres.
 *
 * Le code SQLSTATE est un détail du driver : il est isolé ici pour que les
 * services raisonnent sur l'intention et non sur une chaîne magique.
 */
export function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof QueryFailedError &&
    err.driverError?.code === UNIQUE_VIOLATION
  );
}
