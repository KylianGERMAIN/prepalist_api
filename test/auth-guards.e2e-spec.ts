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
  ])('refuse %s %s sans jeton', async (method, path) => {
    await request(app.getHttpServer())[method as 'get'](path).expect(401);
  });

  it('laisse passer une route @Public sans jeton', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });

  it('refuse à un USER les écritures admin sur le catalogue de repas', async () => {
    await request(app.getHttpServer())
      .post('/meals')
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
});
