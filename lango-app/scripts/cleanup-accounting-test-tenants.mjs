// Remove orphaned accounting-adapter test tenants (ACC Test / ACC Other) left by
// earlier failed runs. Uses the same disable → delete → enable trigger dance as
// the library accounting adapter test cleanup.
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
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const TRIGGERS = [
  ['accounting_voucher_events', 'accounting_voucher_events_immutable_trigger'],
  ['accounting_posting_requests', 'accounting_posting_requests_immutable_trigger'],
  ['journal_entries', 'prevent_journal_entry_delete'],
  ['journal_entries', 'journal_header_balance_trigger'],
  ['journal_entry_lines', 'prevent_journal_line_mutation'],
  ['journal_entry_lines', 'journal_lines_balance_trigger'],
];

async function setTriggers(mode) {
  for (const [table, trigger] of TRIGGERS) {
    await pool.query(`ALTER TABLE ${table} ${mode} TRIGGER ${trigger}`);
  }
}

const ten = await pool.query(`select id, name from tenants where name like 'ACC Test %' or name like 'ACC Other %'`);
console.log(`found ${ten.rows.length} orphan tenant(s)`);

await setTriggers('DISABLE');
for (const t of ten.rows) {
  await pool.query(`delete from accounting_voucher_events where tenant_id=$1`, [t.id]);
  await pool.query(`delete from accounting_journal_links where tenant_id=$1`, [t.id]);
  await pool.query(`delete from accounting_numbering_series where tenant_id=$1`, [t.id]);
  await pool.query(`delete from journal_entry_lines where tenant_id=$1`, [t.id]);
  await pool.query(`delete from accounting_posting_requests where tenant_id=$1`, [t.id]);
  await pool.query(`delete from journal_entries where tenant_id=$1`, [t.id]);
  await pool.query(`delete from accounting_adapter_exceptions where tenant_id=$1`, [t.id]);
  await pool.query(`delete from accounting_source_mappings where tenant_id=$1`, [t.id]);
  await pool.query(`delete from accounting_voucher_types where tenant_id=$1`, [t.id]);
  await pool.query(`delete from accounting_journals where tenant_id=$1`, [t.id]);
  await pool.query(`delete from chart_of_accounts where tenant_id=$1`, [t.id]);
  await pool.query(`delete from fiscal_periods where tenant_id=$1`, [t.id]);
  await pool.query(`delete from tenants where id=$1`, [t.id]);
  console.log(`removed ${t.name} (${t.id})`);
}
await setTriggers('ENABLE');

const remaining = await pool.query(`select count(*)::int c from tenants where name like 'ACC Test %' or name like 'ACC Other %'`);
console.log(`remaining orphan tenants: ${remaining.rows[0].c}`);
await pool.end();
