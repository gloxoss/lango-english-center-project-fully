// Apply + idempotency-verify migration 0124_student_accounting_phase_h.sql
// (payments.payment_method enum->varchar; gateway fields; payment_gateway_sessions)
// for plan #12 Phase H.
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

const file = path.join(process.cwd(), 'migrations', '0124_student_accounting_phase_h.sql');
const sql = fs.readFileSync(file, 'utf-8');
const statements = sql.split(/--> statement-breakpoint/).map(s => s.trim()).filter(Boolean);

async function apply(label) {
  for (const stmt of statements) await pool.query(stmt);
  console.log(`[${label}] applied ${statements.length} statement(s)`);
}

async function columnType(table, column) {
  const r = await pool.query(
    `select data_type from information_schema.columns where table_name = $1 and column_name = $2`,
    [table, column],
  );
  return r.rows[0]?.data_type ?? null;
}

async function check() {
  const pmType = await columnType('payments', 'payment_method');
  if (pmType !== 'character varying') throw new Error(`payments.payment_method is ${pmType}, expected character varying`);
  const t = await pool.query(`select 1 from information_schema.tables where table_name = 'payment_gateway_sessions'`);
  if (!t.rowCount) throw new Error('payment_gateway_sessions table missing');
  for (const col of ['provider', 'gateway_mode', 'credential_secret_key', 'webhook_secret_key']) {
    const c = await columnType('payment_method_configurations', col);
    if (!c) throw new Error(`payment_method_configurations.${col} column missing`);
  }
  console.log('[check] payments.payment_method varchar + gateway fields + payment_gateway_sessions ok');
}

await apply('pass1');
await check();
await apply('pass2');
await check();
await pool.end();
console.log('0124 idempotent re-run OK');
