// Apply + idempotency-verify migration 0133_tenant_invitations.sql
// (tenant_invitations table) — Part C: Self-Serve Tenant Signup & Teammate Invitations.
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

const file = path.join(process.cwd(), 'migrations', '0133_tenant_invitations.sql');
const sql = fs.readFileSync(file, 'utf-8');
const statements = sql.split(/--> statement-breakpoint/).map(s => s.trim()).filter(Boolean);

async function apply(label) {
  for (const stmt of statements) await pool.query(stmt);
  console.log(`[${label}] applied ${statements.length} statement(s)`);
}

async function check() {
  const t = await pool.query(`select 1 from information_schema.tables where table_name = 'tenant_invitations'`);
  if (!t.rowCount) throw new Error('tenant_invitations table missing');
  const cols = await pool.query(
    `select column_name from information_schema.columns where table_name = 'tenant_invitations' order by ordinal_position`,
  );
  const names = cols.rows.map(r => r.column_name);
  for (const c of ['id', 'tenant_id', 'email', 'role', 'token', 'status', 'invited_by_id', 'expires_at', 'created_at', 'updated_at']) {
    if (!names.includes(c)) throw new Error(`tenant_invitations.${c} column missing`);
  }
  console.log('[check] tenant_invitations table + columns ok');
}

try {
  await apply('pass1');
  await check();
  await apply('pass2');
  await check();
  console.log('0133 idempotent re-run OK');
} catch (err) {
  console.error('Migration error:', err);
} finally {
  await pool.end();
}
