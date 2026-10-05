import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillIngredientDefaultUnit1787000000000 implements MigrationInterface {
  name = 'BackfillIngredientDefaultUnit1787000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // `unit` est un enum : à égalité, `ORDER BY` suit l'ordre de déclaration du
    // type (g, ml, pièce…), pas l'ordre alphabétique.
    await queryRunner.query(`
      UPDATE "ingredients" i
      SET "default_unit" = top."unit"
      FROM (
        SELECT DISTINCT ON ("ingredient_id") "ingredient_id", "unit"
        FROM "meal_ingredients"
        GROUP BY "ingredient_id", "unit"
        ORDER BY "ingredient_id", count(*) DESC, "unit"
      ) top
      WHERE top."ingredient_id" = i."id"
        AND i."default_unit" IS NULL
    `);
  }

  // Irréversible : rien ne distingue une unité déduite ici d'une unité saisie.
  public async down(): Promise<void> {}
}
