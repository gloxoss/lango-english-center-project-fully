// Apply + idempotency-verify migration 0108_student_accounting.sql
// (12 new Student Accounting tables).
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

const file = path.join(process.cwd(), 'migrations', '0108_student_accounting.sql');
const sql = fs.readFileSync(file, 'utf-8');

const TABLES = [
  'fine_policies', 'fine_assessments', 'invoice_events', 'payment_reversals',
  'student_credits', 'cashier_closings', 'finance_reminder_rules', 'finance_reminder_runs',
  'payment_method_configurations', 'fee_structure_versions', 'fee_allocation_runs', 'fee_allocation_targets',
];

async function apply(label) {
  await pool.query(sql);
  console.log(`[${label}] applied OK`);
}

async function check() {
  const rows = await pool.query(`select table_name from information_schema.tables
    where table_schema='public' and table_name = any($1)`, [TABLES]);
  const have = new Set(rows.rows.map(r => r.table_name));
  const missing = TABLES.filter(t => !have.has(t));
  console.log(`[check] tables ${have.size}/${TABLES.length}${missing.length ? ' MISSING: ' + missing.join(',') : ''}`);
  if (missing.length) throw new Error(`missing tables: ${missing.join(', ')}`);
}

await apply('pass1');
await check();
await apply('pass2');
await check();
await pool.end();
console.log('0108 idempotent re-run OK');
