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

describe('Description des repas (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let admin: TestUser;

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(db);
    admin = await registerAdmin(app, db);
  });

  const create = (body: object) =>
    request(app.getHttpServer())
      .post('/meals')
      .set(...bearer(admin))
      .send({ name: 'Porc à la crème', ...body });

  const patch = (id: string, body: object) =>
    request(app.getHttpServer())
      .patch(`/meals/${id}`)
      .set(...bearer(admin))
      .send(body);

  it('crée, relit et met à jour la description', async () => {
    const created = await create({
      description: 'Saisir le porc.\nDéglacer à la crème.',
    }).expect(201);
    expect(created.body.description).toBe(
      'Saisir le porc.\nDéglacer à la crème.',
    );

    await patch(created.body.id, { description: 'Doubler la crème' }).expect(
      200,
    );
    const detail = await request(app.getHttpServer())
      .get(`/meals/${created.body.id}`)
      .set(...bearer(admin))
      .expect(200);
    expect(detail.body.description).toBe('Doubler la crème');
  });

  it('ramène une description blanche à null', async () => {
    const created = await create({ description: '   \n ' }).expect(201);
    expect(created.body.description).toBeNull();
  });

  it('efface la description avec null, et la garde quand le champ est absent', async () => {
    const { body } = await create({ description: 'Astuce' }).expect(201);

    const untouched = await patch(body.id, { name: 'Porc crème' }).expect(200);
    expect(untouched.body.description).toBe('Astuce');

    const cleared = await patch(body.id, { description: null }).expect(200);
    expect(cleared.body.description).toBeNull();
  });

  it('accepte 5000 caractères et refuse au-delà', async () => {
    await create({ description: 'a'.repeat(5000) }).expect(201);
    await create({ description: 'a'.repeat(5001) }).expect(400);
  });

  it('ramène aussi une description blanche à null en mise à jour', async () => {
    const { body } = await create({ description: 'Astuce' }).expect(201);
    const res = await patch(body.id, { description: '  ' }).expect(200);
    expect(res.body.description).toBeNull();
  });

  it('ne la renvoie pas dans la liste', async () => {
    await create({ description: 'Astuce' }).expect(201);
    const list = await request(app.getHttpServer())
      .get('/meals')
      .set(...bearer(admin))
      .expect(200);
    expect(list.body.items[0]).not.toHaveProperty('description');
  });
});
