import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import {
  bearer,
  createTestApp,
  registerAdmin,
  registerUser,
  truncateAll,
  TestUser,
} from './app';

const SOME_UUID = '00000000-0000-4000-8000-000000000000';

describe('Gardes d’autorisation (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let user: TestUser;

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(db);
    user = await registerUser(app);
  });

  // JwtAuthGuard est monté en APP_GUARD : le défaut est « protégé ».
  it.each([
    ['get', '/plan'],
    ['get', '/meals'],
    ['get', '/users/me'],
    ['get', '/plan/shopping-list'],
    ['post', '/ingredients'],
  ] as const)('refuse %s %s sans jeton', async (method, path) => {
    await request(app.getHttpServer())[method](path).expect(401);
  });

  it('laisse passer une route @Public sans jeton', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });

  // Les trois routes @Roles(ADMIN) du catalogue : en couvrir une seule laisserait
  // retirer le décorateur des deux autres sans qu'un test bronche.
  it.each([
    ['post', '/meals'],
    ['patch', `/meals/${SOME_UUID}`],
    ['delete', `/meals/${SOME_UUID}`],
  ] as const)('refuse %s %s à un USER', async (method, path) => {
    await request(app.getHttpServer())
      [method](path)
      .set(...bearer(user))
      .send({ name: 'Pâtes', ingredients: [] })
      .expect(403);
  });

  it('autorise ces mêmes écritures à un ADMIN', async () => {
    const admin = await registerAdmin(app, db);
    await request(app.getHttpServer())
      .post('/meals')
      .set(...bearer(admin))
      .send({ name: 'Pâtes', ingredients: [] })
      .expect(201);
  });

  // Le rôle est lu dans le payload du jeton, pas en base : un jeton signé avant
  // la promotion reste un jeton de USER.
  it('ne promeut pas le porteur d’un jeton émis avant la promotion', async () => {
    await db.query(`UPDATE users SET role = 'ADMIN' WHERE email = $1`, [
      user.email,
    ]);
    await request(app.getHttpServer())
      .post('/meals')
      .set(...bearer(user))
      .send({ name: 'Pâtes', ingredients: [] })
      .expect(403);
  });

  // Autorisation horizontale : les specs unitaires n'assertent que la forme du
  // `where` passé à un repository mocké, jamais le filtrage produit en SQL.
  describe('isolation entre comptes', () => {
    let other: TestUser;

    beforeEach(async () => {
      other = await registerUser(app);
    });

    it('ne laisse pas modifier le créneau d’un autre compte', async () => {
      const plan = await request(app.getHttpServer())
        .get('/plan')
        .set(...bearer(user))
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/plan/slots/${plan.body.slots[0].id}`)
        .set(...bearer(other))
        .send({ servings: 4 })
        .expect(404);
    });

    it('ne laisse pas modifier ni supprimer l’item d’un autre compte', async () => {
      const item = await request(app.getHttpServer())
        .post('/plan/shopping-list/items')
        .set(...bearer(user))
        .send({ name: 'Éponges', quantity: 2, unit: 'lot' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/plan/shopping-list/items/${item.body.id}`)
        .set(...bearer(other))
        .send({ checked: true })
        .expect(404);

      await request(app.getHttpServer())
        .delete(`/plan/shopping-list/items/${item.body.id}`)
        .set(...bearer(other))
        .expect(404);
    });

    it('ne laisse pas voir la liste d’un autre compte', async () => {
      await request(app.getHttpServer())
        .post('/plan/shopping-list/items')
        .set(...bearer(user))
        .send({ name: 'Éponges', quantity: 2, unit: 'lot' })
        .expect(201);

      const list = await request(app.getHttpServer())
        .get('/plan/shopping-list')
        .set(...bearer(other))
        .expect(200);
      expect(list.body.items).toHaveLength(0);
    });
  });
});
