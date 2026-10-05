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
  rating: number | null;
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

  const rate = (as: TestUser, rating: number) =>
    request(app.getHttpServer())
      .patch(`/meals/${mealId}/state`)
      .set(...bearer(as))
      .send({ rating })
      .expect(200);

  it('crée la recette au nom de l’application, pas de l’admin', async () => {
    const meal = await detail(admin);
    expect(meal).toMatchObject({ userId: null, status: 'PUBLISHED' });
  });

  // L'état est fusionné dans le repas : une ligne d'état livrée entière y
  // pousserait son propre user_id, et la recette changerait de propriétaire
  // selon qui la lit.
  it('ne fait pas dépendre le propriétaire de la recette du lecteur', async () => {
    await rate(alice, 4);

    expect(await detail(alice)).toMatchObject({ userId: null });
    expect((await list(alice)).items[0]).toMatchObject({ userId: null });
  });

  it('garde la note propre au compte', async () => {
    await request(app.getHttpServer())
      .patch(`/meals/${mealId}/state`)
      .set(...bearer(alice))
      .send({ rating: 5 })
      .expect(200);

    expect(await detail(alice)).toMatchObject({ rating: 5 });
    expect(await detail(bob)).toMatchObject({ rating: null });
  });

  it('ne réserve pas /state à l’admin', async () => {
    await request(app.getHttpServer())
      .patch(`/meals/${mealId}/state`)
      .set(...bearer(alice))
      .send({ rating: 3 })
      .expect(200);
  });

  it('efface la note avec null', async () => {
    await request(app.getHttpServer())
      .patch(`/meals/${mealId}/state`)
      .set(...bearer(alice))
      .send({ rating: 4 })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/meals/${mealId}/state`)
      .set(...bearer(alice))
      .send({ rating: null })
      .expect(200);

    expect(await detail(alice)).toMatchObject({ rating: null });
  });

  it('rend la liste avec l’état du demandeur', async () => {
    await rate(alice, 4);

    expect((await list(alice)).items[0]).toMatchObject({ rating: 4 });
    expect((await list(bob)).items[0]).toMatchObject({ rating: null });
  });

  it('refuse un favori, champ et filtre retirés du contrat', async () => {
    const patch = await request(app.getHttpServer())
      .patch(`/meals/${mealId}/state`)
      .set(...bearer(alice))
      .send({ isFavorite: true })
      .expect(400);
    expect(JSON.stringify(patch.body)).toContain('isFavorite');

    const filter = await request(app.getHttpServer())
      .get('/meals?favorite=true')
      .set(...bearer(alice))
      .expect(400);
    expect(JSON.stringify(filter.body)).toContain('favorite');
  });

  // Seul test qui échoue si `ensureForUser` cesse de réinjecter dans les slots
  // les repas que `attachFor` lui rend.
  it('rend l’état du demandeur dans les créneaux du plan', async () => {
    await rate(alice, 4);
    await request(app.getHttpServer())
      .post('/plan/generate')
      .set(...bearer(alice))
      .expect(200);

    const plan = await request(app.getHttpServer())
      .get('/plan')
      .set(...bearer(alice))
      .expect(200);
    const slot = (plan.body.slots as { meal: MealBody | null }[]).find(
      (s) => s.meal,
    );
    expect(slot?.meal).toMatchObject({ id: mealId, rating: 4 });
  });

  it('rend 404 sur la note d’un repas inexistant', async () => {
    await request(app.getHttpServer())
      .patch('/meals/00000000-0000-4000-8000-000000000000/state')
      .set(...bearer(alice))
      .send({ rating: 3 })
      .expect(404);
  });

  it('a retiré le suivi des cuissons du contrat', async () => {
    await request(app.getHttpServer())
      .post(`/meals/${mealId}/cooked`)
      .set(...bearer(alice))
      .expect(404);
    expect(await detail(alice)).not.toHaveProperty('timesCooked');
    expect(await detail(alice)).not.toHaveProperty('lastCookedAt');
  });
});
