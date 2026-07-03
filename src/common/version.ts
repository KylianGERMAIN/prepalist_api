import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Version applicative, lue depuis `package.json` au démarrage. `process.cwd()`
 * pointe sur le WORKDIR (`/app` en prod, racine repo en dev/test), robuste quel
 * que soit le mode de lancement — contrairement à un chemin relatif depuis `dist/`.
 */
export const APP_VERSION: string = (
  JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
    version: string;
  }
).version;
