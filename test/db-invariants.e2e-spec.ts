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
  let admin: TestUser;

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
  });

  async function createIngredient(name: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/ingredients')
      .set(...bearer(user))
      .send({ name })
      .expect(201);
    return res.body.id as string;
  }

  // Échouerait sans l'index fonctionnel UNIQUE (LOWER(name)) sur ingredients.
  it('refuse un ingrédient qui ne diffère que par la casse', async () => {
    await createIngredient('Beurre');

    await request(app.getHttpServer())
      .post('/ingredients')
      .set(...bearer(user))
      .send({ name: 'beurre' })
      .expect(409);

    const rows = await db.query('SELECT COUNT(*)::int AS n FROM ingredients');
    expect(rows[0].n).toBe(1);
  });

  // Écrit directement en base pour contourner le pré-check applicatif : c'est
  // l'index qu'on teste, pas le `getOne()` de IngredientsService.
  it('fait porter l’unicité par la base et non par le pré-check', async () => {
    await createIngredient('Beurre');

    await expect(
      db.query('INSERT INTO ingredients (name) VALUES ($1)', ['BEURRE']),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('peuple la liste au premier accès depuis les repas du plan', async () => {
    const ingredientId = await createIngredient('Tomate');
    const mealRes = await request(app.getHttpServer())
      .post('/meals')
      .set(...bearer(admin))
      .send({
        name: 'Pâtes',
        ingredients: [{ ingredientId, quantity: 250, unit: 'g' }],
      })
      .expect(201);

    const plan = await request(app.getHttpServer())
      .get('/plan')
      .set(...bearer(user))
      .expect(200);
    const slotId = plan.body.slots[0].id as string;
    await request(app.getHttpServer())
      .patch(`/plan/slots/${slotId}`)
      .set(...bearer(user))
      .send({ mealId: mealRes.body.id })
      .expect(200);

    const list = await request(app.getHttpServer())
      .get('/plan/shopping-list')
      .set(...bearer(user))
      .expect(200);

    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({ name: 'Tomate', quantity: 250 });

    // Un second accès ne réinjecte pas la liste.
    await request(app.getHttpServer())
      .get('/plan/shopping-list')
      .set(...bearer(user))
      .expect(200);
    const rows = await db.query(
      "SELECT COUNT(*)::int AS n FROM shopping_list_items WHERE source = 'DERIVED'",
    );
    expect(rows[0].n).toBe(1);
  });

  // L'index unique partiel UQ_shopping_items_derived est ce qui rend l'init
  // paresseuse concurrente correcte : deux sync simultanés s'appuient sur lui.
  it('interdit deux items dérivés de même clé, mais l’autorise aux items manuels', async () => {
    const ingredientId = await createIngredient('Tomate');
    const plan = await request(app.getHttpServer())
      .get('/plan')
      .set(...bearer(user))
      .expect(200);
    const planId = plan.body.id as string;

    const insert = (source: 'DERIVED' | 'MANUAL') =>
      db.query(
        `INSERT INTO shopping_list_items (plan_id, source, ingredient_id, name, unit, quantity, checked)
         VALUES ($1, $2, $3, 'Tomate', 'g', 250, false)`,
        [planId, source, ingredientId],
      );

    await insert('DERIVED');
    await expect(insert('DERIVED')).rejects.toMatchObject({ code: '23505' });

    // Le WHERE source = 'DERIVED' de l'index : les items manuels y échappent.
    await insert('MANUAL');
    await insert('MANUAL');
    const rows = await db.query(
      "SELECT COUNT(*)::int AS n FROM shopping_list_items WHERE source = 'MANUAL'",
    );
    expect(rows[0].n).toBe(2);
  });

  // meal_ingredients.meal_id est NOT NULL : détacher au lieu de supprimer
  // ferait échouer le PATCH. C'est le sujet de #31.
  it('supprime les lignes d’ingrédients retirées d’un repas', async () => {
    const tomate = await createIngredient('Tomate');
    const basilic = await createIngredient('Basilic');
    const created = await request(app.getHttpServer())
      .post('/meals')
      .set(...bearer(admin))
      .send({
        name: 'Pâtes',
        ingredients: [
          { ingredientId: tomate, quantity: 250, unit: 'g' },
          { ingredientId: basilic, quantity: 10, unit: 'g' },
        ],
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/meals/${created.body.id}`)
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

  it('interdit une ligne d’ingrédient détachée de son repas', async () => {
    const tomate = await createIngredient('Tomate');
    await request(app.getHttpServer())
      .post('/meals')
      .set(...bearer(admin))
      .send({
        name: 'Pâtes',
        ingredients: [{ ingredientId: tomate, quantity: 250, unit: 'g' }],
      })
      .expect(201);

    await expect(
      db.query('UPDATE meal_ingredients SET meal_id = NULL'),
    ).rejects.toMatchObject({ code: '23502' });
  });

  // ON DELETE CASCADE sur plans.user_id : sans lui, la suppression du compte
  // échouerait sur la contrainte, ou laisserait un plan orphelin.
  it('supprime le plan avec le compte', async () => {
    await request(app.getHttpServer())
      .get('/plan')
      .set(...bearer(user))
      .expect(200);

    await db.query('DELETE FROM users WHERE email = $1', [user.email]);

    const rows = await db.query('SELECT COUNT(*)::int AS n FROM plans');
    expect(rows[0].n).toBe(0);
  });
});
