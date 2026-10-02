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

describe('Rayons (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let user: TestUser;
  let admin: TestUser;
  let ids: Record<string, string>;

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(db);
    user = await registerUser(app);
    admin = await registerAdmin(app, db);
    ids = {};
    for (const name of ['Crème', 'Courgette', 'Glace']) {
      const res = await request(app.getHttpServer())
        .post('/ingredients')
        .set(...bearer(admin))
        .send({ name })
        .expect(201);
      ids[name] = res.body.id as string;
    }
    const meal = await request(app.getHttpServer())
      .post('/meals')
      .set(...bearer(admin))
      .send({
        name: 'Gratin',
        ingredients: Object.values(ids).map((ingredientId) => ({
          ingredientId,
          quantity: 1,
          unit: 'pièce',
        })),
      })
      .expect(201);
    const plan = await request(app.getHttpServer())
      .get('/plan')
      .set(...bearer(user))
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/plan/slots/${plan.body.slots[0].id}`)
      .set(...bearer(user))
      .send({ mealId: meal.body.id })
      .expect(200);
  });

  const setAisle = (name: string, aisle: string | null) =>
    request(app.getHttpServer())
      .patch(`/ingredients/${ids[name]}`)
      .set(...bearer(admin))
      .send({ aisle });

  const list = async () =>
    (
      await request(app.getHttpServer())
        .get('/plan/shopping-list')
        .set(...bearer(user))
        .expect(200)
    ).body.items as { name: string; aisle: string | null; checked: boolean }[];

  it('trie la liste par rayon, et un rayon corrigé se voit sans resynchroniser', async () => {
    await setAisle('Glace', 'FROZEN').expect(200);
    await setAisle('Crème', 'DAIRY').expect(200);
    await setAisle('Courgette', 'PRODUCE').expect(200);

    expect((await list()).map((i) => [i.name, i.aisle])).toEqual([
      ['Courgette', 'PRODUCE'],
      ['Crème', 'DAIRY'],
      ['Glace', 'FROZEN'],
    ]);

    await setAisle('Glace', null).expect(200);
    expect((await list()).at(-1)).toMatchObject({ name: 'Glace', aisle: null });
  });

  it('range un article manuel dans le rayon choisi à l’ajout', async () => {
    await setAisle('Crème', 'DAIRY').expect(200);
    await request(app.getHttpServer())
      .post('/plan/shopping-list/items')
      .set(...bearer(user))
      .send({
        name: 'Petits pois',
        quantity: 1,
        unit: 'boîte',
        aisle: 'FROZEN',
      })
      .expect(201);

    const items = await list();
    const names = items.map((i) => i.name);
    expect(names.indexOf('Crème')).toBeLessThan(names.indexOf('Petits pois'));
    expect(items.find((i) => i.name === 'Petits pois')?.aisle).toBe('FROZEN');
  });

  it('réserve la correction d’un ingrédient à l’admin et valide le rayon', async () => {
    await request(app.getHttpServer())
      .patch(`/ingredients/${ids['Crème']}`)
      .set(...bearer(user))
      .send({ aisle: 'DAIRY' })
      .expect(403);
    await setAisle('Crème', 'RAYON').expect(400);
  });

  const itemId = async (name: string) =>
    (
      (
        await request(app.getHttpServer())
          .get('/plan/shopping-list')
          .set(...bearer(user))
      ).body.items as { id: string; name: string }[]
    ).find((i) => i.name === name)?.id;

  it('range les cochés après les autres, dans leur rayon', async () => {
    await setAisle('Glace', 'FROZEN').expect(200);
    await setAisle('Crème', 'DAIRY').expect(200);
    await setAisle('Courgette', 'DAIRY').expect(200);

    await request(app.getHttpServer())
      .patch(`/plan/shopping-list/items/${await itemId('Courgette')}`)
      .set(...bearer(user))
      .send({ checked: true })
      .expect(200);

    expect((await list()).map((i) => i.name)).toEqual([
      'Crème',
      'Courgette',
      'Glace',
    ]);
  });

  it('renvoie le rayon de l’ingrédient au PATCH, et refuse de le changer sur un dérivé', async () => {
    await setAisle('Crème', 'DAIRY').expect(200);
    const creme = await itemId('Crème');

    const res = await request(app.getHttpServer())
      .patch(`/plan/shopping-list/items/${creme}`)
      .set(...bearer(user))
      .send({ checked: true })
      .expect(200);
    expect(res.body.aisle).toBe('DAIRY');

    await request(app.getHttpServer())
      .patch(`/plan/shopping-list/items/${creme}`)
      .set(...bearer(user))
      .send({ aisle: 'FROZEN' })
      .expect(400);
  });

  it('expose l’ordre de parcours des rayons', async () => {
    const res = await request(app.getHttpServer())
      .get('/plan/shopping-list')
      .set(...bearer(user))
      .expect(200);
    expect(res.body.aisleOrder[0]).toBe('PRODUCE');
    expect(res.body.aisleOrder.at(-1)).toBe('OTHER');
  });
});
