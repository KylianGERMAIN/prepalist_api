import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

export const TEST_PASSWORD = 'Password1!';

export interface TestContext {
  app: INestApplication;
  db: DataSource;
}

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    // `@Throttle({ limit: 5 })` sur /auth/* écrase THROTTLE_LIMIT : au 6e compte
    // inscrit dans un run, les tests prendraient des 429. Le compteur est
    // neutralisé plutôt que le guard, qu'un APP_GUARD en useClass n'expose pas.
    .overrideProvider(ThrottlerStorage)
    .useValue({
      increment: () =>
        Promise.resolve({
          totalHits: 1,
          timeToExpire: 0,
          isBlocked: false,
          timeToBlockExpire: 0,
        }),
    })
    .compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  return { app, db: app.get(DataSource) };
}

/**
 * Vide les tables entre deux tests, `migrations` exclue.
 * TRUNCATE et non une transaction annulée : les services ouvrent leurs propres
 * transactions, qui ne seraient plus que des savepoints dans celle du test.
 */
export async function truncateAll(db: DataSource): Promise<void> {
  const tables = db.entityMetadatas.map((m) => `"${m.tableName}"`).join(', ');
  await db.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
}

export interface TestUser {
  email: string;
  token: string;
}

let userSeq = 0;

export async function registerUser(app: INestApplication): Promise<TestUser> {
  const email = `e2e-${++userSeq}@prepalist.test`;
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password: TEST_PASSWORD })
    .expect(201);
  return { email, token: res.body.accessToken as string };
}

/** Le rôle vient du payload du token : la promotion exige un nouveau login. */
export async function registerAdmin(
  app: INestApplication,
  db: DataSource,
): Promise<TestUser> {
  const { email } = await registerUser(app);
  await db.query(`UPDATE users SET role = 'ADMIN' WHERE email = $1`, [email]);
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password: TEST_PASSWORD })
    .expect(200);
  return { email, token: res.body.accessToken as string };
}

export const bearer = (user: TestUser): [string, string] => [
  'Authorization',
  `Bearer ${user.token}`,
];
