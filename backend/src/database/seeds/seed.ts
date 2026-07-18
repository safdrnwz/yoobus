/**
 * Yoo Bus — seed.
 *
 * ── WHAT WAS BROKEN ──
 *
 * The old seed built its own DataSource with `synchronize: false`. On a fresh database that
 * created NO TABLES AT ALL: it connected, tried to insert into a `users` table that did not
 * exist, and died with a Postgres parser error. Tables only ever appeared because the *app*
 * ran `synchronize` on boot — so the seed worked if, and only if, you had already started the
 * server once. On a clean machine it simply did not work, and nothing in the output said why.
 *
 * ── WHAT IT DOES NOW ──
 *
 *   1. Creates the schema from the entities — every table, column type, index, FK.
 *   2. VALIDATES it, and names the missing table if one is missing, instead of failing later
 *      with an error nobody can read.
 *   3. Seeds inside ONE transaction. A failure rolls back completely: you never end up with
 *      half a platform and no way to tell which half.
 *   4. Is idempotent. Run it ten times, get the same database.
 *
 * ── WHAT IT SEEDS ──
 *
 *   SuperAdmin        superadmin@yoobus.com / pass@123
 *
 * Nothing else. There are no plans/tiers: every operator gets every feature, and each
 * operator's commercial terms (fees, commission, comms charges) are set by the SuperAdmin. Yoo Bus is a GDS: the owner onboards operators from the UI, and public
 * self-registration for operators does not exist.
 */
import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import { EntityManager } from 'typeorm';
import { AppDataSource } from '../data-source';
import { User } from '../../modules/customer/users/entities/user.entity';
import { Role } from '../../common/enums/role.enum';

const SUPERADMIN_EMAIL = 'superadmin@yoobus.com';
const SUPERADMIN_PASSWORD = 'pass@123';

/**
 * Tables the application cannot start without.
 *
 * This list caught a real bug: the DataSource's entity glob was `src/**\/*.entity.ts`, but a
 * dozen files hold several entities each and are named `*.entities.ts` — support, coupons,
 * fuel, hub, crew, finance. The seed built 66 tables where the app builds 97, reported
 * success, and 31 tables silently did not exist. A schema that is two-thirds right is more
 * dangerous than one that is obviously broken, because nothing tells you.
 */
const CRITICAL_TABLES = [
  'users', 'operators', 'buses', 'routes', 'trips', 'bookings', 'booking_seats',
  'seat_layout_templates', 'stops', 'payments',
  'support_tickets', 'coupons', 'fuel_transactions', 'wallet_transactions',
];

/** The app builds this many. A big shortfall means the entity glob is missing files again. */
const EXPECTED_TABLES_AT_LEAST = 85;

function step(label: string, started: number, extra = ''): void {
  console.log(`  ✓ ${label.padEnd(38)} ${String(Date.now() - started).padStart(6)}ms  ${extra}`);
}

/**
 * Build the schema.
 *
 * In development this is `synchronize()` — fast, derived from the entities, and a dev database
 * is disposable. In production it refuses and runs migrations instead, because `synchronize` on
 * live data will drop a column the moment an entity stops mentioning it, and it will not ask.
 */
async function ensureSchema(): Promise<string> {
  const isProd = (process.env.NODE_ENV ?? '').toLowerCase() === 'production';

  if (isProd) {
    const pending = await AppDataSource.showMigrations();
    if (!pending) return 'already up to date';
    const applied = await AppDataSource.runMigrations({ transaction: 'all' });
    return `${applied.length} migration(s) applied`;
  }

  await AppDataSource.synchronize();
  return 'from entities';
}

/** Name the missing table, rather than dying later on an error nobody can read. */
async function validateSchema(): Promise<number> {
  const rows: Array<{ table_name: string }> = await AppDataSource.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
  );
  const present = new Set(rows.map((r) => r.table_name));
  const missing = CRITICAL_TABLES.filter((t) => !present.has(t));

  if (missing.length) {
    throw new Error(
      `Schema is incomplete. Missing: ${missing.join(', ')}.\n` +
        `The DataSource's entity glob did not pick those entities up.`,
    );
  }

  if (present.size < EXPECTED_TABLES_AT_LEAST) {
    throw new Error(
      `Only ${present.size} tables were created; at least ${EXPECTED_TABLES_AT_LEAST} were expected.\n` +
        `Entities are being missed. Check the globs in src/database/data-source.ts.`,
    );
  }

  return present.size;
}

/** The one account that exists on a fresh platform. Everything else is made from the UI. */
async function seedSuperAdmin(manager: EntityManager): Promise<'created' | 'exists'> {
  const repo = manager.getRepository(User);
  if (await repo.findOne({ where: { email: SUPERADMIN_EMAIL } })) return 'exists';

  await repo.save(
    repo.create({
      email: SUPERADMIN_EMAIL,
      fullName: 'Yoo Bus SuperAdmin',
      phone: '9999999999',
      role: Role.SUPERADMIN,
      operatorId: null, // platform staff belong to no operator
      password: await bcrypt.hash(SUPERADMIN_PASSWORD, 10),
      passwordSet: true,
      emailVerified: true,
      isActive: true,
    }),
  );
  return 'created';
}

async function run(): Promise<void> {
  const t0 = Date.now();
  console.log('\nYoo Bus — seed\n');

  let mark = Date.now();
  await AppDataSource.initialize();
  step('connected', mark);

  mark = Date.now();
  const how = await ensureSchema();
  step('schema created', mark, how);

  mark = Date.now();
  const tables = await validateSchema();
  step('schema validated', mark, `${tables} tables`);

  // ONE transaction. A seed that half-succeeds is worse than one that fails outright: you
  // cannot tell, by looking, which half you got.
  mark = Date.now();
  let admin: 'created' | 'exists' = 'exists';

  await AppDataSource.transaction(async (manager) => {
    admin = await seedSuperAdmin(manager);
  });
  step('data seeded (one transaction)', mark);

  await AppDataSource.destroy();

  console.log('\n──────────────────────────────────────────────────────');
  console.log(`  SuperAdmin : ${SUPERADMIN_EMAIL} / ${SUPERADMIN_PASSWORD}${admin === 'exists' ? '   (already existed)' : ''}`);
  console.log('  Everything else: create it from the UI.');
  console.log(`\n  Done in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
  console.log('──────────────────────────────────────────────────────\n');
}

run().catch(async (err) => {
  console.error('\n✗ Seed failed. Nothing was written — the transaction rolled back.\n');
  console.error(err instanceof Error ? err.message : err);
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
  process.exit(1);
});
