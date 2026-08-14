// Apply + idempotency-verify migration 0112_student_accounting_phase_b.sql
// (fee_categories enrichment: code/flags/revenue_account_id/effective dates/
//  is_archived + partial unique code index; fee_structures scope:
//  academic_term_id + branch_id) for plan #12 Phase B.
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

const file = path.join(process.cwd(), 'migrations', '0112_student_accounting_phase_b.sql');
const sql = fs.readFileSync(file, 'utf-8');
const statements = sql.split(/--> statement-breakpoint/).map(s => s.trim()).filter(Boolean);

async function apply(label) {
  for (const stmt of statements) await pool.query(stmt);
  console.log(`[${label}] applied ${statements.length} statement(s)`);
}

async function column(table, name) {
  const r = await pool.query(`select column_name from information_schema.columns
    where table_name = $1 and column_name = $2`, [table, name]);
  if (!r.rowCount) throw new Error(`${table}.${name} missing`);
}

async function check() {
  for (const c of ['code', 'taxable', 'refundable', 'discountable', 'fineable', 'revenue_account_id', 'effective_from', 'effective_to', 'is_archived']) {
    await column('fee_categories', c);
  }
  const codeIdx = await pool.query(`select 1 from pg_indexes where indexname = 'fee_categories_tenant_code_uidx'`);
  if (!codeIdx.rowCount) throw new Error('fee_categories_tenant_code_uidx missing');
  const fk = await pool.query(`select 1 from pg_constraint where conname = 'fee_categories_revenue_account_id_chart_of_accounts_id_fk'`);
  if (!fk.rowCount) throw new Error('fee_categories revenue_account_id FK missing');
  for (const c of ['academic_term_id', 'branch_id']) {
    await column('fee_structures', c);
  }
  console.log('[check] fee_categories columns + code index + revenue FK; fee_structures scope columns ok');
}

await apply('pass1');
await check();
await apply('pass2');
await check();
await pool.end();
console.log('0112 idempotent re-run OK');
