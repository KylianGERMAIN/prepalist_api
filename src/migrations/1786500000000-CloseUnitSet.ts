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

  /** Le SELECT qui groupe et le DELETE qui purge doivent porter sur le même jeu. */
  private static readonly LEGACY_PIECE = `'pièce', 'Unité', 'u'`;

  // Recopié de `common/unit.ts` à dessein : une migration importée de
  // l'applicatif changerait de sens à chaque évolution de l'enum.
  private static readonly UNITS = `'g', 'ml', 'pièce', 'tranche', 'gousse', 'feuille', 'boîte', 'rouleau', 'boule', 'c.à.s', 'c.à.c'`;

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
             sum("quantity") AS "quantity",
             bool_and("checked") AS "checked"
      FROM "shopping_list_items"
      WHERE "source" = 'DERIVED'
        AND "unit" IN (${CloseUnitSet1786500000000.LEGACY_PIECE})
      GROUP BY "plan_id", "ingredient_id"
      HAVING count(*) > 1
    `);
    await queryRunner.query(`
      DELETE FROM "shopping_list_items" s
      USING "merged_piece" m
      WHERE s."source" = 'DERIVED'
        AND s."unit" IN (${CloseUnitSet1786500000000.LEGACY_PIECE})
        AND s."plan_id" = m."plan_id" AND s."ingredient_id" = m."ingredient_id"
    `);
    await queryRunner.query(`
      INSERT INTO "shopping_list_items"
        ("plan_id", "source", "ingredient_id", "name", "unit", "quantity", "checked")
      SELECT "plan_id", 'DERIVED', "ingredient_id", "name", 'pièce', "quantity", "checked"
      FROM "merged_piece"
    `);
    await queryRunner.query(`DROP TABLE "merged_piece"`);
    // `source = 'DERIVED'` : un item ajouté à la main garde l'unité tapée, même
    // si elle ressemble à une écriture historique de « pièce ».
    await queryRunner.query(
      `UPDATE "shopping_list_items" SET "unit" = 'pièce'
       WHERE "source" = 'DERIVED' AND "unit" IN ('Unité', 'u')`,
    );

    // Le cast ci-dessous refuse déjà une valeur inconnue, mais sans dire
    // laquelle — et `start:migrate` empêche alors l'API de démarrer.
    await queryRunner.query(`
      DO $$
      DECLARE orphans text;
      BEGIN
        SELECT string_agg(DISTINCT u, ', ') INTO orphans
        FROM (
          SELECT "unit" AS u FROM "meal_ingredients"
          UNION
          SELECT "default_unit" FROM "ingredients" WHERE "default_unit" IS NOT NULL
        ) s
        WHERE u <> ALL (ARRAY[${CloseUnitSet1786500000000.UNITS}]);
        IF orphans IS NOT NULL THEN
          RAISE EXCEPTION 'Unités hors du jeu fermé, à corriger avant de migrer : %', orphans;
        END IF;
      END $$;
    `);

    await queryRunner.query(
      `CREATE TYPE "unit_enum" AS ENUM (${CloseUnitSet1786500000000.UNITS})`,
    );
    await queryRunner.query(
      `ALTER TABLE "meal_ingredients" ALTER COLUMN "unit" TYPE "unit_enum" USING "unit"::"unit_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingredients" ALTER COLUMN "default_unit" TYPE "unit_enum" USING "default_unit"::"unit_enum"`,
    );
  }

  /**
   * Rend le type, pas les données : `Unité` et les lignes fusionnées sont
   * perdues, et une ligne fusionnée a changé d'`id`.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ingredients" ALTER COLUMN "default_unit" TYPE character varying USING "default_unit"::text`,
    );
    await queryRunner.query(
      `ALTER TABLE "meal_ingredients" ALTER COLUMN "unit" TYPE character varying USING "unit"::text`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "unit_enum"`);
  }
}
