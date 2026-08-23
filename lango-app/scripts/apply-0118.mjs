// Apply + idempotency-verify migration 0118_student_accounting_phase_d.sql
// (invoice_status gains 'draft'/'credited'; new receipts table) for plan #12 Phase D.
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

const file = path.join(process.cwd(), 'migrations', '0118_student_accounting_phase_d.sql');
const sql = fs.readFileSync(file, 'utf-8');
const statements = sql.split(/--> statement-breakpoint/).map(s => s.trim()).filter(Boolean);

async function apply(label) {
  for (const stmt of statements) await pool.query(stmt);
  console.log(`[${label}] applied ${statements.length} statement(s)`);
}

async function enumValue(label) {
  const r = await pool.query(`select 1 from pg_enum e join pg_type t on e.enumtypid = t.oid
    where t.typname = 'invoice_status' and e.enumlabel = $1`, [label]);
  if (!r.rowCount) throw new Error(`invoice_status.${label} missing`);
}

async function check() {
  await enumValue('draft');
  await enumValue('credited');
  const t = await pool.query(`select 1 from information_schema.tables where table_name = 'receipts'`);
  if (!t.rowCount) throw new Error('receipts table missing');
  const uq = await pool.query(`select 1 from pg_constraint where conname = 'receipts_tenant_receipt_number_uidx'`);
  if (!uq.rowCount) throw new Error('receipts tenant+receipt_number unique constraint missing');
  console.log('[check] invoice_status draft/credited + receipts table + unique constraint ok');
}

await apply('pass1');
await check();
await apply('pass2');
await check();
await pool.end();
console.log('0118 idempotent re-run OK');
