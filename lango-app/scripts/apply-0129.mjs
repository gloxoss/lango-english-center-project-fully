// Apply + idempotency-verify migration 0129_student_photos_gallery.sql
// (student_photos gallery table) — Part 2, item 2.
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

const file = path.join(process.cwd(), 'migrations', '0129_student_photos_gallery.sql');
const sql = fs.readFileSync(file, 'utf-8');
const statements = sql.split(/--> statement-breakpoint/).map(s => s.trim()).filter(Boolean);

async function apply(label) {
  for (const stmt of statements) await pool.query(stmt);
  console.log(`[${label}] applied ${statements.length} statement(s)`);
}

async function check() {
  const t = await pool.query(`select 1 from information_schema.tables where table_name = 'student_photos'`);
  if (!t.rowCount) throw new Error('student_photos table missing');
  const cols = await pool.query(
    `select column_name from information_schema.columns where table_name = 'student_photos' order by ordinal_position`,
  );
  const names = cols.rows.map(r => r.column_name);
  for (const c of ['id', 'tenant_id', 'student_id', 'url', 'uploaded_at', 'uploaded_by']) {
    if (!names.includes(c)) throw new Error(`student_photos.${c} column missing`);
  }
  console.log('[check] student_photos table + columns ok');
}

await apply('pass1');
await check();
await apply('pass2');
await check();
await pool.end();
console.log('0129 idempotent re-run OK');
