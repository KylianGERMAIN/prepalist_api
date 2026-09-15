import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/configure-app';

export const TEST_PASSWORD = 'Password1!';

const unlimitedThrottler = {
  increment: () =>
    Promise.resolve({
      totalHits: 1,
      timeToExpire: 0,
      isBlocked: false,
      timeToBlockExpire: 0,
    }),
};

/**
 * `throttle: true` laisse le compteur réel en place, pour un test du
 * `@Throttle({ default: { limit: 5, ttl: 60_000 } })` de `/auth/*`. Par défaut il
 * est neutralisé, sinon le 6e compte inscrit dans un run prendrait un 429.
 * C'est le stockage qui est remplacé, pas le guard : un `APP_GUARD` en `useClass`
 * n'est pas interceptable par `overrideGuard`.
 */
export async function createTestApp({ throttle = false } = {}): Promise<{
  app: INestApplication;
  db: DataSource;
}> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (!throttle) {
    builder.overrideProvider(ThrottlerStorage).useValue(unlimitedThrottler);
  }
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  return { app, db: app.get(DataSource) };
}

/**
 * Vide les tables entre deux tests, `migrations` exclue.
 * TRUNCATE et non une transaction annulée : les services ouvrent leurs propres
 * transactions, qui ne seraient plus que des savepoints dans celle du test.
 * Toutes les suites partagent une base : `maxWorkers: 1` (`jest-e2e.json`) est
 * ce qui empêche un worker de vider les données d'un autre en pleine exécution.
 */
export async function truncateAll(db: DataSource): Promise<void> {
  const tables = db.entityMetadatas.map((m) => `"${m.tableName}"`).join(', ');
  await db.query(`TRUNCATE ${tables} CASCADE`);
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
