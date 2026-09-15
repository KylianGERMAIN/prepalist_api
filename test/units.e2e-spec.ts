import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import {
  bearer,
  createTestApp,
  registerAdmin,
  truncateAll,
  TestUser,
} from './app';

describe('Jeu d’unités fermé (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let admin: TestUser;
  let ingredientId: string;

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(db);
    admin = await registerAdmin(app, db);

    const ingredient = await request(app.getHttpServer())
      .post('/ingredients')
      .set(...bearer(admin))
      .send({ name: 'Jambon', defaultUnit: 'tranche' })
      .expect(201);
    ingredientId = ingredient.body.id as string;
  });

  const createMeal = (unit: string) =>
    request(app.getHttpServer())
      .post('/meals')
      .set(...bearer(admin))
      .send({
        name: 'Croque',
        ingredients: [{ ingredientId, quantity: 2, unit }],
      });

  it('accepte une unité du jeu', async () => {
    const res = await createMeal('tranche').expect(201);
    expect(res.body.ingredients[0]).toMatchObject({ unit: 'tranche' });
  });

  it('refuse une unité hors du jeu', async () => {
    await createMeal('grammes').expect(400);
  });

  // `Unité` et `u` désignaient déjà `pièce` : la migration les a repliés, le
  // DTO doit refuser qu'ils reviennent par l'API.
  it('refuse les anciennes écritures de « pièce »', async () => {
    await createMeal('Unité').expect(400);
    await createMeal('u').expect(400);
  });

  it('refuse une unité hors du jeu sur un ingrédient', async () => {
    await request(app.getHttpServer())
      .post('/ingredients')
      .set(...bearer(admin))
      .send({ name: 'Persil', defaultUnit: 'botte' })
      .expect(400);
  });
});
