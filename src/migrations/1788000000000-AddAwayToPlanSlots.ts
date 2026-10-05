import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAwayToPlanSlots1788000000000 implements MigrationInterface {
  name = 'AddAwayToPlanSlots1788000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan_slots" ADD "away" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan_slots" ADD CONSTRAINT "CHK_plan_slots_away_empty" CHECK (NOT ("away" AND "meal_id" IS NOT NULL))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan_slots" DROP CONSTRAINT "CHK_plan_slots_away_empty"`,
    );
    await queryRunner.query(`ALTER TABLE "plan_slots" DROP COLUMN "away"`);
  }
}
