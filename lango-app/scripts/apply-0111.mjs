// Apply + idempotency-verify migration 0111_student_accounting_phase_a.sql
// (naming_series composite PK, INV backfill, unique invoice numbers,
//  payments.idempotency_key) for plan #12 Phase A.
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

const file = path.join(process.cwd(), 'migrations', '0111_student_accounting_phase_a.sql');
const sql = fs.readFileSync(file, 'utf-8');
const statements = sql.split(/--> statement-breakpoint/).map(s => s.trim()).filter(Boolean);

async function apply(label) {
  for (const stmt of statements) await pool.query(stmt);
  console.log(`[${label}] applied ${statements.length} statement(s)`);
}

async function check() {
  const pk = await pool.query(`select a.attname from pg_index i
    join pg_class c on c.oid = i.indrelid
    join pg_constraint con on con.conindid = i.indexrelid
    join pg_attribute a on a.attrelid = c.oid and a.attnum = any(i.indkey)
    where con.conname = 'naming_series_pkey' order by a.attnum`);
  const pkCols = pk.rows.map(r => r.attname).join(',');
  const pkOk = pkCols === 'tenant_id,prefix' || pkCols === 'prefix,tenant_id';
  console.log(`[check] naming_series pkey -> ${pkOk ? 'ok' : 'WRONG: ' + pkCols}`);
  if (!pkOk) throw new Error(`naming_series pkey is ${pkCols}`);

  const invIdx = await pool.query(`select 1 from pg_indexes where indexname = 'invoices_tenant_number_uidx'`);
  if (!invIdx.rowCount) throw new Error('invoices_tenant_number_uidx missing');

  const col = await pool.query(`select column_name from information_schema.columns
    where table_name = 'payments' and column_name = 'idempotency_key'`);
  if (!col.rowCount) throw new Error('payments.idempotency_key missing');

  const payIdx = await pool.query(`select 1 from pg_indexes where indexname = 'payments_tenant_idempotency_uidx'`);
  if (!payIdx.rowCount) throw new Error('payments_tenant_idempotency_uidx missing');
  console.log('[check] unique indexes + payments.idempotency_key ok');
}

await apply('pass1');
await check();
await apply('pass2');
await check();
await pool.end();
console.log('0111 idempotent re-run OK');
