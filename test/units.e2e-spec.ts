import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { Unit } from '../src/common/unit';
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

  // `Unité` et `u` sont les écritures historiques de `pièce`, refusées au même
  // titre que n'importe quelle valeur inconnue.
  it.each(['grammes', 'Unité', 'u'])('refuse l’unité « %s »', async (unit) => {
    await createMeal(unit).expect(400);
  });

  it('refuse une unité hors du jeu sur un ingrédient', async () => {
    await request(app.getHttpServer())
      .post('/ingredients')
      .set(...bearer(admin))
      .send({ name: 'Persil', defaultUnit: 'botte' })
      .expect(400);
  });

  // L'enum applicatif et le type Postgres sont écrits à deux endroits. Sans ce
  // test, une valeur ajoutée d'un seul côté passe `@IsEnum` puis rend 500.
  it('garde l’enum applicatif et le type Postgres alignés', async () => {
    const rows: { value: string }[] = await db.query(
      `SELECT unnest(enum_range(NULL::unit_enum))::text AS value`,
    );

    expect(rows.map((r) => r.value).sort()).toEqual(Object.values(Unit).sort());
  });

  it('refuse une unité hors du jeu jusque dans la base', async () => {
    await expect(
      db.query(`UPDATE "meal_ingredients" SET "unit" = 'kg' WHERE true`),
    ).rejects.toThrow(/invalid input value for enum/);
  });
});
