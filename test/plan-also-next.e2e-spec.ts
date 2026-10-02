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
}

describe('Créneau suivant (e2e)', () => {
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
    const createMeal = async (name: string) =>
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
    carbo = await createMeal('Pâtes carbo');
    wraps = await createMeal('Wraps');
  });

  const slots = async (): Promise<Slot[]> =>
    (
      await request(app.getHttpServer())
        .get('/plan')
        .set(...bearer(user))
        .expect(200)
    ).body.slots as Slot[];

  const at = (all: Slot[], dayIndex: number, slot: Slot['slot']) =>
    all.find((s) => s.dayIndex === dayIndex && s.slot === slot) as Slot;

  const patch = (slotId: string, body: object) =>
    request(app.getHttpServer())
      .patch(`/plan/slots/${slotId}`)
      .set(...bearer(user))
      .send(body);

  it('copie le repas et les portions du midi sur le soir', async () => {
    const all = await slots();
    await patch(at(all, 2, 'LUNCH').id, {
      mealId: carbo,
      servings: 3,
      alsoNext: true,
    }).expect(200);

    const dinner = at(await slots(), 2, 'DINNER');
    expect(dinner).toMatchObject({ mealId: carbo, servings: 3 });
  });

  it('copie le soir sur le midi du lendemain, en écrasant son repas', async () => {
    const all = await slots();
    await patch(at(all, 4, 'LUNCH').id, { mealId: wraps }).expect(200);

    await patch(at(all, 3, 'DINNER').id, {
      mealId: carbo,
      alsoNext: true,
    }).expect(200);

    expect(at(await slots(), 4, 'LUNCH')).toMatchObject({ mealId: carbo });
  });

  it('refuse le créneau suivant après le dernier dîner, sans rien écrire', async () => {
    const all = await slots();
    const last = at(all, 6, 'DINNER');

    await patch(last.id, { mealId: carbo, alsoNext: true }).expect(400);

    expect(at(await slots(), 6, 'DINNER').mealId).toBeNull();
  });

  it('compte les ingrédients sur les deux créneaux dans la liste', async () => {
    const all = await slots();
    await patch(at(all, 0, 'LUNCH').id, {
      mealId: carbo,
      alsoNext: true,
    }).expect(200);

    const list = await request(app.getHttpServer())
      .get('/plan/shopping-list')
      .set(...bearer(user))
      .expect(200);
    expect(list.body.items).toMatchObject([{ name: 'Lardons', quantity: 200 }]);
  });

  it('refuse de reporter un créneau vide, sans toucher au suivant', async () => {
    const all = await slots();
    await patch(at(all, 1, 'DINNER').id, { mealId: wraps }).expect(200);

    await patch(at(all, 1, 'LUNCH').id, {
      mealId: null,
      alsoNext: true,
    }).expect(400);

    expect(at(await slots(), 1, 'DINNER').mealId).toBe(wraps);
  });

  it('reporte l’état actuel avec alsoNext seul', async () => {
    const all = await slots();
    await patch(at(all, 2, 'LUNCH').id, { mealId: carbo, servings: 2 }).expect(
      200,
    );

    await patch(at(all, 2, 'LUNCH').id, { alsoNext: true }).expect(200);

    expect(at(await slots(), 2, 'DINNER')).toMatchObject({
      mealId: carbo,
      servings: 2,
    });
  });

  it('ne touche pas au suivant avec alsoNext à false', async () => {
    const all = await slots();
    await patch(at(all, 2, 'LUNCH').id, {
      mealId: carbo,
      alsoNext: false,
    }).expect(200);

    expect(at(await slots(), 2, 'DINNER').mealId).toBeNull();
  });
});
