import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Remplace le modèle « semaine identifiée par sa date » par un plan unique par
 * utilisateur, dont les créneaux sont rangés par index de jour.
 *
 * Destructif et assumé : les plannings et listes de courses existants sont
 * perdus. `users`, `meals`, `meal_ingredients` et `ingredients` sont intacts.
 * `down()` restaure le schéma d'origine, pas les données.
 */
export class ReplaceWeeksWithSingletonPlan1785400000000 implements MigrationInterface {
  name = 'ReplaceWeeksWithSingletonPlan1785400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // shopping_list_items d'abord : sa FK pointe sur weeks.
    await queryRunner.query(`DROP TABLE "shopping_list_items"`);
    await queryRunner.query(`DROP TABLE "week_slots"`);
    await queryRunner.query(`DROP TABLE "weeks"`);
    await queryRunner.query(`DROP TYPE "week_slots_slot_enum"`);

    await queryRunner.query(`
      CREATE TABLE "plans" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "start_date" date NOT NULL,
        "day_count" smallint NOT NULL DEFAULT 7,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_plans_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_plans_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    // Un seul plan par utilisateur : c'est cette unicité qui remplace la
    // recherche par date. À passer en index partiel le jour de l'archivage.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_plans_user" ON "plans" ("user_id")`,
    );

    await queryRunner.query(
      `CREATE TYPE "plan_slots_slot_enum" AS ENUM ('LUNCH', 'DINNER')`,
    );
    await queryRunner.query(`
      CREATE TABLE "plan_slots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "plan_id" uuid NOT NULL,
        "day_index" smallint NOT NULL,
        "slot" "plan_slots_slot_enum" NOT NULL,
        "meal_id" uuid,
        "servings" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_plan_slots_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_plan_slots_plan" FOREIGN KEY ("plan_id")
          REFERENCES "plans"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_plan_slots_meal" FOREIGN KEY ("meal_id")
          REFERENCES "meals"("id") ON DELETE SET NULL,
        CONSTRAINT "UQ_plan_slots_plan_day_slot" UNIQUE ("plan_id", "day_index", "slot")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_plan_slots_plan" ON "plan_slots" ("plan_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "shopping_list_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "plan_id" uuid NOT NULL,
        "source" "shopping_list_items_source_enum" NOT NULL,
        "ingredient_id" uuid,
        "name" character varying NOT NULL,
        "unit" character varying,
        "quantity" numeric,
        "checked" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shopping_list_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_shopping_items_plan" FOREIGN KEY ("plan_id")
          REFERENCES "plans"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_shopping_items_ingredient" FOREIGN KEY ("ingredient_id")
          REFERENCES "ingredients"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_shopping_items_plan" ON "shopping_list_items" ("plan_id")`,
    );
    // Unicité limitée aux lignes DERIVED : un index partiel, pas une contrainte
    // de colonne (une contrainte Postgres ne peut pas être partielle). Les MANUAL
    // (ingredient_id NULL) sont hors périmètre et non contraints.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_shopping_items_derived" ON "shopping_list_items" ("plan_id", "ingredient_id", "unit") WHERE "source" = 'DERIVED'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "shopping_list_items"`);
    await queryRunner.query(`DROP TABLE "plan_slots"`);
    await queryRunner.query(`DROP TYPE "plan_slots_slot_enum"`);
    await queryRunner.query(`DROP TABLE "plans"`);

    await queryRunner.query(
      `CREATE TYPE "week_slots_slot_enum" AS ENUM ('LUNCH', 'DINNER')`,
    );
    await queryRunner.query(`
      CREATE TABLE "weeks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "start_date" date NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_weeks_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_weeks_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_weeks_user" ON "weeks" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_weeks_user_start" ON "weeks" ("user_id", "start_date")`,
    );
    await queryRunner.query(`
      CREATE TABLE "week_slots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "week_id" uuid NOT NULL,
        "date" date NOT NULL,
        "slot" "week_slots_slot_enum" NOT NULL,
        "meal_id" uuid,
        "servings" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_week_slots_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_slots_week" FOREIGN KEY ("week_id")
          REFERENCES "weeks"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_slots_meal" FOREIGN KEY ("meal_id")
          REFERENCES "meals"("id") ON DELETE SET NULL,
        CONSTRAINT "UQ_slots_week_date_slot" UNIQUE ("week_id", "date", "slot")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_slots_week" ON "week_slots" ("week_id")`,
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
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_shopping_items_derived" ON "shopping_list_items" ("week_id", "ingredient_id", "unit") WHERE "source" = 'DERIVED'`,
    );
  }
}
