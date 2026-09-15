import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ferme le jeu d'unités des recettes. `Unité`, `u` et `pièce` coexistaient pour
 * la même chose et produisaient deux lignes de courses par ingrédient.
 *
 * `shopping_list_items.unit` reste en texte libre : un item ajouté à la main
 * porte l'unité que l'utilisateur a tapée, qu'aucun enum ne peut couvrir.
 */
export class CloseUnitSet1786500000000 implements MigrationInterface {
  name = 'CloseUnitSet1786500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "meal_ingredients" SET "unit" = 'pièce' WHERE "unit" IN ('Unité', 'u')`,
    );
    await queryRunner.query(
      `UPDATE "ingredients" SET "default_unit" = 'pièce' WHERE "default_unit" IN ('Unité', 'u')`,
    );

    // Les lignes de courses dérivées en collision fusionnent en une seule :
    // l'index unique partiel (plan, ingrédient, unité) refuserait le repli.
    // Reconstruites plutôt que modifiées, pour rester juste quel que soit le
    // nombre de variantes présentes. `checked` en ET : une quantité qui augmente
    // ne peut pas rester cochée.
    await queryRunner.query(`
      CREATE TEMP TABLE "merged_piece" AS
      SELECT "plan_id", "ingredient_id", min("name") AS "name",
             sum(COALESCE("quantity", 0)) AS "quantity",
             bool_and("checked") AS "checked"
      FROM "shopping_list_items"
      WHERE "source" = 'DERIVED' AND "unit" IN ('pièce', 'Unité', 'u')
      GROUP BY "plan_id", "ingredient_id"
      HAVING count(*) > 1
    `);
    await queryRunner.query(`
      DELETE FROM "shopping_list_items" s
      USING "merged_piece" m
      WHERE s."source" = 'DERIVED' AND s."unit" IN ('pièce', 'Unité', 'u')
        AND s."plan_id" = m."plan_id" AND s."ingredient_id" = m."ingredient_id"
    `);
    await queryRunner.query(`
      INSERT INTO "shopping_list_items"
        ("plan_id", "source", "ingredient_id", "name", "unit", "quantity", "checked")
      SELECT "plan_id", 'DERIVED', "ingredient_id", "name", 'pièce', "quantity", "checked"
      FROM "merged_piece"
    `);
    await queryRunner.query(`DROP TABLE "merged_piece"`);
    await queryRunner.query(
      `UPDATE "shopping_list_items" SET "unit" = 'pièce' WHERE "unit" IN ('Unité', 'u')`,
    );

    await queryRunner.query(
      `CREATE TYPE "unit_enum" AS ENUM ('g', 'ml', 'pièce', 'tranche', 'gousse', 'feuille', 'boîte', 'rouleau', 'boule', 'c.à.s', 'c.à.c')`,
    );
    // Une valeur hors de cette liste fait échouer le cast, et la migration avec.
    await queryRunner.query(
      `ALTER TABLE "meal_ingredients" ALTER COLUMN "unit" TYPE "unit_enum" USING "unit"::"unit_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingredients" ALTER COLUMN "default_unit" TYPE "unit_enum" USING "default_unit"::"unit_enum"`,
    );
  }

  /** Rend le type, pas les données : `Unité` et les lignes fusionnées sont perdues. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ingredients" ALTER COLUMN "default_unit" TYPE character varying USING "default_unit"::text`,
    );
    await queryRunner.query(
      `ALTER TABLE "meal_ingredients" ALTER COLUMN "unit" TYPE character varying USING "unit"::text`,
    );
    await queryRunner.query(`DROP TYPE "unit_enum"`);
  }
}
