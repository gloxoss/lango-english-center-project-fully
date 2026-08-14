import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = rawLine.trim().match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1]!.trim()]) process.env[match[1]!.trim()] = match[2]!.trim();
  }
}

async function main() {
  loadLocalEnv();
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const sql = fs.readFileSync(path.resolve(process.cwd(), 'migrations/0085_office_accounting_foundation.sql'), 'utf8');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
  try {
    await pool.query(sql);
    console.log('PASS migration 0085 applied');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('FAIL migration 0085', error);
  process.exitCode = 1;
});
