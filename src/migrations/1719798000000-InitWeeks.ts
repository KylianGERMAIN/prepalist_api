import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitWeeks1719798000000 implements MigrationInterface {
  name = 'InitWeeks1719798000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "week_slots"`);
    await queryRunner.query(`DROP TABLE "weeks"`);
    await queryRunner.query(`DROP TYPE "week_slots_slot_enum"`);
  }
}
