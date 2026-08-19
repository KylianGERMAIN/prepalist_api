import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { resolveCorsOrigin } from './common/cors-origin';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { requestId } from './common/middleware/request-id.middleware';

/** Partagé avec les tests e2e : ce qui n'est pas ici n'est pas testé. */
export function configureApp(app: INestApplication): void {
  app.use(helmet());
  app.use(requestId);

  app.enableCors({
    origin: resolveCorsOrigin({
      corsOrigins: process.env.CORS_ORIGINS,
      nodeEnv: process.env.NODE_ENV,
    }),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
}
