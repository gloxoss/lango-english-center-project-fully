// Apply + idempotency-verify migration 0104_library_accounting_mappings.sql
// (extends accounting_source_mappings.shape_check for the library adapter).
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

const file = path.join(process.cwd(), 'migrations', '0104_library_accounting_mappings.sql');
const sql = fs.readFileSync(file, 'utf-8');
const statements = sql.split(/--> statement-breakpoint/).map(s => s.trim()).filter(Boolean);

async function apply(label) {
  for (const stmt of statements) await pool.query(stmt);
  console.log(`[${label}] applied ${statements.length} statement(s)`);
}

async function check() {
  const rows = await pool.query(`select pg_get_constraintdef(oid) def from pg_constraint
    where conname='accounting_source_mappings_shape_check'`);
  const def = rows.rows[0]?.def ?? '';
  const ok = def.includes("'library_member'") && def.includes("'library_charge_reason'");
  console.log(`[check] shape_check -> ${ok ? 'ok' : 'MISSING library keys: ' + def}`);
  if (!ok) throw new Error('shape check missing library key types');
}

await apply('pass1');
await check();
await apply('pass2');
await check();
await pool.end();
console.log('0104 idempotent re-run OK');
