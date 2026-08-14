import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
for (const line of fs.readFileSync(path.resolve('.env'), 'utf8').split(/\r?\n/)) { const match = line.trim().match(/^([^#=]+)=(.*)$/); if (match && !process.env[match[1]!.trim()]) process.env[match[1]!.trim()] = match[2]!.trim(); }
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
  try {
    await pool.query(fs.readFileSync(path.resolve('migrations/0090_office_accounting_reconciliation.sql'), 'utf8'));
    const result = await pool.query(`select
      to_regclass('public.accounting_reconciliation_matches') is not null table_ok,
      exists(select 1 from pg_constraint where conname='accounting_reconciliation_matches_line_fk') line_fk,
      exists(select 1 from pg_constraint where conname='accounting_reconciliation_matches_reconciliation_fk') reconciliation_fk,
      exists(select 1 from pg_trigger where tgname='accounting_reconciliation_matches_closed_trigger') immutable_trigger`);
    const row = result.rows[0]; if (!row.table_ok || !row.line_fk || !row.reconciliation_fk || !row.immutable_trigger) throw new Error('Reconciliation database objects missing');
    console.log('PASS migration 0090: match table, 2/2 tenant FKs, closed-match trigger');
  } finally { await pool.end(); }
}
main().catch(error => { console.error('FAIL migration 0090', error); process.exitCode = 1; });
