import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Même normalisation que `normalizeTags` (meals/tag.ts) : NFC, espaces réduits,
 * minuscules, doublons retirés en gardant l'ordre de première apparition.
 * Idempotente : rejouée, elle ne change plus rien.
 */
export class NormalizeMealTags1787900000000 implements MigrationInterface {
  name = 'NormalizeMealTags1787900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "meals" m SET "tags" = COALESCE((
        SELECT array_agg(tag ORDER BY first_seen)
        FROM (
          SELECT lower(btrim(regexp_replace(normalize(t, NFC), '\\s+', ' ', 'g'))) AS tag,
                 min(ord) AS first_seen
          FROM unnest(m."tags") WITH ORDINALITY AS u(t, ord)
          WHERE btrim(t) <> ''
          GROUP BY 1
        ) normalized
      ), '{}')
    `);
  }

  // La casse et les doublons d'origine sont perdus : rien à restaurer.
  public async down(): Promise<void> {}
}
