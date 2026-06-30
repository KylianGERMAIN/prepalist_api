import { ValueTransformer } from 'typeorm';

/**
 * Postgres `numeric` revient en `string` côté driver ; on le reconvertit en
 * `number` pour exposer un type propre dans l'API.
 */
export const numericTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? value : parseFloat(value),
};
