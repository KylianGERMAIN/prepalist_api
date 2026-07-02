import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Retire l'appartenance des repas à un utilisateur : le catalogue de repas
 * devient partagé (lecture pour tous, écriture réservée au rôle ADMIN via
 * `@Roles` côté MealsController). `down()` restaure la colonne en nullable
 * seulement — l'affectation d'origine par utilisateur n'est pas récupérable.
 */
export class MakeMealsGlobal1719804000000 implements MigrationInterface {
  name = 'MakeMealsGlobal1719804000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_meals_user"`);
    await queryRunner.query(
      `ALTER TABLE "meals" DROP CONSTRAINT "FK_meals_user"`,
    );
    await queryRunner.query(`ALTER TABLE "meals" DROP COLUMN "user_id"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "meals" ADD "user_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "meals" ADD CONSTRAINT "FK_meals_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_meals_user" ON "meals" ("user_id")`,
    );
  }
}
