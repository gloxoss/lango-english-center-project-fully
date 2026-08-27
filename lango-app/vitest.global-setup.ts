import { Client } from 'pg';
import { loadEnv } from 'vite';

// Global test precondition: a reachable Postgres database is mandatory.
//
// Without this, a missing DB silently skips ~75% of the suite (the
// `describe.skipIf(!hasDb)` / `describe.skipIf(!dbReachable)` guards in
// DB-backed suites), so `npm run test` "passes" while testing almost nothing.
// This setup probes the DB exactly once and fails the whole run immediately if
// it is unreachable.
//
// Escape hatch: `ALLOW_DB_SKIP=1` opts back into the per-suite skip behaviour
// for local convenience. CI must NOT set it — a green run with the DB down is
// the failure mode this precondition exists to prevent.
export default async function globalSetup(): Promise<void> {
  if (process.env.ALLOW_DB_SKIP === '1') {
    console.warn(
      '⚠️  ALLOW_DB_SKIP=1 — skipping the DB availability precondition. DB-backed suites will skip. Do not set this in CI.',
    );
    return;
  }

  const fromEnvFile = loadEnv('', process.cwd(), '');
  const databaseUrl = process.env.DATABASE_URL ?? fromEnvFile.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set. The test suite requires a reachable Postgres database.\n'
      + '  - Set DATABASE_URL (or add it to .env) to run the full suite.\n'
      + '  - Set ALLOW_DB_SKIP=1 only for local convenience to skip DB-backed suites (never in CI).',
    );
  }

  const client = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    await client.query('select 1');
    console.log('✅ Database reachable — DB-backed suites will run.');
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Database unreachable (${reason}).\n`
      + 'The test suite requires a reachable Postgres database; a missing DB would silently skip most of the suite.\n'
      + '  - Start the database and re-run, or set ALLOW_DB_SKIP=1 for local convenience only (never in CI).',
    );
  } finally {
    await client.end().catch(() => {});
  }
}
