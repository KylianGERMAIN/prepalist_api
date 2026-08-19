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

describe('Invariants de base (e2e)', () => {
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
  });

  async function createIngredient(name: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/ingredients')
      .set(...bearer(user))
      .send({ name })
      .expect(201);
    return res.body.id as string;
  }

  async function createMeal(
    admin: TestUser,
    ingredients: { ingredientId: string; quantity: number; unit: string }[],
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/meals')
      .set(...bearer(admin))
      .send({ name: 'Pâtes', ingredients })
      .expect(201);
    return res.body.id as string;
  }

  // Contrat HTTP du doublon, porté par le pré-check de IngredientsService : ce
  // test resterait vert sans l'index, que le suivant couvre.
  it('rend 409 sur un ingrédient qui ne diffère que par la casse', async () => {
    await createIngredient('Beurre');

    await request(app.getHttpServer())
      .post('/ingredients')
      .set(...bearer(user))
      .send({ name: 'beurre' })
      .expect(409);
  });

  // Écrit en SQL pour contourner le pré-check : c'est UQ_ingredients_name_lower
  // qu'on teste, le dernier rempart en cas de course.
  it('fait porter l’unicité insensible à la casse par la base', async () => {
    await createIngredient('Beurre');

    await expect(
      db.query('INSERT INTO ingredients (name) VALUES ($1)', ['BEURRE']),
    ).rejects.toMatchObject({ code: '23505' });
  });

  // UQ_plans_user : c'est lui qui rattrape la course de PlanService.ensure,
  // dont la branche isUniqueViolation dépend entièrement de cette contrainte.
  it('interdit deux plans pour un même compte', async () => {
    const plan = await request(app.getHttpServer())
      .get('/plan')
      .set(...bearer(user))
      .expect(200);

    const [{ user_id: userId }] = await db.query(
      'SELECT user_id FROM plans WHERE id = $1',
      [plan.body.id],
    );
    await expect(
      db.query(
        'INSERT INTO plans (user_id, start_date, day_count) VALUES ($1, $2, 7)',
        [userId, '2026-01-01'],
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });

  // UQ_shopping_items_derived est partiel (WHERE source = 'DERIVED') : c'est ce
  // qui rend correcte l'init paresseuse concurrente sans bloquer les ajouts manuels.
  it('interdit deux items dérivés de même clé, mais l’autorise aux items manuels', async () => {
    const ingredientId = await createIngredient('Tomate');
    const plan = await request(app.getHttpServer())
      .get('/plan')
      .set(...bearer(user))
      .expect(200);

    const insert = (source: 'DERIVED' | 'MANUAL') =>
      db.query(
        `INSERT INTO shopping_list_items (plan_id, source, ingredient_id, name, unit, quantity, checked)
         VALUES ($1, $2, $3, 'Tomate', 'g', 250, false)`,
        [plan.body.id, source, ingredientId],
      );

    await insert('DERIVED');
    await expect(insert('DERIVED')).rejects.toMatchObject({ code: '23505' });

    await insert('MANUAL');
    await insert('MANUAL');
    const rows = await db.query(
      "SELECT COUNT(*)::int AS n FROM shopping_list_items WHERE source = 'MANUAL'",
    );
    expect(rows[0].n).toBe(2);
  });

  it('interdit une ligne d’ingrédient détachée de son repas', async () => {
    const admin = await registerAdmin(app, db);
    const tomate = await createIngredient('Tomate');
    await createMeal(admin, [
      { ingredientId: tomate, quantity: 250, unit: 'g' },
    ]);

    await expect(
      db.query('UPDATE meal_ingredients SET meal_id = NULL'),
    ).rejects.toMatchObject({ code: '23502' });
  });

  it('supprime les lignes d’ingrédients retirées d’un repas', async () => {
    const admin = await registerAdmin(app, db);
    const tomate = await createIngredient('Tomate');
    const basilic = await createIngredient('Basilic');
    const mealId = await createMeal(admin, [
      { ingredientId: tomate, quantity: 250, unit: 'g' },
      { ingredientId: basilic, quantity: 10, unit: 'g' },
    ]);

    await request(app.getHttpServer())
      .patch(`/meals/${mealId}`)
      .set(...bearer(admin))
      .send({
        ingredients: [{ ingredientId: tomate, quantity: 250, unit: 'g' }],
      })
      .expect(200);

    // Compté sans filtrer sur meal_id : avec `nullify` au lieu de `delete`, la
    // ligne retirée survivrait détachée et un filtre par repas ne la verrait pas.
    const rows = await db.query(
      'SELECT COUNT(*)::int AS n FROM meal_ingredients',
    );
    expect(rows[0].n).toBe(1);
  });

  // FK_plan_slots_meal est en SET NULL : en CASCADE, supprimer un repas du
  // catalogue effacerait les créneaux des plans de tous les utilisateurs.
  it('vide le créneau au lieu de le supprimer quand le repas disparaît', async () => {
    const admin = await registerAdmin(app, db);
    const tomate = await createIngredient('Tomate');
    const mealId = await createMeal(admin, [
      { ingredientId: tomate, quantity: 250, unit: 'g' },
    ]);
    const plan = await request(app.getHttpServer())
      .get('/plan')
      .set(...bearer(user))
      .expect(200);
    const slotId = plan.body.slots[0].id as string;
    await request(app.getHttpServer())
      .patch(`/plan/slots/${slotId}`)
      .set(...bearer(user))
      .send({ mealId })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/meals/${mealId}`)
      .set(...bearer(admin))
      .expect(204);

    const after = await request(app.getHttpServer())
      .get('/plan')
      .set(...bearer(user))
      .expect(200);
    const slots = after.body.slots as { id: string; mealId: string | null }[];
    expect(slots).toHaveLength(14);
    expect(slots.find((s) => s.id === slotId)?.mealId).toBeNull();
  });

  // ON DELETE CASCADE sur plans.user_id : sans lui, la suppression du compte
  // échouerait sur la contrainte, ou laisserait un plan orphelin.
  it('supprime le plan avec le compte', async () => {
    const plan = await request(app.getHttpServer())
      .get('/plan')
      .set(...bearer(user))
      .expect(200);

    await db.query('DELETE FROM users WHERE email = $1', [user.email]);

    const rows = await db.query(
      'SELECT COUNT(*)::int AS n FROM plans WHERE id = $1',
      [plan.body.id],
    );
    expect(rows[0].n).toBe(0);
  });
});
