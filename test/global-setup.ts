import './env';
import { DataSource } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { dataSourceOptions } from '../src/config/data-source';

// `DataSourceOptions` est l'union de tous les drivers : le spread n'y survit pas.
const postgres = dataSourceOptions as PostgresConnectionOptions;

/**
 * Crée la base de test si besoin, puis applique les migrations.
 * Les migrations et non `synchronize` : les index partiels et fonctionnels
 * qu'on veut vérifier n'existent que là.
 */
export default async function globalSetup(): Promise<void> {
  const admin = new DataSource({
    ...postgres,
    database: 'postgres',
    migrations: [],
  });
  await admin.initialize();
  const exists = await admin.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [postgres.database],
  );
  if (exists.length === 0) {
    // Un identifiant ne peut pas être lié en paramètre ; la valeur vient du code.
    await admin.query(`CREATE DATABASE "${postgres.database as string}"`);
  }
  await admin.destroy();

  const target = new DataSource(postgres);
  await target.initialize();
  await target.runMigrations();
  await target.destroy();
}
