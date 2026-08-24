// Apply + idempotency-verify migration 0125_report_card_document_type.sql
// (adds 'report_card' to the document_template_type enum — §16.1).
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

const file = path.join(process.cwd(), 'migrations', '0125_report_card_document_type.sql');
const sql = fs.readFileSync(file, 'utf-8');
const statements = sql.split(/--> statement-breakpoint/).map(s => s.trim()).filter(Boolean);

async function apply(label) {
  for (const stmt of statements) await pool.query(stmt);
  console.log(`[${label}] applied ${statements.length} statement(s)`);
}

async function check() {
  const r = await pool.query(
    `select enum_range(null::document_template_type)::text[] as vals`,
  );
  const vals = r.rows[0]?.vals ?? [];
  if (!vals.includes('report_card')) throw new Error(`document_template_type missing 'report_card' (has ${vals.join(',')})`);
  console.log(`[check] document_template_type = ${vals.join(', ')}`);
}

await apply('pass1');
await check();
await apply('pass2');
await check();
await pool.end();
console.log('0125 idempotent re-run OK');
