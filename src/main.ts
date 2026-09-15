import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { isProduction } from './common/environment';
import { APP_VERSION } from './common/version';
import { configureApp } from './common/configure-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configureApp(app);

  // `/docs-json` est une route non authentifiée qui livre toute la surface d'API.
  if (!isProduction(process.env.NODE_ENV)) {
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
