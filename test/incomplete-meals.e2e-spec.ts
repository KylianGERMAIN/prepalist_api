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

describe('Repas à compléter (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let user: TestUser;
  let admin: TestUser;
  let tomate: string;

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
    tomate = (
      await request(app.getHttpServer())
        .post('/ingredients')
        .set(...bearer(admin))
        .send({ name: 'Tomate' })
        .expect(201)
    ).body.id as string;
  });

  const createMeal = async (name: string, withIngredient: boolean) =>
    (
      await request(app.getHttpServer())
        .post('/meals')
        .set(...bearer(admin))
        .send({
          name,
          ingredients: withIngredient
            ? [{ ingredientId: tomate, quantity: 2, unit: 'pièce' }]
            : [],
        })
        .expect(201)
    ).body as { id: string; ingredientCount: number };

  const list = async (query = '') =>
    (
      await request(app.getHttpServer())
        .get(`/meals${query}`)
        .set(...bearer(user))
        .expect(200)
    ).body as { items: { name: string; ingredientCount: number }[] };

  it('compte les ingrédients et filtre les repas sans ingrédient', async () => {
    const porc = await createMeal('Porc à la crème', false);
    await createMeal('Salade', true);
    expect(porc.ingredientCount).toBe(0);

    const all = await list();
    expect(
      Object.fromEntries(all.items.map((m) => [m.name, m.ingredientCount])),
    ).toEqual({ 'Porc à la crème': 0, Salade: 1 });
    expect((await list('?incomplete=true')).items.map((m) => m.name)).toEqual([
      'Porc à la crème',
    ]);
  });

  it('sort du filtre dès qu’on lui ajoute un ingrédient', async () => {
    const porc = await createMeal('Porc à la crème', false);

    await request(app.getHttpServer())
      .patch(`/meals/${porc.id}`)
      .set(...bearer(admin))
      .send({
        ingredients: [{ ingredientId: tomate, quantity: 1, unit: 'pièce' }],
      })
      .expect(200);

    expect((await list('?incomplete=true')).items).toEqual([]);
  });

  it('porte le compte dans le détail et dans la réponse du PATCH', async () => {
    const porc = await createMeal('Porc à la crème', false);

    const patched = await request(app.getHttpServer())
      .patch(`/meals/${porc.id}`)
      .set(...bearer(admin))
      .send({
        ingredients: [{ ingredientId: tomate, quantity: 1, unit: 'pièce' }],
      })
      .expect(200);
    expect(patched.body.ingredientCount).toBe(1);

    const detail = await request(app.getHttpServer())
      .get(`/meals/${porc.id}`)
      .set(...bearer(user))
      .expect(200);
    expect(detail.body.ingredientCount).toBe(1);
  });

  it('ne filtre rien avec incomplete=false', async () => {
    await createMeal('Porc à la crème', false);
    await createMeal('Salade', true);

    expect((await list('?incomplete=false')).items).toHaveLength(2);
  });

  it('pagine par repas malgré plusieurs ingrédients par repas', async () => {
    const oignon = (
      await request(app.getHttpServer())
        .post('/ingredients')
        .set(...bearer(admin))
        .send({ name: 'Oignon' })
        .expect(201)
    ).body.id as string;
    for (let i = 0; i < 25; i++) {
      await request(app.getHttpServer())
        .post('/meals')
        .set(...bearer(admin))
        .send({
          name: `Plat ${i}`,
          ingredients: [
            { ingredientId: tomate, quantity: 1, unit: 'pièce' },
            { ingredientId: oignon, quantity: 1, unit: 'pièce' },
          ],
        })
        .expect(201);
    }

    const page = await list('?limit=20');
    expect(page.items).toHaveLength(20);
    expect(page.items.every((m) => m.ingredientCount === 2)).toBe(true);
  });

  it('signale dans la liste de courses les repas planifiés sans ingrédient, une fois chacun', async () => {
    const porc = await createMeal('Porc à la crème', false);
    const salade = await createMeal('Salade', true);
    const slots = (
      await request(app.getHttpServer())
        .get('/plan')
        .set(...bearer(user))
        .expect(200)
    ).body.slots as { id: string; meal: unknown }[];
    for (const [index, mealId] of [porc.id, porc.id, salade.id].entries()) {
      await request(app.getHttpServer())
        .patch(`/plan/slots/${slots[index].id}`)
        .set(...bearer(user))
        .send({ mealId })
        .expect(200);
    }

    const plan = await request(app.getHttpServer())
      .get('/plan')
      .set(...bearer(user))
      .expect(200);
    const planned = (
      plan.body.slots as { meal: { ingredientCount: number } | null }[]
    )
      .filter((s) => s.meal)
      .map((s) => s.meal?.ingredientCount);
    expect(planned.sort()).toEqual([0, 0, 1]);

    const shopping = await request(app.getHttpServer())
      .get('/plan/shopping-list')
      .set(...bearer(user))
      .expect(200);
    expect(shopping.body.incompleteMeals).toEqual([
      { id: porc.id, name: 'Porc à la crème' },
    ]);
  });
});
