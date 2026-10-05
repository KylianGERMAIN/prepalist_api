import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDismissedToShoppingListItems1787500000000 implements MigrationInterface {
  name = 'AddDismissedToShoppingListItems1787500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "shopping_list_items" ADD "dismissed" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Sans la colonne, une tombstone redeviendrait un article visible.
    await queryRunner.query(
      `DELETE FROM "shopping_list_items" WHERE "dismissed"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shopping_list_items" DROP COLUMN "dismissed"`,
    );
  }
}
