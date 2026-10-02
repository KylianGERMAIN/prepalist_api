import { writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { buildOpenApiDocument } from './common/openapi';

// `preview` lit les métadonnées sans instancier les providers : pas de connexion à la base.
// Version figée : le fichier commité ne doit changer qu'avec le contrat, pas à chaque release.
async function main() {
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: false,
  });
  const document = buildOpenApiDocument(app, '2');
  writeFileSync('openapi.json', `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
}

void main();
