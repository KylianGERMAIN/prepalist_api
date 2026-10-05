import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropFavoriteFromUserMealState1787700000000 implements MigrationInterface {
  name = 'DropFavoriteFromUserMealState1787700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_meal_state" DROP COLUMN "is_favorite"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_meal_state" ADD "is_favorite" boolean NOT NULL DEFAULT false`,
    );
  }
}
