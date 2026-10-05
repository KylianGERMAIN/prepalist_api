import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAisles1788100000000 implements MigrationInterface {
  name = 'AddAisles1788100000000';

  // Recopié de `common/aisle.ts` à dessein : une migration importée de
  // l'applicatif changerait de sens à chaque évolution de l'enum.
  private static readonly AISLES = `'PRODUCE', 'BAKERY', 'MEAT_FISH', 'DAIRY', 'CHEESE_DELI', 'PANTRY_SAVORY', 'PANTRY_SWEET', 'FROZEN', 'DRINKS', 'HOUSEHOLD', 'OTHER'`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "aisle_enum" AS ENUM (${AddAisles1788100000000.AISLES})`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingredients" ADD "aisle" "aisle_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shopping_list_items" ADD "aisle" "aisle_enum"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "shopping_list_items" DROP COLUMN "aisle"`,
    );
    await queryRunner.query(`ALTER TABLE "ingredients" DROP COLUMN "aisle"`);
    await queryRunner.query(`DROP TYPE "aisle_enum"`);
  }
}
