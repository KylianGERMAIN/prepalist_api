import { config as loadEnv } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

// Chargé pour la CLI TypeORM (migrations) qui tourne hors contexte Nest.
loadEnv();

// Partagées entre l'app (`app.module`) et la CLI de migrations.
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'prepalist',
  password: process.env.DB_PASSWORD ?? 'prepalist',
  database: process.env.DB_NAME ?? 'prepalist',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'local',
  // Les Postgres managés (Neon, RDS) imposent TLS. `rejectUnauthorized: false`
  // chiffre sans vérifier la chaîne : fournir un CA pour une vérification stricte.
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
