import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { User } from '../src/modules/users/entities/user.entity';
import { UsersService } from '../src/modules/users/users.service';
import { createTestApp, registerUser, truncateAll } from './app';

describe('ADMIN_EMAILS (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(db);
  });

  it('promeut au démarrage les comptes listés, et eux seuls', async () => {
    const boss = await registerUser(app);
    const other = await registerUser(app);
    const config = {
      get: () => ` ${boss.email.toUpperCase()} `,
    } as unknown as ConfigService;

    await new UsersService(
      db.getRepository(User),
      config,
    ).onApplicationBootstrap();

    const roles = await db.getRepository(User).find();
    expect(Object.fromEntries(roles.map((u) => [u.email, u.role]))).toEqual({
      [boss.email]: 'ADMIN',
      [other.email]: 'USER',
    });
  });
});
