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
  away: boolean;
}

describe('Créneaux « dehors » (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let user: TestUser;
  let carbo: string;

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
    carbo = (
      await request(app.getHttpServer())
        .post('/meals')
        .set(...bearer(admin))
        .send({ name: 'Pâtes carbo' })
        .expect(201)
    ).body.id as string;
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

  it('marque un créneau dehors en le vidant, et une assignation le retire', async () => {
    const lunch = at(await slots(), 0, 'LUNCH');
    await patch(lunch.id, { mealId: carbo }).expect(200);

    await patch(lunch.id, { away: true }).expect(200);
    expect(at(await slots(), 0, 'LUNCH')).toMatchObject({
      away: true,
      mealId: null,
    });

    await patch(lunch.id, { mealId: carbo }).expect(200);
    expect(at(await slots(), 0, 'LUNCH')).toMatchObject({
      away: false,
      mealId: carbo,
    });
  });

  it('refuse away et un repas dans la même requête', async () => {
    const lunch = at(await slots(), 0, 'LUNCH');
    await patch(lunch.id, { away: true, mealId: carbo }).expect(400);
  });

  it('laisse la génération ignorer les créneaux dehors', async () => {
    const lunch = at(await slots(), 0, 'LUNCH');
    await patch(lunch.id, { away: true }).expect(200);

    await request(app.getHttpServer())
      .post('/plan/generate')
      .set(...bearer(user))
      .expect(200);

    const after = await slots();
    expect(at(after, 0, 'LUNCH')).toMatchObject({ away: true, mealId: null });
    expect(at(after, 0, 'DINNER').mealId).toBe(carbo);
  });

  it('remet away à false quand on vide le plan', async () => {
    const lunch = at(await slots(), 0, 'LUNCH');
    await patch(lunch.id, { away: true }).expect(200);

    await request(app.getHttpServer())
      .delete('/plan/slots')
      .set(...bearer(user))
      .expect(200);

    expect(at(await slots(), 0, 'LUNCH').away).toBe(false);
  });

  it('reporte l’état dehors sur le créneau suivant', async () => {
    const all = await slots();
    await patch(at(all, 0, 'DINNER').id, { mealId: carbo }).expect(200);

    await patch(at(all, 0, 'LUNCH').id, { away: true, alsoNext: true }).expect(
      200,
    );

    expect(at(await slots(), 0, 'DINNER')).toMatchObject({
      away: true,
      mealId: null,
    });
  });

  it('interdit en base un créneau dehors qui porte un repas', async () => {
    const lunch = at(await slots(), 0, 'LUNCH');
    await expect(
      db.query(
        `UPDATE plan_slots SET away = true, meal_id = $1 WHERE id = $2`,
        [carbo, lunch.id],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });
});
