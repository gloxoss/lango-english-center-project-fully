// Apply + idempotency-verify migration 0110_subscription_licensing.sql
// (school_licenses + license_payments tables for plan #4).
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

const file = path.join(process.cwd(), 'migrations', '0110_subscription_licensing.sql');
const sql = fs.readFileSync(file, 'utf-8');
const statements = sql.split(/--> statement-breakpoint/).map(s => s.trim()).filter(Boolean);

async function apply(label) {
  for (const stmt of statements) await pool.query(stmt);
  console.log(`[${label}] applied ${statements.length} statement(s)`);
}

async function check(tableName, expectCols) {
  const rows = await pool.query(`select column_name from information_schema.columns
    where table_name=$1 order by ordinal_position`, [tableName]);
  const cols = rows.rows.map(r => r.column_name).join(',');
  const ok = expectCols.every(c => cols.includes(c));
  console.log(`[check] ${tableName} columns -> ${ok ? 'ok' : 'MISSING: ' + cols}`);
  if (!ok) throw new Error(`${tableName} missing expected columns`);
}

await apply('pass1');
await check('school_licenses', ['tenant_id', 'license_key', 'status', 'expires_at', 'issued_by_id']);
await check('license_payments', ['tenant_id', 'plan_tier', 'amount', 'status', 'requested_months']);
await apply('pass2');
await check('school_licenses', ['tenant_id', 'license_key']);
await check('license_payments', ['tenant_id', 'plan_tier', 'amount', 'status']);
await pool.end();
console.log('0110 idempotent re-run OK');
