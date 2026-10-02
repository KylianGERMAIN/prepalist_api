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

interface Slot {
  id: string;
  dayIndex: number;
  slot: 'LUNCH' | 'DINNER';
  mealId: string | null;
  servings: number;
  away: boolean;
}

describe('Déplacer un créneau (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let user: TestUser;
  let carbo: string;
  let wraps: string;

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
    const lardons = await request(app.getHttpServer())
      .post('/ingredients')
      .set(...bearer(admin))
      .send({ name: 'Lardons' })
      .expect(201);
    const create = async (name: string) =>
      (
        await request(app.getHttpServer())
          .post('/meals')
          .set(...bearer(admin))
          .send({
            name,
            ingredients: [
              { ingredientId: lardons.body.id, quantity: 100, unit: 'g' },
            ],
          })
          .expect(201)
      ).body.id as string;
    carbo = await create('Pâtes carbo');
    wraps = await create('Wraps');
  });

  const slots = async (as = user): Promise<Slot[]> =>
    (
      await request(app.getHttpServer())
        .get('/plan')
        .set(...bearer(as))
        .expect(200)
    ).body.slots as Slot[];

  const at = (all: Slot[], dayIndex: number, slot: Slot['slot']) =>
    all.find((s) => s.dayIndex === dayIndex && s.slot === slot) as Slot;

  const patch = (slotId: string, body: object) =>
    request(app.getHttpServer())
      .patch(`/plan/slots/${slotId}`)
      .set(...bearer(user))
      .send(body)
      .expect(200);

  const move = (slotId: string, targetSlotId: string, as = user) =>
    request(app.getHttpServer())
      .post(`/plan/slots/${slotId}/move`)
      .set(...bearer(as))
      .send({ targetSlotId });

  it('déplace vers un créneau vide, avec les portions', async () => {
    const all = await slots();
    await patch(at(all, 3, 'DINNER').id, { mealId: carbo, servings: 3 });

    await move(at(all, 3, 'DINNER').id, at(all, 5, 'LUNCH').id).expect(200);

    const after = await slots();
    expect(at(after, 3, 'DINNER')).toMatchObject({ mealId: null });
    expect(at(after, 5, 'LUNCH')).toMatchObject({ mealId: carbo, servings: 3 });
  });

  it('échange un repas avec un créneau dehors, sans changer la liste', async () => {
    const all = await slots();
    await patch(at(all, 0, 'LUNCH').id, { mealId: carbo, servings: 2 });
    await patch(at(all, 1, 'LUNCH').id, { away: true });
    const before = await request(app.getHttpServer())
      .get('/plan/shopping-list')
      .set(...bearer(user))
      .expect(200);

    await move(at(all, 0, 'LUNCH').id, at(all, 1, 'LUNCH').id).expect(200);

    const after = await slots();
    expect(at(after, 0, 'LUNCH')).toMatchObject({ mealId: null, away: true });
    expect(at(after, 1, 'LUNCH')).toMatchObject({
      mealId: carbo,
      servings: 2,
      away: false,
    });
    const list = await request(app.getHttpServer())
      .get('/plan/shopping-list')
      .set(...bearer(user))
      .expect(200);
    expect(list.body.items).toEqual(before.body.items);
  });

  it('échange deux repas avec leurs portions, sans changer la liste', async () => {
    const all = await slots();
    const a = at(all, 2, 'LUNCH');
    const b = at(all, 4, 'DINNER');
    await patch(a.id, { mealId: carbo, servings: 2 });
    await patch(b.id, { mealId: wraps, servings: 3 });
    const before = await request(app.getHttpServer())
      .get('/plan/shopping-list')
      .set(...bearer(user))
      .expect(200);

    await move(a.id, b.id).expect(200);

    const after = await slots();
    expect(at(after, 2, 'LUNCH')).toMatchObject({ mealId: wraps, servings: 3 });
    expect(at(after, 4, 'DINNER')).toMatchObject({
      mealId: carbo,
      servings: 2,
    });
    const list = await request(app.getHttpServer())
      .get('/plan/shopping-list')
      .set(...bearer(user))
      .expect(200);
    expect(list.body.items).toEqual(before.body.items);
  });

  it('ne fait rien vers le même créneau', async () => {
    const all = await slots();
    await patch(at(all, 0, 'LUNCH').id, { mealId: carbo });

    await move(at(all, 0, 'LUNCH').id, at(all, 0, 'LUNCH').id).expect(200);

    expect(at(await slots(), 0, 'LUNCH').mealId).toBe(carbo);
  });

  it('rend 404 pour un créneau d’un autre compte', async () => {
    const other = await registerUser(app);
    const mine = at(await slots(), 0, 'LUNCH');
    const theirs = at(await slots(other), 0, 'LUNCH');

    await move(mine.id, theirs.id).expect(404);
    await move(theirs.id, mine.id).expect(404);
  });

  it('valide le corps', async () => {
    const mine = at(await slots(), 0, 'LUNCH');
    await move(mine.id, 'pas-un-uuid').expect(400);
  });

  it('enchaîne deux échanges croisés concurrents sans deadlock', async () => {
    const all = await slots();
    const a = at(all, 0, 'LUNCH');
    const b = at(all, 0, 'DINNER');
    await patch(a.id, { mealId: carbo });
    await patch(b.id, { mealId: wraps });

    const results = await Promise.all([move(a.id, b.id), move(b.id, a.id)]);

    expect(results.map((r) => r.status)).toEqual([200, 200]);
    const after = await slots();
    expect(at(after, 0, 'LUNCH').mealId).toBe(carbo);
    expect(at(after, 0, 'DINNER').mealId).toBe(wraps);
  });
});
