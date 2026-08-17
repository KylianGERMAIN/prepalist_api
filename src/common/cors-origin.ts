export interface CorsEnv {
  corsOrigins?: string;
  nodeEnv?: string;
}

/**
 * Origines autorisées, à passer tel quel à `enableCors`. Rend `false` — donc aucune
 * origine — quand `CORS_ORIGINS` est absent en production : le défaut doit être fermé,
 * un oubli de configuration ne peut pas ouvrir l'API à tout le monde.
 */
export function resolveCorsOrigin(env: CorsEnv): string[] | boolean {
  const origins =
    env.corsOrigins
      ?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];

  if (origins.length > 0) {
    return origins;
  }
  return env.nodeEnv !== 'production';
}
