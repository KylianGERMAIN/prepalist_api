import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Remplace la contrainte UNIQUE sensible à la casse sur ingredients.name par
 * un index fonctionnel UNIQUE sur LOWER(name) : « Tomate » et « tomate » ne
 * peuvent plus coexister, même en cas de course (le check applicatif ILike ne
 * couvre pas la concurrence).
 */
export class IngredientNameCaseInsensitive1719801000000 implements MigrationInterface {
  name = 'IngredientNameCaseInsensitive1719801000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ingredients" DROP CONSTRAINT "UQ_ingredients_name"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_ingredients_name_lower" ON "ingredients" (LOWER("name"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_ingredients_name_lower"`);
    await queryRunner.query(
      `ALTER TABLE "ingredients" ADD CONSTRAINT "UQ_ingredients_name" UNIQUE ("name")`,
    );
  }
}
