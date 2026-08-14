// Apply + idempotency-verify migration 0109_two_factor_otp.sql
// (2FA email-OTP delivery log for plan #3).
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

const file = path.join(process.cwd(), 'migrations', '0109_two_factor_otp.sql');
const sql = fs.readFileSync(file, 'utf-8');
const statements = sql.split(/--> statement-breakpoint/).map(s => s.trim()).filter(Boolean);

async function apply(label) {
  for (const stmt of statements) await pool.query(stmt);
  console.log(`[${label}] applied ${statements.length} statement(s)`);
}

async function check() {
  const rows = await pool.query(`select column_name, data_type from information_schema.columns
    where table_name='two_factor_otps' order by ordinal_position`);
  const cols = rows.rows.map(r => r.column_name).join(',');
  const ok = cols.includes('user_id') && cols.includes('otp') && cols.includes('expires_at');
  console.log(`[check] two_factor_otps columns -> ${ok ? 'ok' : 'MISSING: ' + cols}`);
  if (!ok) throw new Error('two_factor_otps missing expected columns');
}

await apply('pass1');
await check();
await apply('pass2');
await check();
await pool.end();
console.log('0109 idempotent re-run OK');
