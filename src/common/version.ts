import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Version applicative, lue depuis `package.json` au démarrage. `process.cwd()`
 * pointe sur le WORKDIR (`/app` en prod, racine repo en dev/test), robuste quel
 * que soit le mode de lancement — contrairement à un chemin relatif depuis `dist/`.
 * Fallback `'unknown'` : un numéro de version illisible (cwd inattendu, JSON
 * corrompu) ne doit pas faire planter le bootstrap pour un champ d'observabilité.
 */
function readVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
    ) as { version?: string };
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export const APP_VERSION: string = readVersion();
