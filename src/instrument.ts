import 'dotenv/config';
import * as Sentry from '@sentry/nestjs';
import { APP_VERSION } from './common/version';

// Importé avant tout le reste dans `main.ts` : Sentry instrumente les modules au chargement.
// Sans `SENTRY_DSN`, le SDK est inerte.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: APP_VERSION,
  environment: process.env.NODE_ENV,
});
