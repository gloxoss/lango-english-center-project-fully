// Apply + idempotency-verify migration 0132_academic_readiness_snapshots.sql
// (academic_readiness_snapshots table) — Part 4, item 6.
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

const file = path.join(process.cwd(), 'migrations', '0132_academic_readiness_snapshots.sql');
const sql = fs.readFileSync(file, 'utf-8');
const statements = sql.split(/--> statement-breakpoint/).map(s => s.trim()).filter(Boolean);

async function apply(label) {
  for (const stmt of statements) await pool.query(stmt);
  console.log(`[${label}] applied ${statements.length} statement(s)`);
}

async function check() {
  const t = await pool.query(`select 1 from information_schema.tables where table_name = 'academic_readiness_snapshots'`);
  if (!t.rowCount) throw new Error('academic_readiness_snapshots table missing');
  const cols = await pool.query(
    `select column_name from information_schema.columns where table_name = 'academic_readiness_snapshots' order by ordinal_position`,
  );
  const names = cols.rows.map(r => r.column_name);
  for (const c of ['id', 'tenant_id', 'session_year_id', 'overall_score', 'captured_at']) {
    if (!names.includes(c)) throw new Error(`academic_readiness_snapshots.${c} column missing`);
  }
  console.log('[check] academic_readiness_snapshots table + columns ok');
}

await apply('pass1');
await check();
await apply('pass2');
await check();
await pool.end();
console.log('0132 idempotent re-run OK');
