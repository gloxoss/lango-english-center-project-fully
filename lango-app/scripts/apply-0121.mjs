// Apply + idempotency-verify migration 0121_student_accounting_phase_e.sql
// (payments.status enum + column; payment_reversals.rejection_reason;
// cashier_sessions.reconciled_by_id/at) for plan #12 Phase E.
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

const file = path.join(process.cwd(), 'migrations', '0121_student_accounting_phase_e.sql');
const sql = fs.readFileSync(file, 'utf-8');
const statements = sql.split(/--> statement-breakpoint/).map(s => s.trim()).filter(Boolean);

async function apply(label) {
  for (const stmt of statements) await pool.query(stmt);
  console.log(`[${label}] applied ${statements.length} statement(s)`);
}

async function enumValue(label) {
  const r = await pool.query(`select 1 from pg_enum e join pg_type t on e.enumtypid = t.oid
    where t.typname = 'payment_status' and e.enumlabel = $1`, [label]);
  if (!r.rowCount) throw new Error(`payment_status.${label} missing`);
}

async function column(table, column) {
  const r = await pool.query(`select 1 from information_schema.columns
    where table_name = $1 and column_name = $2`, [table, column]);
  if (!r.rowCount) throw new Error(`${table}.${column} missing`);
}

async function check() {
  await enumValue('posted');
  await enumValue('reversed');
  await enumValue('refunded');
  await column('payments', 'status');
  await column('payment_reversals', 'rejection_reason');
  await column('cashier_sessions', 'reconciled_by_id');
  await column('cashier_sessions', 'reconciled_at');
  console.log('[check] payment_status enum + payments.status + rejection_reason + reconciled columns ok');
}

await apply('pass1');
await check();
await apply('pass2');
await check();
await pool.end();
console.log('0121 idempotent re-run OK');
