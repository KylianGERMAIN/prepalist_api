import { ValueTransformer } from 'typeorm';

// Le driver Postgres rend `numeric` en `string`.
export const numericTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? value : parseFloat(value),
};
