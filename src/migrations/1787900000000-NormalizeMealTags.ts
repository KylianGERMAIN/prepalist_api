import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Même normalisation que `normalizeTags` (meals/tag.ts) : NFC, espaces réduits,
 * minuscules, doublons retirés en gardant l'ordre de première apparition.
 * Idempotente : rejouée, elle ne change plus rien.
 */
export class NormalizeMealTags1787900000000 implements MigrationInterface {
  name = 'NormalizeMealTags1787900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // `\s` Postgres ignore les espaces insécables (U+00A0, U+202F) que `\s` JS
    // retire : ils sont ajoutés à la classe pour que les deux normalisations
    // coïncident.
    await queryRunner.query(`
      UPDATE "meals" m SET "tags" = COALESCE((
        SELECT array_agg(tag ORDER BY first_seen) FILTER (WHERE tag <> '')
        FROM (
          SELECT lower(btrim(regexp_replace(
                   normalize(t, NFC),
                   '[[:space:]' || chr(160) || chr(8239) || ']+', ' ', 'g'
                 ))) AS tag,
                 min(ord) AS first_seen
          FROM unnest(m."tags") WITH ORDINALITY AS u(t, ord)
          GROUP BY 1
        ) normalized
      ), '{}')
    `);
  }

  // La casse et les doublons d'origine sont perdus : rien à restaurer.
  public async down(): Promise<void> {}
}
