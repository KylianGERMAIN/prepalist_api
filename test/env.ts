// Importé avant tout code applicatif : `data-source.ts` lit process.env à
// l'import, et dotenv ne surcharge pas une variable déjà posée.
// Base dédiée : les TRUNCATE des tests videraient sinon la base de dev.
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'prepalist_test';
// Sans ça, les 100 req/60s du ThrottlerGuard rendent des 429 selon l'ordre des tests.
process.env.THROTTLE_LIMIT = '100000';
process.env.JWT_ACCESS_SECRET ??= 'e2e-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'e2e-refresh-secret';
