import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDescriptionToMeals1787600000000 implements MigrationInterface {
  name = 'AddDescriptionToMeals1787600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "meals" ADD "description" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "meals" DROP COLUMN "description"`);
  }
}
