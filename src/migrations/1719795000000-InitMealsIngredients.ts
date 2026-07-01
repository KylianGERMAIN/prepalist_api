import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitMealsIngredients1719795000000 implements MigrationInterface {
  name = 'InitMealsIngredients1719795000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ingredients" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "default_unit" character varying,
        CONSTRAINT "UQ_ingredients_name" UNIQUE ("name"),
        CONSTRAINT "PK_ingredients_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "meals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "rating" integer,
        "is_favorite" boolean NOT NULL DEFAULT false,
        "last_cooked_at" TIMESTAMP WITH TIME ZONE,
        "times_cooked" integer NOT NULL DEFAULT 0,
        "tags" text array NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_meals_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_meals_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_meals_user" ON "meals" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "meal_ingredients" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "meal_id" uuid NOT NULL,
        "ingredient_id" uuid NOT NULL,
        "quantity" numeric NOT NULL,
        "unit" character varying NOT NULL,
        CONSTRAINT "PK_meal_ingredients_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_mi_meal" FOREIGN KEY ("meal_id")
          REFERENCES "meals"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_mi_ingredient" FOREIGN KEY ("ingredient_id")
          REFERENCES "ingredients"("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_mi_meal" ON "meal_ingredients" ("meal_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mi_ingredient" ON "meal_ingredients" ("ingredient_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "meal_ingredients"`);
    await queryRunner.query(`DROP TABLE "meals"`);
    await queryRunner.query(`DROP TABLE "ingredients"`);
  }
}
