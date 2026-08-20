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

interface MealBody {
  id: string;
  isFavorite: boolean;
  rating: number | null;
  lastCookedAt: string | null;
  timesCooked: number;
}

/**
 * Le catalogue est partagé : ce qui est vérifié ici, c'est qu'aucun compte
 * n'écrit dans ce qu'un autre voit (#24). Les specs unitaires mockent le
 * repository d'état, donc aucune ne peut le voir.
 */
describe('État par utilisateur (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let admin: TestUser;
  let alice: TestUser;
  let bob: TestUser;
  let mealId: string;

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(db);
    alice = await registerUser(app);
    bob = await registerUser(app);
    admin = await registerAdmin(app, db);

    const meal = await request(app.getHttpServer())
      .post('/meals')
      .set(...bearer(admin))
      .send({ name: 'Pâtes', ingredients: [] })
      .expect(201);
    mealId = meal.body.id as string;
  });

  const detail = async (as: TestUser): Promise<MealBody> => {
    const res = await request(app.getHttpServer())
      .get(`/meals/${mealId}`)
      .set(...bearer(as))
      .expect(200);
    return res.body as MealBody;
  };

  const list = async (
    as: TestUser,
    query = '',
  ): Promise<{ items: MealBody[] }> => {
    const res = await request(app.getHttpServer())
      .get(`/meals${query}`)
      .set(...bearer(as))
      .expect(200);
    return res.body as { items: MealBody[] };
  };

  const cook = (as: TestUser) =>
    request(app.getHttpServer())
      .post(`/meals/${mealId}/cooked`)
      .set(...bearer(as))
      .expect(201);

  it('crée la recette au nom de l’application, pas de l’admin', async () => {
    const meal = await detail(admin);
    expect(meal).toMatchObject({ userId: null, status: 'PUBLISHED' });
  });

  it('n’attribue la cuisson qu’au compte qui l’a faite', async () => {
    await cook(alice);

    expect(await detail(alice)).toMatchObject({ timesCooked: 1 });
    expect((await detail(alice)).lastCookedAt).not.toBeNull();
    expect(await detail(bob)).toMatchObject({
      timesCooked: 0,
      lastCookedAt: null,
    });
  });

  // L'incrément est en SQL dans le ON CONFLICT : un read-modify-write perdrait
  // une cuisson sur deux appels concurrents.
  it('cumule les cuissons d’un même compte', async () => {
    await cook(alice);
    await cook(alice);

    expect(await detail(alice)).toMatchObject({ timesCooked: 2 });
  });

  it('garde favori et note propres au compte', async () => {
    await request(app.getHttpServer())
      .patch(`/meals/${mealId}/state`)
      .set(...bearer(alice))
      .send({ isFavorite: true, rating: 5 })
      .expect(200);

    expect(await detail(alice)).toMatchObject({ isFavorite: true, rating: 5 });
    expect(await detail(bob)).toMatchObject({
      isFavorite: false,
      rating: null,
    });
  });

  it('ne réserve pas /state à l’admin', async () => {
    await request(app.getHttpServer())
      .patch(`/meals/${mealId}/state`)
      .set(...bearer(alice))
      .send({ isFavorite: true })
      .expect(200);
  });

  it('efface la note sans toucher au favori', async () => {
    await request(app.getHttpServer())
      .patch(`/meals/${mealId}/state`)
      .set(...bearer(alice))
      .send({ isFavorite: true, rating: 4 })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/meals/${mealId}/state`)
      .set(...bearer(alice))
      .send({ rating: null })
      .expect(200);

    expect(await detail(alice)).toMatchObject({
      isFavorite: true,
      rating: null,
    });
  });

  // Le filtre porte sur l'état du demandeur : sans le NOT EXISTS, favorite=false
  // ne rendrait que les repas déjà notés par le compte.
  it('filtre les favoris par compte', async () => {
    await request(app.getHttpServer())
      .patch(`/meals/${mealId}/state`)
      .set(...bearer(alice))
      .send({ isFavorite: true })
      .expect(200);

    expect((await list(alice, '?favorite=true')).items).toHaveLength(1);
    expect((await list(alice, '?favorite=false')).items).toHaveLength(0);
    expect((await list(bob, '?favorite=true')).items).toHaveLength(0);
    expect((await list(bob, '?favorite=false')).items).toHaveLength(1);
  });

  it('rend la liste avec l’état du demandeur', async () => {
    await cook(alice);

    expect((await list(alice)).items[0]).toMatchObject({ timesCooked: 1 });
    expect((await list(bob)).items[0]).toMatchObject({ timesCooked: 0 });
  });

  it('rend 404 sur la cuisson d’un repas inexistant', async () => {
    await request(app.getHttpServer())
      .post('/meals/00000000-0000-4000-8000-000000000000/cooked')
      .set(...bearer(alice))
      .expect(404);
  });
});
