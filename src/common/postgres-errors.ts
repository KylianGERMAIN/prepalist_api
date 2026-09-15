import { QueryFailedError } from 'typeorm';

// SQLSTATE `unique_violation` de Postgres.
const UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof QueryFailedError &&
    err.driverError?.code === UNIQUE_VIOLATION
  );
}
