import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

for (const line of fs.readFileSync(path.resolve('.env'), 'utf8').split(/\r?\n/)) {
  const match = line.trim().match(/^([^#=]+)=(.*)$/);
  if (match && !process.env[match[1]!.trim()]) process.env[match[1]!.trim()] = match[2]!.trim();
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
  try {
    await pool.query(fs.readFileSync(path.resolve('migrations/0089_office_accounting_workflow.sql'), 'utf8'));
    const result = await pool.query<{ table_name: string }>(`
      select table_name from information_schema.tables
      where table_schema='public' and table_name=any($1::text[])
    `, [['accounting_documents', 'accounting_document_lines', 'accounting_document_events']]);
    if (result.rowCount !== 3) throw new Error(`Expected 3 workflow tables, found ${result.rowCount}`);
    const constraints = await pool.query<{ conname: string }>(`
      select conname from pg_constraint where conname=any($1::text[])
    `, [['chart_of_accounts_tenant_id_unique', 'accounting_document_lines_account_fk', 'accounting_documents_entry_fk']]);
    if (constraints.rowCount !== 3) throw new Error(`Expected 3 tenant constraints, found ${constraints.rowCount}`);
    const triggers = await pool.query<{ tgname: string }>(`
      select tgname from pg_trigger where not tgisinternal and tgname=any($1::text[])
    `, [['accounting_document_events_immutable_trigger', 'accounting_documents_posted_immutable_trigger']]);
    if (triggers.rowCount !== 2) throw new Error(`Expected 2 immutable triggers, found ${triggers.rowCount}`);
    console.log('PASS migration 0089: 3/3 workflow tables, 3/3 tenant constraints, 2/2 immutability triggers');
  } finally { await pool.end(); }
}

main().catch((error) => { console.error('FAIL migration 0089', error); process.exitCode = 1; });
