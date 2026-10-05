import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function buildOpenApiDocument(app: INestApplication, version: string) {
  const config = new DocumentBuilder()
    .setTitle('PrepaList API')
    .setDescription('API meal-prep PrepaList v2')
    .setVersion(version)
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config);
}
