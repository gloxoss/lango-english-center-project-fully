import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
for (const line of fs.readFileSync(path.resolve('.env'), 'utf8').split(/\r?\n/)) { const match = line.trim().match(/^([^#=]+)=(.*)$/); if (match && !process.env[match[1]!.trim()]) process.env[match[1]!.trim()] = match[2]!.trim(); }
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
  try {
    await pool.query(fs.readFileSync(path.resolve('migrations/0099_payroll_component_percent_bp.sql'), 'utf8'));

    const checkSql = `select exists(select 1 from information_schema.columns where table_name='salary_component_versions' and column_name='percent_bp') as ok`;
    const r = await pool.query(checkSql);
    const ok = r.rows.length === 1 && Boolean(r.rows[0]?.ok);
    if (!ok) throw new Error('missing column salary_component_versions.percent_bp');
    console.log('PASS migration 0099: salary_component_versions.percent_bp present');
  } finally { await pool.end(); }
}
main().catch(error => { console.error('FAIL migration 0099', error); process.exitCode = 1; });
