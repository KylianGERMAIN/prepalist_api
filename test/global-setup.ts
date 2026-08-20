import './env';
import { DataSource } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { dataSourceOptions } from '../src/config/data-source';

// `DataSourceOptions` est l'union de tous les drivers : le spread n'y survit pas.
const postgres = dataSourceOptions as PostgresConnectionOptions;

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', 'postgres'];

/** Migrations et non `synchronize` : les index partiels et fonctionnels qu'on vérifie n'existent que là. */
export default async function globalSetup(): Promise<void> {
  const { host, database } = postgres;
  // Deuxième verrou après `env.ts` : DROP DATABASE sur un cluster distant est
  // irréversible, et l'hôte peut venir d'un override d'environnement.
  if (!host || !LOCAL_HOSTS.includes(host)) {
    throw new Error(
      `Tests e2e refusés : hôte de base « ${host} » non local (attendu ${LOCAL_HOSTS.join(', ')})`,
    );
  }
  if (database !== 'prepalist_test') {
    throw new Error(`Tests e2e refusés : base « ${database} » inattendue`);
  }

  const admin = new DataSource({
    ...postgres,
    database: 'postgres',
    migrations: [],
  });
  await admin.initialize();
  // Recréée à chaque run : une base réutilisée garde le schéma d'une migration
  // éditée en place, et la CI part d'une base vide — les deux divergeraient.
  await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${database}"`);
  await admin.destroy();

  const target = new DataSource(postgres);
  await target.initialize();
  await target.runMigrations();
  await target.destroy();
}
