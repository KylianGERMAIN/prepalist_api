import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { resolveCorsOrigin } from './common/cors-origin';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { requestId } from './common/middleware/request-id.middleware';
import { APP_VERSION } from './common/version';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  // Hors production seulement : `/docs-json` est une route non authentifiée qui livre
  // toute la surface d'API.
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('PrepaList API')
      .setDescription('API meal-prep PrepaList v2')
      .setVersion(APP_VERSION)
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

void bootstrap();
