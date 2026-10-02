import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropCookingTrackingFromUserMealState1787800000000 implements MigrationInterface {
  name = 'DropCookingTrackingFromUserMealState1787800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_meal_state" DROP COLUMN "last_cooked_at", DROP COLUMN "times_cooked"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_meal_state" ADD "last_cooked_at" TIMESTAMP WITH TIME ZONE, ADD "times_cooked" integer NOT NULL DEFAULT 0`,
    );
  }
}
