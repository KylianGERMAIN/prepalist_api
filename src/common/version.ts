import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// `process.cwd()` et non un chemin relatif depuis `dist/` : le WORKDIR diffère
// entre la prod (`/app`) et le lancement local.
// Le fallback est silencieux : un champ d'observabilité ne fait pas échouer le boot.
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
