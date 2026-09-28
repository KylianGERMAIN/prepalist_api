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

describe('Liste de courses (e2e)', () => {
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
    const admin = await registerAdmin(app, db);

    const ids: string[] = [];
    for (const name of ['Tomate', 'Basilic']) {
      const res = await request(app.getHttpServer())
        .post('/ingredients')
        .set(...bearer(admin))
        .send({ name })
        .expect(201);
      ids.push(res.body.id as string);
    }
    const meal = await request(app.getHttpServer())
      .post('/meals')
      .set(...bearer(admin))
      .send({
        name: 'Pâtes',
        ingredients: ids.map((ingredientId) => ({
          ingredientId,
          quantity: 250,
          unit: 'g',
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

  const getList = () =>
    request(app.getHttpServer())
      .get('/plan/shopping-list')
      .set(...bearer(user))
      .expect(200);

  it('peuple la liste au premier accès depuis les repas du plan', async () => {
    const list = await getList();

    expect(list.body.items).toHaveLength(2);
    expect(list.body.items.map((i: { name: string }) => i.name)).toEqual([
      'Basilic',
      'Tomate',
    ]);
  });

  // Le garde `count === 0` de forPlan : sans lui, chaque GET resynchroniserait et
  // ramènerait l'item supprimé.
  it('ne ressuscite pas un item dérivé supprimé', async () => {
    const list = await getList();

    await request(app.getHttpServer())
      .delete(`/plan/shopping-list/items/${list.body.items[0].id}`)
      .set(...bearer(user))
      .expect(204);

    const after = await getList();
    expect(after.body.items).toHaveLength(1);
  });

  // Comportement assumé et non couvert jusqu'ici : le garde compte TOUS les items,
  // donc une liste vidée jusqu'au dernier item est indistinguable d'une liste
  // jamais initialisée, et le GET suivant la repeuple.
  it('repeuple une liste vidée jusqu’au dernier item', async () => {
    const list = await getList();
    for (const item of list.body.items as { id: string }[]) {
      await request(app.getHttpServer())
        .delete(`/plan/shopping-list/items/${item.id}`)
        .set(...bearer(user))
        .expect(204);
    }

    const after = await getList();
    expect(after.body.items).toHaveLength(2);
  });

  // Même garde, versant édition : un sync au GET écraserait la quantité saisie.
  it('conserve une quantité éditée à la main', async () => {
    const list = await getList();

    await request(app.getHttpServer())
      .patch(`/plan/shopping-list/items/${list.body.items[0].id}`)
      .set(...bearer(user))
      .send({ quantity: 999 })
      .expect(200);

    const after = await getList();
    expect(after.body.items[0].quantity).toBe(999);
  });

  const patchItem = (id: string, body: object) =>
    request(app.getHttpServer())
      .patch(`/plan/shopping-list/items/${id}`)
      .set(...bearer(user))
      .send(body);

  const sync = () =>
    request(app.getHttpServer())
      .post('/plan/shopping-list/sync')
      .set(...bearer(user))
      .expect(200);

  it('change l’unité d’un item dérivé dans le jeu fermé seulement', async () => {
    const [, tomate] = (await getList()).body.items;

    await patchItem(tomate.id, { unit: 'pièce' }).expect(200);
    await patchItem(tomate.id, { unit: 'tranches' }).expect(400);
    await patchItem(tomate.id, { unit: null }).expect(400);
  });

  it('réécrit les dérivés au sync avec l’unité de la recette, sans doublon', async () => {
    const [, tomate] = (await getList()).body.items;
    await patchItem(tomate.id, {
      unit: 'pièce',
      quantity: 3,
      checked: true,
    }).expect(200);

    const res = await sync();

    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[1]).toMatchObject({
      name: 'Tomate',
      unit: 'g',
      quantity: 250,
      checked: false,
    });
  });

  it('ramène au sync un dérivé supprimé et garde les manuels', async () => {
    const [basilic] = (await getList()).body.items;
    await request(app.getHttpServer())
      .delete(`/plan/shopping-list/items/${basilic.id}`)
      .set(...bearer(user))
      .expect(204);
    await request(app.getHttpServer())
      .post('/plan/shopping-list/items')
      .set(...bearer(user))
      .send({ name: 'Éponges', quantity: 2, unit: 'pièce' })
      .expect(201);

    const res = await sync();

    expect(res.body.items.map((i: { name: string }) => i.name)).toEqual([
      'Basilic',
      'Éponges',
      'Tomate',
    ]);
  });

  it('impose le jeu fermé à l’unité d’un item manuel', async () => {
    const add = (unit?: string) =>
      request(app.getHttpServer())
        .post('/plan/shopping-list/items')
        .set(...bearer(user))
        .send({ name: 'Éponges', quantity: 2, unit });

    await add().expect(400);
    await add('sachet').expect(400);
    const created = await add('pièce').expect(201);

    await patchItem(created.body.id as string, { unit: 'lot' }).expect(400);
    await patchItem(created.body.id as string, { unit: null }).expect(400);
    await patchItem(created.body.id as string, { unit: 'boîte' }).expect(200);
  });
});
