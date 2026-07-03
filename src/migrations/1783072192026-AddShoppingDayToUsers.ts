import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShoppingDayToUsers1783072192026 implements MigrationInterface {
  name = 'AddShoppingDayToUsers1783072192026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "shopping_day" integer NOT NULL DEFAULT 1`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "shopping_day"`);
  }
}
