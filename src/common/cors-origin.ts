import { isProduction } from './environment';

interface CorsEnv {
  corsOrigins?: string;
  nodeEnv?: string;
}

/** `false` ne refuse pas : il désactive le middleware, aucun en-tête CORS n'est émis. */
export function resolveCorsOrigin(env: CorsEnv): string[] | boolean {
  const origins =
    env.corsOrigins
      ?.split(',')
      .map((origin) => origin.trim().replace(/\/+$/, ''))
      .filter((origin) => origin !== '' && origin !== '*') ?? [];

  return origins.length > 0 ? origins : !isProduction(env.nodeEnv);
}
