// Apply migration 0122_library_orphaned_copies_backfill.sql (§12.7): withdraw
// library copies whose bibliographic record was soft-deleted.
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = rawLine.trim().match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) process.env[match[1].trim()] = match[2].trim();
  }
}

loadLocalEnv();
const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos' });

const file = path.join(process.cwd(), 'migrations', '0122_library_orphaned_copies_backfill.sql');
const statements = fs.readFileSync(file, 'utf-8').split(/--> statement-breakpoint/).map(s => s.trim()).filter(Boolean);

async function apply(label) {
  for (const stmt of statements) await pool.query(stmt);
  console.log(`[${label}] applied ${statements.length} statement(s)`);
}

async function check() {
  const r = await pool.query(`select count(*)::int as n from library_copies c
    join library_editions e on e.id = c.edition_id
    join library_bibliographic_records r on r.id = e.record_id
    where r.deleted_at is not null and c.state <> 'withdrawn'`);
  const orphaned = Number(r.rows[0]?.n ?? 0);
  if (orphaned !== 0) throw new Error(`${orphaned} orphaned non-withdrawn copy(s) remain`);
  console.log('[check] 0 orphaned non-withdrawn copies remain');
}

await apply('pass1');
await check();
await apply('pass2');
await check();
await pool.end();
console.log('0122 idempotent re-run OK');
