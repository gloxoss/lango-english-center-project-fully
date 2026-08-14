import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

for (const line of fs.readFileSync(path.resolve('.env'), 'utf8').split(/\r?\n/)) {
  const match = line.trim().match(/^([^#=]+)=(.*)$/);
  if (match && !process.env[match[1]!.trim()]) process.env[match[1]!.trim()] = match[2]!.trim();
}
function check(value: unknown, label: string) { if (!value) throw new Error(`FAIL ${label}`); console.log(`PASS ${label}`); }

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
  const service = await import('../src/features/accounting/services/document-service');
  try {
    const fixture = await pool.query<{ tenant_id: string; debit_id: string; credit_id: string; journal_id: string }>(`
      select t.id tenant_id,
        (select id from chart_of_accounts where tenant_id=t.id and code='VERIFY-DR') debit_id,
        (select id from chart_of_accounts where tenant_id=t.id and code='VERIFY-CR') credit_id,
        (select id from accounting_journals where tenant_id=t.id and code='GEN') journal_id
      from tenants t where exists (select 1 from chart_of_accounts where tenant_id=t.id and code='VERIFY-DR') limit 1
    `);
    const row = fixture.rows[0]; if (!row?.debit_id || !row.credit_id || !row.journal_id) throw new Error('Run posting acceptance fixtures first');
    await pool.query(`insert into accounting_voucher_types (tenant_id,journal_id,code,name,source_module,requires_approval,is_system)
      values($1,$2,'EXP','Dépense approuvée','accounting_expense',true,true)
      on conflict(tenant_id,code) do update set journal_id=excluded.journal_id,source_module=excluded.source_module,is_active=true`, [row.tenant_id, row.journal_id]);
    await pool.query(`insert into accounting_voucher_types (tenant_id,journal_id,code,name,source_module,requires_approval,is_system)
      values($1,$2,'REV','Contrepassation','accounting_reversal',true,true)
      on conflict(tenant_id,code) do update set journal_id=excluded.journal_id,source_module=excluded.source_module,is_active=true`, [row.tenant_id, row.journal_id]);
    const token = randomUUID();
    const document = await service.createAccountingDocument({
      tenantId: row.tenant_id, actorId: 'maker-verifier', documentType: 'expense', documentDate: '2098-01-02',
      reference: `INV-${token}`, counterparty: 'Verification Supplier', description: `Workflow ${token}`,
      lines: [{ accountId: row.debit_id, debitAmount: '44.10', creditAmount: '0' }, { accountId: row.credit_id, debitAmount: '0', creditAmount: '44.10' }],
    });
    check(document.status === 'draft', 'expense starts as draft');
    const submitted = await service.submitAccountingDocument(row.tenant_id, document.id, 'maker-verifier');
    check(submitted.status === 'pending_approval', 'draft submits for approval');
    const selfApprovalBlocked = await service.approveAccountingDocument(row.tenant_id, document.id, 'maker-verifier').then(() => false).catch((error: { code?: string }) => error.code === 'MAKER_CHECKER_REQUIRED');
    check(selfApprovalBlocked, 'maker cannot approve own expense');
    const approved = await service.approveAccountingDocument(row.tenant_id, document.id, 'checker-verifier');
    check(approved.status === 'approved' && approved.approvedById === 'checker-verifier', 'independent checker approves');
    const posted = await service.postApprovedAccountingDocument({ tenantId: row.tenant_id, documentId: document.id, actorId: 'poster-verifier', idempotencyKey: `workflow:${token}:post`, journalCode: 'GEN', voucherTypeCode: 'EXP' });
    check('journalEntry' in posted, 'approved expense posts to the central ledger');
    const replay = await service.postApprovedAccountingDocument({ tenantId: row.tenant_id, documentId: document.id, actorId: 'poster-verifier', idempotencyKey: `workflow:${token}:post`, journalCode: 'GEN', voucherTypeCode: 'EXP' });
    check(replay.idempotent === true, 'posted document retry is idempotent');
    const mutationBlocked = await pool.query(`update accounting_documents set description='tampered' where id=$1`, [document.id]).then(() => false).catch(() => true);
    check(mutationBlocked, 'posted source document is immutable');
    const duplicateBlocked = await service.createAccountingDocument({
      tenantId: row.tenant_id, actorId: 'maker-verifier', documentType: 'expense', documentDate: '2098-01-03',
      reference: `INV-${token}`, counterparty: 'Verification Supplier', description: 'Duplicate',
      lines: [{ accountId: row.debit_id, debitAmount: '44.10', creditAmount: '0' }, { accountId: row.credit_id, debitAmount: '0', creditAmount: '44.10' }],
    }).then(() => false).catch(() => true);
    check(duplicateBlocked, 'duplicate supplier reference is blocked');
    const verificationDocuments = await pool.query<{ id: string }>(`select id from accounting_documents where tenant_id=$1 and document_type='expense' and counterparty='Verification Supplier' and status='posted'`, [row.tenant_id]);
    for (const verificationDocument of verificationDocuments.rows) {
      await service.reversePostedAccountingDocument({ tenantId: row.tenant_id, documentId: verificationDocument.id, actorId: 'cleanup-verifier', entryDate: '2098-01-04', reason: 'Automated verification cleanup', idempotencyKey: `workflow:${verificationDocument.id}:cleanup`, journalCode: 'GEN', voucherTypeCode: 'REV' });
    }
    await pool.query(`with voided as (
      update accounting_documents set status='voided',updated_at=now()
      where tenant_id=$1 and counterparty='Verification Supplier' and status in ('draft','rejected') returning id
    ) insert into accounting_document_events(tenant_id,document_id,event_type,actor_id,reason)
      select $1,id,'voided','cleanup-verifier','Automated verification cleanup' from voided`, [row.tenant_id]);
    const remaining = await pool.query<{ count: string }>(`select count(*)::text count from accounting_documents where tenant_id=$1 and counterparty='Verification Supplier' and status='posted'`, [row.tenant_id]);
    check(remaining.rows[0]?.count === '0', 'verification expenses are reversed after the suite');
    console.log('PASS office accounting workflow acceptance 9/9');
  } finally { await pool.end(); }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
