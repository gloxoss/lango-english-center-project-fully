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
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
  try {
    const tables = ['accounting_journals', 'accounting_voucher_types', 'accounting_numbering_series', 'accounting_posting_requests', 'accounting_journal_links', 'accounting_voucher_events'];
    const constraints = [
      'journal_entries_tenant_id_id_unique',
      'accounting_posting_requests_entry_fk',
      'accounting_journal_links_entry_fk',
      'accounting_journal_links_journal_fk',
      'accounting_journal_links_voucher_type_fk',
      'accounting_journal_links_request_fk',
      'accounting_journal_links_reversal_fk',
    ];
    const tableResult = await pool.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema='public' and table_name = any($1::text[])`,
      [tables],
    );
    const constraintResult = await pool.query<{ conname: string }>(
      `select conname from pg_constraint where conname = any($1::text[])`,
      [constraints],
    );
    const triggerResult = await pool.query<{ tgname: string }>(
      `select tgname from pg_trigger where not tgisinternal and tgname = any($1::text[])`,
      [['accounting_voucher_events_immutable_trigger', 'accounting_posting_requests_immutable_trigger']],
    );
    const foundTables = new Set(tableResult.rows.map(row => row.table_name));
    const foundConstraints = new Set(constraintResult.rows.map(row => row.conname));
    const foundTriggers = new Set(triggerResult.rows.map(row => row.tgname));
    const missing = [
      ...tables.filter(name => !foundTables.has(name)),
      ...constraints.filter(name => !foundConstraints.has(name)),
      ...['accounting_voucher_events_immutable_trigger', 'accounting_posting_requests_immutable_trigger'].filter(name => !foundTriggers.has(name)),
    ];
    if (missing.length) throw new Error(`Missing database objects: ${missing.join(', ')}`);
    console.log(`PASS accounting foundation: ${tables.length}/${tables.length} tables, ${constraints.length}/${constraints.length} tenant constraints, 2/2 immutability triggers`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('FAIL accounting foundation verification', error);
  process.exitCode = 1;
});
