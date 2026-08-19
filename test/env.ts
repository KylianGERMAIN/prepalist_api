// Importé avant tout code applicatif : `data-source.ts` lit process.env à
// l'import, et dotenv ne surcharge pas une variable déjà posée.
// Hôte et base épinglés : un `.env` pointant un Postgres managé ferait créer
// puis TRUNCATE la base de test sur ce cluster.
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'prepalist_test';
process.env.DB_SSL = 'false';
process.env.JWT_ACCESS_SECRET ??= 'e2e-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'e2e-refresh-secret';
