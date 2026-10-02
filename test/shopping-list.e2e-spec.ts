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
  let admin: TestUser;
  let ingredientIds: string[];
  let planSlots: { id: string }[];

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

    const ids: string[] = [];
    for (const name of ['Tomate', 'Basilic']) {
      const res = await request(app.getHttpServer())
        .post('/ingredients')
        .set(...bearer(admin))
        .send({ name })
        .expect(201);
      ids.push(res.body.id as string);
    }
    ingredientIds = ids;
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
    planSlots = plan.body.slots as { id: string }[];
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

  it('peuple la liste dès l’assignation d’un créneau', async () => {
    const list = await getList();

    expect(list.body.items).toHaveLength(2);
    expect(list.body.items.map((i: { name: string }) => i.name)).toEqual([
      'Basilic',
      'Tomate',
    ]);
  });

  it('ne ressuscite pas un item dérivé supprimé au GET suivant', async () => {
    const list = await getList();

    await request(app.getHttpServer())
      .delete(`/plan/shopping-list/items/${list.body.items[0].id}`)
      .set(...bearer(user))
      .expect(204);

    const after = await getList();
    expect(after.body.items).toHaveLength(1);
  });

  it('laisse vide une liste vidée jusqu’au dernier item', async () => {
    const list = await getList();
    for (const item of list.body.items as { id: string }[]) {
      await request(app.getHttpServer())
        .delete(`/plan/shopping-list/items/${item.id}`)
        .set(...bearer(user))
        .expect(204);
    }

    const after = await getList();
    expect(after.body.items).toHaveLength(0);
    expect(after.body.dismissedCount).toBe(2);
  });

  it('conserve au GET une quantité éditée à la main', async () => {
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

  it('ramène au sync l’unité de la recette sur un dérivé édité, sans doublon', async () => {
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

  it('rend une liste complète à des sync concurrents sur une liste vide', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, sync));

    const names = (res: request.Response) =>
      res.body.items.map((i: { name: string }) => i.name);
    for (const res of results) {
      expect(names(res)).toEqual(['Basilic', 'Tomate']);
    }
    expect(names(await getList())).toEqual(['Basilic', 'Tomate']);
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
  const assign = (slotIndex: number, body: object) =>
    request(app.getHttpServer())
      .patch(`/plan/slots/${planSlots[slotIndex].id}`)
      .set(...bearer(user))
      .send(body)
      .expect(200);

  const createMeal = async (name: string, ingredientId: string) => {
    const res = await request(app.getHttpServer())
      .post('/meals')
      .set(...bearer(admin))
      .send({
        name,
        ingredients: [{ ingredientId, quantity: 100, unit: 'g' }],
      })
      .expect(201);
    return res.body.id as string;
  };

  it('garde les coches quand le plan change ailleurs', async () => {
    const [basilic, tomate] = (await getList()).body.items;
    await patchItem(basilic.id, { checked: true }).expect(200);
    await patchItem(tomate.id, { checked: true }).expect(200);
    const res = await request(app.getHttpServer())
      .post('/ingredients')
      .set(...bearer(admin))
      .send({ name: 'Riz' })
      .expect(201);

    await assign(1, { mealId: await createMeal('Riz nature', res.body.id) });

    const after = (await getList()).body.items as {
      name: string;
      checked: boolean;
    }[];
    expect(after.map((i) => [i.name, i.checked])).toEqual([
      ['Basilic', true],
      ['Riz', false],
      ['Tomate', true],
    ]);
  });

  it('décoche un article dont la quantité augmente', async () => {
    const [basilic] = (await getList()).body.items;
    await patchItem(basilic.id, { checked: true }).expect(200);

    await assign(0, { servings: 2 });

    const [after] = (await getList()).body.items;
    expect(after).toMatchObject({
      name: 'Basilic',
      quantity: 500,
      checked: false,
    });
  });

  it('retire les articles d’un créneau vidé', async () => {
    await assign(0, { mealId: null });
    expect((await getList()).body.items).toEqual([]);
  });

  it('ne ramène un dérivé supprimé qu’au sync explicite, coches intactes', async () => {
    const [basilic, tomate] = (await getList()).body.items;
    await request(app.getHttpServer())
      .delete(`/plan/shopping-list/items/${basilic.id}`)
      .set(...bearer(user))
      .expect(204);
    await patchItem(tomate.id, { checked: true }).expect(200);

    await assign(0, { servings: 1 });
    const meanwhile = await getList();
    expect(meanwhile.body.items.map((i: { name: string }) => i.name)).toEqual([
      'Tomate',
    ]);

    const res = await sync();
    expect(res.body.dismissedCount).toBe(0);
    expect(
      res.body.items.map((i: { name: string; checked: boolean }) => [
        i.name,
        i.checked,
      ]),
    ).toEqual([
      ['Basilic', false],
      ['Tomate', true],
    ]);
  });

  it('reste cohérente sous des assignations concurrentes', async () => {
    const mealIds = await Promise.all(
      ingredientIds.map((id, i) => createMeal(`Plat ${i}`, id)),
    );

    await Promise.all([
      assign(1, { mealId: mealIds[0] }),
      assign(2, { mealId: mealIds[1] }),
      assign(3, { mealId: mealIds[0] }),
    ]);

    const items = (await getList()).body.items as {
      name: string;
      quantity: number;
    }[];
    expect(items.map((i) => [i.name, i.quantity])).toEqual([
      ['Basilic', 350],
      ['Tomate', 450],
    ]);
  });
});
