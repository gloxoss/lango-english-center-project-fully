import { randomUUID } from 'node:crypto';
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

function check(condition: unknown, label: string) {
  if (!condition) throw new Error(`FAIL ${label}`);
  console.log(`PASS ${label}`);
}

async function main() {
  loadLocalEnv();
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
  const { postAccountingVoucher, reverseAccountingVoucher } = await import('../src/features/accounting/services/posting-service');
  try {
    const tenant = await pool.query<{ tenant_id: string; actor_id: string }>(`
      select t.id tenant_id,
             coalesce((select u.id from "user" u where u.tenant_id=t.id limit 1), 'accounting-verifier') actor_id
      from tenants t order by t.created_at limit 1
    `);
    const principal = tenant.rows[0];
    if (!principal) throw new Error('At least one tenant is required');
    await pool.query(`
      insert into fiscal_periods (tenant_id, name, start_date, end_date, status)
      select $1, 'ACCOUNTING-VERIFY-2098', '2098-01-01', '2098-12-31', 'open'
      where not exists (select 1 from fiscal_periods where tenant_id=$1 and name='ACCOUNTING-VERIFY-2098')
    `, [principal.tenant_id]);
    const debitAccount = await pool.query<{ id: string }>(`
      insert into chart_of_accounts (tenant_id, code, name, account_type, is_active)
      values ($1, 'VERIFY-DR', 'Compte de vérification débit', 'asset', true)
      on conflict (tenant_id, code) do update set is_active=true
      returning id
    `, [principal.tenant_id]);
    const creditAccount = await pool.query<{ id: string }>(`
      insert into chart_of_accounts (tenant_id, code, name, account_type, is_active)
      values ($1, 'VERIFY-CR', 'Compte de vérification crédit', 'liability', true)
      on conflict (tenant_id, code) do update set is_active=true
      returning id
    `, [principal.tenant_id]);
    const row = {
      ...principal,
      entry_date: '2098-01-01',
      debit_account_id: debitAccount.rows[0]!.id,
      credit_account_id: creditAccount.rows[0]!.id,
    };

    const journal = await pool.query<{ id: string }>(`
      insert into accounting_journals (tenant_id, code, name, journal_type)
      values ($1, 'GEN', 'Journal général', 'general')
      on conflict (tenant_id, code) do update set is_active=true
      returning id
    `, [row.tenant_id]);
    await pool.query(`
      insert into accounting_voucher_types (tenant_id, journal_id, code, name, source_module, is_system)
      values ($1, $2, 'VERIFY', 'Vérification comptable', 'accounting_verifier', true)
      on conflict (tenant_id, code) do update set journal_id=excluded.journal_id, is_active=true
    `, [row.tenant_id, journal.rows[0]!.id]);

    const token = randomUUID();
    const base = {
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      entryDate: row.entry_date,
      description: `Verification ${token}`,
      sourceModule: 'accounting_verifier',
      sourceDocumentId: token,
      sourceVersion: 1,
      idempotencyKey: `accounting-verifier:${token}:v1`,
      journalCode: 'GEN',
      voucherTypeCode: 'VERIFY',
      lines: [
        { accountId: row.debit_account_id, debitAmount: '125.40', creditAmount: '0' },
        { accountId: row.credit_account_id, debitAmount: '0', creditAmount: '125.40' },
      ],
    };

    const race = await Promise.all(Array.from({ length: 6 }, () => postAccountingVoucher(base)));
    check(new Set(race.map(result => result.entry.id)).size === 1, 'concurrent idempotent requests create one entry');
    check(race.filter(result => !result.idempotent).length === 1, 'exactly one concurrent request performs the posting');
    check(race.every(result => result.totalDebit === '125.40' && result.totalCredit === '125.40'), 'exact-cent totals remain balanced');

    const counts = await pool.query<{ requests: string; entries: string; lines: string }>(`
      select
        (select count(*) from accounting_posting_requests where tenant_id=$1 and source_document_id=$2)::text requests,
        (select count(*) from journal_entries where tenant_id=$1 and description=$3)::text entries,
        (select count(*) from journal_entry_lines where tenant_id=$1 and journal_entry_id=$4)::text lines
    `, [row.tenant_id, token, base.description, race[0]!.entry.id]);
    check(counts.rows[0]?.requests === '1' && counts.rows[0]?.entries === '1' && counts.rows[0]?.lines === '2', 'database contains one request, one entry and two lines');

    let conflictCode = '';
    try {
      await postAccountingVoucher({ ...base, description: `${base.description} changed` });
    } catch (error) {
      conflictCode = (error as { code?: string }).code ?? '';
    }
    check(conflictCode === 'POSTING_REQUEST_CONFLICT', 'idempotency key rejects changed payload');

    const reversal = await reverseAccountingVoucher({
      ...base,
      originalEntryId: race[0]!.entry.id,
      description: `Reversal ${token}`,
      sourceDocumentId: `${token}:reversal`,
      sourceVersion: 1,
      idempotencyKey: `accounting-verifier:${token}:reversal:v1`,
      eventReason: 'Automated verification',
    });
    check(reversal.totalDebit === '125.40' && reversal.totalCredit === '125.40', 'reversal swaps lines and remains balanced');

    const immutable = await pool.query(`
      update accounting_voucher_events set reason='tampered'
      where tenant_id=$1 and journal_entry_id=$2
    `, [row.tenant_id, race[0]!.entry.id]).then(() => false).catch(() => true);
    check(immutable, 'voucher event update is rejected by PostgreSQL');

    console.log('PASS office accounting posting acceptance 7/7');
  } finally {
    await pool.end();
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
