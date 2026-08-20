import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sort de `meals` ce qui appartient à un compte et non à la recette : favori,
 * note, date et nombre de cuissons. Le catalogue étant partagé, ces colonnes
 * faisaient qu'un compte écrivait dans l'état de tous les autres (#24).
 *
 * Pose au passage `user_id` (NULL = recette de l'application) et `status`, que
 * rien ne lit encore : les backfiller plus tard, sur des recettes créées par
 * plusieurs comptes, n'aurait plus de réponse évidente.
 *
 * L'état existant est attribué au plus ancien compte ADMIN — le seul à avoir pu
 * produire des cuissons sur un catalogue en écriture admin. `down()` le rend au
 * même compte ; l'état des autres comptes, lui, est perdu.
 */
export class MoveMealStateToUser1786000000000 implements MigrationInterface {
  name = 'MoveMealStateToUser1786000000000';

  private static readonly OLDEST_ADMIN = `
    SELECT "id" FROM "users" WHERE "role" = 'ADMIN'
    ORDER BY "created_at" ASC, "id" ASC LIMIT 1
  `;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "meals" ADD "user_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "meals" ADD CONSTRAINT "FK_meals_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_meals_user" ON "meals" ("user_id")`,
    );

    await queryRunner.query(
      `CREATE TYPE "meals_status_enum" AS ENUM ('PRIVATE', 'PENDING', 'PUBLISHED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "meals" ADD "status" "meals_status_enum" NOT NULL DEFAULT 'PRIVATE'`,
    );
    // L'existant a été créé en admin sur un catalogue partagé : c'est le
    // catalogue de l'application, pas les recettes privées de quelqu'un.
    await queryRunner.query(`UPDATE "meals" SET "status" = 'PUBLISHED'`);

    await queryRunner.query(`
      CREATE TABLE "user_meal_state" (
        "user_id" uuid NOT NULL,
        "meal_id" uuid NOT NULL,
        "is_favorite" boolean NOT NULL DEFAULT false,
        "rating" integer,
        "last_cooked_at" TIMESTAMP WITH TIME ZONE,
        "times_cooked" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_user_meal_state" PRIMARY KEY ("user_id", "meal_id"),
        CONSTRAINT "FK_user_meal_state_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_meal_state_meal" FOREIGN KEY ("meal_id")
          REFERENCES "meals"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      INSERT INTO "user_meal_state"
        ("user_id", "meal_id", "is_favorite", "rating", "last_cooked_at", "times_cooked")
      SELECT admin."id", m."id", m."is_favorite", m."rating", m."last_cooked_at", m."times_cooked"
      FROM "meals" m
      CROSS JOIN (${MoveMealStateToUser1786000000000.OLDEST_ADMIN}) admin
      WHERE m."is_favorite" OR m."rating" IS NOT NULL
         OR m."last_cooked_at" IS NOT NULL OR m."times_cooked" > 0
    `);

    await queryRunner.query(`ALTER TABLE "meals" DROP COLUMN "is_favorite"`);
    await queryRunner.query(`ALTER TABLE "meals" DROP COLUMN "rating"`);
    await queryRunner.query(`ALTER TABLE "meals" DROP COLUMN "last_cooked_at"`);
    await queryRunner.query(`ALTER TABLE "meals" DROP COLUMN "times_cooked"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "meals" ADD "is_favorite" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "meals" ADD "rating" integer`);
    await queryRunner.query(
      `ALTER TABLE "meals" ADD "last_cooked_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "meals" ADD "times_cooked" integer NOT NULL DEFAULT 0`,
    );

    await queryRunner.query(`
      UPDATE "meals" m SET
        "is_favorite" = s."is_favorite",
        "rating" = s."rating",
        "last_cooked_at" = s."last_cooked_at",
        "times_cooked" = s."times_cooked"
      FROM "user_meal_state" s
      WHERE s."meal_id" = m."id"
        AND s."user_id" = (${MoveMealStateToUser1786000000000.OLDEST_ADMIN})
    `);

    await queryRunner.query(`DROP TABLE "user_meal_state"`);
    await queryRunner.query(`ALTER TABLE "meals" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "meals_status_enum"`);
    await queryRunner.query(`DROP INDEX "IDX_meals_user"`);
    await queryRunner.query(
      `ALTER TABLE "meals" DROP CONSTRAINT "FK_meals_user"`,
    );
    await queryRunner.query(`ALTER TABLE "meals" DROP COLUMN "user_id"`);
  }
}
