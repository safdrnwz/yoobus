import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';

config();

/**
 * The DataSource every command-line tool shares — seed, schema check, migrations.
 *
 * It used to be re-declared inside seed.ts with `synchronize: false`, which meant running the
 * seed against a fresh database created NO TABLES AT ALL: it opened a connection, tried to
 * insert into a `users` table that did not exist, and died. Tables only ever appeared because
 * the app happened to run `synchronize` on boot — so the seed worked if, and only if, you had
 * already started the server once. On a clean machine, it simply did not work.
 *
 * One DataSource, one truth. `entities` uses a glob so a new entity is picked up without
 * anybody remembering to register it here.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'yoobus_db',

  // Glob, not a hand-kept list. A list is a thing you forget to update, and a forgotten entity
  // is a table that silently never gets created.
  /**
   * BOTH globs. Not all entities are named `*.entity.ts` — several files hold more than one
   * entity and are named `*.entities.ts` (support, notification-settings, and others).
   *
   * With only the first glob, the seed built 66 tables where the application builds 97. It
   * reported success, and 31 tables silently did not exist. A schema that is 2/3 correct is
   * more dangerous than one that is obviously broken, because nothing tells you.
   *
   * `validateSchema()` in the seed is the belt to this braces.
   */
  entities: ['src/**/*.entity.ts', 'src/**/entities/*.ts'],
  migrations: ['src/database/migrations/*.ts'],

  // NEVER on. Schema changes go through `db:schema` (dev) or a migration (production), where
  // they can be looked at first. `synchronize` on a live database will happily drop a column
  // because an entity no longer mentions it.
  synchronize: false,

  logging: process.env.DB_LOGGING === 'true' ? 'all' : ['error'],
});
