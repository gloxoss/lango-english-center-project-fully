// Apply + idempotency-verify migration 0120_applicant_guardian_fields.sql
// (applicants gains occupation/address/email_opt_in/sms_opt_in/preferred_language)
// for bug 2.5 - the admission wizard's guardian mini-form now carries those fields.
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

const file = path.join(process.cwd(), 'migrations', '0120_applicant_guardian_fields.sql');
const sql = fs.readFileSync(file, 'utf-8');
const statements = sql.split(/--> statement-breakpoint/).map(s => s.trim()).filter(Boolean);

async function apply(label) {
  for (const stmt of statements) await pool.query(stmt);
  console.log(`[${label}] applied ${statements.length} statement(s)`);
}

async function check() {
  const cols = ['occupation', 'address', 'email_opt_in', 'sms_opt_in', 'preferred_language'];
  const r = await pool.query(
    `select column_name from information_schema.columns where table_name = 'applicants' and column_name = any($1::text[])`,
    [cols],
  );
  const found = r.rows.map(x => x.column_name);
  for (const c of cols) {
    if (!found.includes(c)) throw new Error(`applicants.${c} missing`);
  }
  console.log('[check] applicants guardian columns ok');
}

await apply('pass1');
await check();
await apply('pass2');
await check();
await pool.end();
console.log('0120 idempotent re-run OK');
