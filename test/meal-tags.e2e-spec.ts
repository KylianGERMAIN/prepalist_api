import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { NormalizeMealTags1787900000000 } from '../src/migrations/1787900000000-NormalizeMealTags';
import {
  bearer,
  createTestApp,
  registerAdmin,
  registerUser,
  truncateAll,
  TestUser,
} from './app';

describe('Tags des repas (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let admin: TestUser;
  let user: TestUser;

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(db);
    admin = await registerAdmin(app, db);
    user = await registerUser(app);
  });

  const create = (name: string, tags: string[]) =>
    request(app.getHttpServer())
      .post('/meals')
      .set(...bearer(admin))
      .send({ name, tags });

  it('normalise les tags à l’écriture', async () => {
    const res = await create('Raclette', [
      ' Hiver ',
      'hiver',
      'Plat   du jour',
    ]).expect(201);
    expect(res.body.tags).toEqual(['hiver', 'plat du jour']);
  });

  it('normalise aussi au PATCH', async () => {
    const { body } = await create('Raclette', ['hiver']).expect(201);
    const res = await request(app.getHttpServer())
      .patch(`/meals/${body.id}`)
      .set(...bearer(admin))
      .send({ tags: [' Hiver ', 'HIVER', 'Fromage'] })
      .expect(200);
    expect(res.body.tags).toEqual(['hiver', 'fromage']);
  });

  it('liste les tags existants, les plus fréquents en tête', async () => {
    await create('Raclette', ['hiver', 'fromage']).expect(201);
    await create('Tartiflette', ['Hiver']).expect(201);
    await create('Salade', ['été']).expect(201);

    const tags = await request(app.getHttpServer())
      .get('/meals/tags')
      .set(...bearer(user))
      .expect(200);

    expect(tags.body).toEqual([
      { name: 'hiver', count: 2 },
      { name: 'été', count: 1 },
      { name: 'fromage', count: 1 },
    ]);
  });

  it('filtre quelle que soit la casse saisie', async () => {
    await create('Raclette', ['hiver']).expect(201);

    const res = await request(app.getHttpServer())
      .get('/meals?tag=HIVER')
      .set(...bearer(user))
      .expect(200);

    expect(res.body.items).toHaveLength(1);
  });

  it('refuse un tag de plus de 40 caractères', async () => {
    await create('Raclette', ['a'.repeat(41)]).expect(400);
  });

  it('normalise les données existantes, et rejouer la migration ne change rien', async () => {
    const { body } = await create('Raclette', ['x']).expect(201);
    await db.query(`UPDATE meals SET tags = $1 WHERE id = $2`, [
      [
        ' Hiver',
        'hiver ',
        '',
        '\t',
        'Plat\u00a0 du jour',
        'HIVER',
        'ÉTÉ',
        'été',
      ],
      body.id,
    ]);
    const migration = new NormalizeMealTags1787900000000();
    const runner = db.createQueryRunner();

    await migration.up(runner);
    const once = await db.query(`SELECT tags FROM meals WHERE id = $1`, [
      body.id,
    ]);
    await migration.up(runner);
    const twice = await db.query(`SELECT tags FROM meals WHERE id = $1`, [
      body.id,
    ]);
    await runner.release();

    expect(once[0].tags).toEqual(['hiver', 'plat du jour', 'été']);
    expect(twice[0].tags).toEqual(once[0].tags);
  });
});
