// Apply + idempotency-verify migration 0114_student_accounting_phase_c.sql
// (fee_allocation_runs: branch_id/due_date/approved_by_id/approved_at/
//  cancelled_by_id/cancelled_at + branches FK; fee_allocation_targets:
//  processed_at) for plan #12 Phase C.
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

const file = path.join(process.cwd(), 'migrations', '0114_student_accounting_phase_c.sql');
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
  for (const c of ['branch_id', 'due_date', 'approved_by_id', 'approved_at', 'cancelled_by_id', 'cancelled_at']) {
    await column('fee_allocation_runs', c);
  }
  const fk = await pool.query(`select 1 from pg_constraint where conname = 'fee_allocation_runs_branch_id_branches_id_fk'`);
  if (!fk.rowCount) throw new Error('fee_allocation_runs branch_id FK missing');
  await column('fee_allocation_targets', 'processed_at');
  console.log('[check] fee_allocation_runs columns + branch FK; fee_allocation_targets processed_at ok');
}

await apply('pass1');
await check();
await apply('pass2');
await check();
await pool.end();
console.log('0114 idempotent re-run OK');
