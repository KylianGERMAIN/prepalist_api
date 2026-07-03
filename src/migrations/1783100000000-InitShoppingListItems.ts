import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitShoppingListItems1783100000000 implements MigrationInterface {
  name = 'InitShoppingListItems1783100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "shopping_list_items_source_enum" AS ENUM ('DERIVED', 'MANUAL')`,
    );

    await queryRunner.query(`
      CREATE TABLE "shopping_list_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "week_id" uuid NOT NULL,
        "source" "shopping_list_items_source_enum" NOT NULL,
        "ingredient_id" uuid,
        "name" character varying NOT NULL,
        "unit" character varying,
        "quantity" numeric,
        "checked" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shopping_list_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_shopping_items_week" FOREIGN KEY ("week_id")
          REFERENCES "weeks"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_shopping_items_ingredient" FOREIGN KEY ("ingredient_id")
          REFERENCES "ingredients"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_shopping_items_week" ON "shopping_list_items" ("week_id")`,
    );
    // Unicité limitée aux lignes DERIVED : un index partiel, pas une contrainte
    // de colonne (une contrainte Postgres ne peut pas être partielle). Les MANUAL
    // (ingredient_id NULL) sont hors périmètre et non contraints.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_shopping_items_derived" ON "shopping_list_items" ("week_id", "ingredient_id", "unit") WHERE "source" = 'DERIVED'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "shopping_list_items"`);
    await queryRunner.query(`DROP TYPE "shopping_list_items_source_enum"`);
  }
}
