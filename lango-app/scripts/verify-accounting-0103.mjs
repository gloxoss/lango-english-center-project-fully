// Verify + (re)apply migration 0103_accounting_student_adapter.sql against the
// live DB, then exercise the Student Accounting posting adapter end to end:
//   * account mapping resolution (exact key then module default; single default
//     per tenant+module+type);
//   * invoice posting: Dr receivable = netAmount, Cr revenue per category with an
//     exact largest-remainder split that survives per-invoice discounts;
//   * payment posting: Dr bank/cash by payment_method, Cr receivable;
//   * missing mapping => BLOCKED into the explicit exception queue with NO journal
//     entry and NO suspense guess; re-post after fixing the mapping succeeds;
//   * idempotent re-post returns the original entry;
//   * exception queue resolve/dismiss;
//   * source-to-ledger reconciliation report: posted/blocked/pending + drift 0;
//   * two-tenant isolation.
import { randomUUID } from 'node:crypto';
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

let failed = false;
function assert(cond, msg) {
  if (!cond) { failed = true; console.log(`  FAIL: ${msg}`); }
  else console.log(`  ok: ${msg}`);
}

async function applyFile(label) {
  const file = path.join(process.cwd(), 'migrations', '0103_accounting_student_adapter.sql');
  await pool.query(fs.readFileSync(file, 'utf-8'));
  console.log(`[${label}] applied OK`);
}

async function inventory() {
  const tables = await pool.query(`select table_name from information_schema.tables
    where table_schema='public' and table_name in ('accounting_source_mappings','accounting_adapter_exceptions')`);
  const have = new Set(tables.rows.map(r => r.table_name));
  const expected = ['accounting_source_mappings', 'accounting_adapter_exceptions'];
  assert(expected.every(t => have.has(t)), `tables ${have.size}/${expected.length}`);
  const defIdx = await pool.query(`select 1 from pg_indexes where tablename='accounting_source_mappings' and indexname='accounting_source_mappings_default_unique'`);
  assert(defIdx.rows.length === 1, 'single-default partial unique index present');
  const statusCheck = await pool.query(`select 1 from information_schema.check_constraints
    where constraint_name='accounting_adapter_exceptions_status_check'`);
  assert(statusCheck.rows.length === 1, 'exception status CHECK present');
}

async function makeTenant(tag) {
  const suffix = tag + '-' + randomUUID().slice(0, 6);
  const slug = 'v0103-' + randomUUID().slice(0, 10);
  const t = await pool.query(`insert into tenants (name, slug) values ($1,$2) returning id`, [suffix, slug]);
  const tenantId = t.rows[0].id;
  await pool.query(`insert into fiscal_periods (tenant_id,name,start_date,end_date,status)
    values ($1,'ACCOUNTING-VERIFY-2098','2098-01-01','2098-12-31','open')`, [tenantId]);
  const mk = (code, name, type) => pool.query(`insert into chart_of_accounts (tenant_id,code,name,account_type) values ($1,$2,$3,$4) returning id`,
    [tenantId, `${code}-${suffix}`, `${name} ${suffix}`, type]).then(r => r.rows[0].id);
  const recv = await mk('RECV', 'Créances élèves', 'asset');
  const rev = await mk('REV', 'Produits scolarité', 'revenue');
  const bnk = await mk('BNK', 'Banque', 'asset');
  const exp = await mk('EXP', 'Frais', 'expense');
  await pool.query(`insert into accounting_journals (tenant_id,code,name,journal_type)
    values ($1,'GEN','Journal général','general') on conflict (tenant_id,code) do update set is_active=true`, [tenantId]);
  for (const [code, module] of [['INV', 'student_invoice'], ['PAY', 'student_payment']]) {
    await pool.query(`insert into accounting_voucher_types (tenant_id,journal_id,code,name,source_module,is_system)
      select $1, j.id, $2, $3, $4, false from accounting_journals j where j.tenant_id=$1 and j.code='GEN'
      on conflict (tenant_id, code) do update set is_active=true`, [tenantId, code, code, module]);
  }
  const studentId = 'stu-' + randomUUID().slice(0, 12);
  await pool.query(`insert into "user" (id, tenant_id, email, name) values ($1,$2,$3,$4)`,
    [studentId, tenantId, `${studentId}@verify.test`, `Étudiant ${suffix}`]);
  const cat = await pool.query(`insert into fee_categories (tenant_id,name) values ($1,'Scolarité') returning id`, [tenantId]);
  const cat2 = await pool.query(`insert into fee_categories (tenant_id,name) values ($1,'Transport') returning id`, [tenantId]);
  return { tenantId, recv, rev, bnk, exp, studentId, catId: cat.rows[0].id, cat2Id: cat2.rows[0].id };
}

async function makeInvoice(tenantId, studentId, { invoiceNumber, amount, discount = 0, issueDate = '2098-02-01' }) {
  const net = (amount - discount).toFixed(2);
  const inv = await pool.query(`insert into invoices
    (tenant_id,student_id,invoice_number,amount,discount_amount,net_amount,paid_amount,status,due_date,issue_date)
    values ($1,$2,$3,$4,$5,$6,0,'pending','2098-09-30',$7) returning id`,
    [tenantId, studentId, invoiceNumber, amount.toFixed(2), discount.toFixed(2), net, issueDate]);
  return inv.rows[0].id;
}

async function addInvoiceItem(tenantId, invoiceId, feeCategoryId, description, amount) {
  await pool.query(`insert into invoice_items (tenant_id,invoice_id,fee_category_id,description,amount)
    values ($1,$2,$3,$4,$5)`, [tenantId, invoiceId, feeCategoryId, description, amount.toFixed(2)]);
}

async function makePayment(tenantId, studentId, invoiceId, { amount, paymentMethod = 'cash', referenceId }) {
  const pay = await pool.query(`insert into payments
    (tenant_id,invoice_id,student_id,amount,payment_method,payment_date,reference_id,received_by_id)
    values ($1,$2,$3,$4,$5,'2098-02-05',$6,$3) returning id`,
    [tenantId, invoiceId, studentId, amount.toFixed(2), paymentMethod, referenceId]);
  return pay.rows[0].id;
}

async function postedEntry(tenantId, sourceModule, sourceDocumentId) {
  const rows = await pool.query(`select je.id, je.entry_number, je.entry_date, je.description, je.source_module
    from accounting_posting_requests apr
    join accounting_journal_links ajl on ajl.tenant_id=apr.tenant_id and ajl.posting_request_id=apr.id
    join journal_entries je on je.tenant_id=apr.tenant_id and je.id=ajl.journal_entry_id
    where apr.tenant_id=$1 and apr.source_module=$2 and apr.source_document_id=$3 and apr.status='succeeded'
    limit 1`, [tenantId, sourceModule, sourceDocumentId]);
  return rows.rows[0] ?? null;
}

async function entryLines(tenantId, entryId) {
  const rows = await pool.query(`select jel.account_id, jel.debit_amount, jel.credit_amount, jel.memo
    from journal_entry_lines jel where jel.tenant_id=$1 and jel.journal_entry_id=$2 order by jel.credit_amount desc, jel.account_id`, [tenantId, entryId]);
  return rows.rows;
}

async function openException(tenantId, sourceModule, sourceDocumentId) {
  const rows = await pool.query(`select id, reason, status from accounting_adapter_exceptions
    where tenant_id=$1 and source_module=$2 and source_document_id=$3 and status='open' limit 1`, [tenantId, sourceModule, sourceDocumentId]);
  return rows.rows[0] ?? null;
}

function moneyToCents(value) {
  const [units = '0', fraction = ''] = String(value).split('.');
  return BigInt(units) * 100n + BigInt(fraction.padEnd(2, '0'));
}

loadLocalEnv();
const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos' });

async function main() {
  const svc = await import('../src/features/accounting/services/student-accounting-adapter');

  console.log('--- PASS 1 (apply) ---');
  await applyFile('pass1');
  await inventory();
  console.log('\n--- PASS 2 (re-run, idempotency) ---');
  await applyFile('pass2');
  await inventory();

  console.log('\n--- A1: invoice posting with complete mappings ---');
  {
    const t = await makeTenant('a1');
    await svc.upsertSourceMapping({ tenantId: t.tenantId, userId: 'verify' }, { sourceModule: 'student_invoice', sourceKeyType: 'student', sourceKey: t.studentId, accountId: t.recv });
    await svc.upsertSourceMapping({ tenantId: t.tenantId, userId: 'verify' }, { sourceModule: 'student_invoice', sourceKeyType: 'fee_category', sourceKey: t.catId, accountId: t.rev });
    const invId = await makeInvoice(t.tenantId, t.studentId, { invoiceNumber: 'F-1001', amount: 500 });
    await addInvoiceItem(t.tenantId, invId, t.catId, 'Scolarité T1', 500);
    const result = await svc.postStudentInvoice({ tenantId: t.tenantId, userId: 'verify' }, invId, { journalCode: 'GEN', voucherTypeCode: 'INV' });
    assert(!result.blocked, 'invoice posts (not blocked)');
    assert(result.entry?.sourceModule === 'student_invoice', `source module student_invoice (${result.entry?.sourceModule})`);
    const lines = await entryLines(t.tenantId, result.entry.id);
    const dr = lines.filter(l => moneyToCents(l.debit_amount) > 0n);
    const cr = lines.filter(l => moneyToCents(l.credit_amount) > 0n);
    assert(dr.length === 1 && dr[0].account_id === t.recv && moneyToCents(dr[0].debit_amount) === 50000n, 'Dr receivable = 500.00');
    assert(cr.length === 1 && cr[0].account_id === t.rev && moneyToCents(cr[0].credit_amount) === 50000n, 'Cr revenue = 500.00');
    const ok = await postedEntry(t.tenantId, 'student_invoice', invId);
    assert(!!ok, 'posting request succeeded + linked to a journal entry');
  }

  console.log('\n--- A2: missing fee-category mapping blocks (no journal, no suspense) ---');
  {
    const t = await makeTenant('a2');
    await svc.upsertSourceMapping({ tenantId: t.tenantId, userId: 'verify' }, { sourceModule: 'student_invoice', sourceKeyType: 'student', sourceKey: t.studentId, accountId: t.recv });
    // NO revenue mapping for catId
    const invId = await makeInvoice(t.tenantId, t.studentId, { invoiceNumber: 'F-2001', amount: 300 });
    await addInvoiceItem(t.tenantId, invId, t.catId, 'Scolarité T1', 300);
    const result = await svc.postStudentInvoice({ tenantId: t.tenantId, userId: 'verify' }, invId, { journalCode: 'GEN', voucherTypeCode: 'INV' });
    assert(result.blocked && result.reason === 'MAPPING_FEE_CATEGORY_MISSING', `blocked with MAPPING_FEE_CATEGORY_MISSING (${result.reason})`);
    const exc = await openException(t.tenantId, 'student_invoice', invId);
    assert(!!exc, 'exception queued (open)');
    const entry = await postedEntry(t.tenantId, 'student_invoice', invId);
    assert(!entry, 'NO journal entry was created for the blocked invoice');
    const lines = await pool.query(`select count(*)::int c from journal_entry_lines jel
      join journal_entries je on je.id=jel.journal_entry_id and je.tenant_id=jel.tenant_id
      where jel.tenant_id=$1 and je.source_module='student_invoice'`, [t.tenantId]);
    assert(lines.rows[0].c === 0, 'no student_invoice journal lines at all (nothing guessed to suspense)');

    // fix the mapping, re-post the same blocked invoice
    await svc.upsertSourceMapping({ tenantId: t.tenantId, userId: 'verify' }, { sourceModule: 'student_invoice', sourceKeyType: 'fee_category', sourceKey: t.catId, accountId: t.rev });
    const retry = await svc.postStudentInvoice({ tenantId: t.tenantId, userId: 'verify' }, invId, { journalCode: 'GEN', voucherTypeCode: 'INV' });
    assert(!retry.blocked && retry.entry?.sourceModule === 'student_invoice', 're-post after mapping fix succeeds');
    assert(!!(await postedEntry(t.tenantId, 'student_invoice', invId)), 'invoice now posted');
    const open = await pool.query(`select count(*)::int c from accounting_adapter_exceptions where tenant_id=$1 and source_document_id=$2 and status='open'`, [t.tenantId, invId]);
    assert(open.rows[0].c === 0, 'open exception auto-resolved after successful post');
  }

  console.log('\n--- A3: multi-category + discount allocation stays exactly balanced ---');
  {
    const t = await makeTenant('a3');
    await svc.upsertSourceMapping({ tenantId: t.tenantId, userId: 'verify' }, { sourceModule: 'student_invoice', sourceKeyType: 'student', sourceKey: t.studentId, accountId: t.recv });
    await svc.upsertSourceMapping({ tenantId: t.tenantId, userId: 'verify' }, { sourceModule: 'student_invoice', sourceKeyType: 'fee_category', sourceKey: t.catId, accountId: t.rev });
    await svc.upsertSourceMapping({ tenantId: t.tenantId, userId: 'verify' }, { sourceModule: 'student_invoice', sourceKeyType: 'fee_category', sourceKey: t.cat2Id, accountId: t.exp });
    const invId = await makeInvoice(t.tenantId, t.studentId, { invoiceNumber: 'F-3001', amount: 600, discount: 50 });
    await addInvoiceItem(t.tenantId, invId, t.catId, 'Scolarité', 400);
    await addInvoiceItem(t.tenantId, invId, t.cat2Id, 'Transport', 200);
    const result = await svc.postStudentInvoice({ tenantId: t.tenantId, userId: 'verify' }, invId, { journalCode: 'GEN', voucherTypeCode: 'INV' });
    assert(!result.blocked, 'discounted multi-category invoice posts');
    const lines = await entryLines(t.tenantId, result.entry.id);
    const drTotal = lines.reduce((s, l) => s + moneyToCents(l.debit_amount), 0n);
    const crTotal = lines.reduce((s, l) => s + moneyToCents(l.credit_amount), 0n);
    assert(drTotal === 55000n, `Dr total = 550.00 (${result.entry.description})`);
    assert(crTotal === 55000n, `Cr total = 550.00 (net after discount)`);
    assert(drTotal === crTotal, 'debit === credit exactly');
    const crLines = lines.filter(l => moneyToCents(l.credit_amount) > 0n).sort((a, b) => {
      const diff = moneyToCents(b.credit_amount) - moneyToCents(a.credit_amount);
      return diff > 0n ? 1 : diff < 0n ? -1 : 0;
    });
    assert(crLines.length === 2 && moneyToCents(crLines[0].credit_amount) === 36667n && moneyToCents(crLines[1].credit_amount) === 18333n,
      `proportional split: 366.67 + 183.33 = 550.00 (got ${crLines[0]?.credit_amount}, ${crLines[1]?.credit_amount})`);
  }

  console.log('\n--- A4: payment posting (payment_method mapping) ---');
  {
    const t = await makeTenant('a4');
    await svc.upsertSourceMapping({ tenantId: t.tenantId, userId: 'verify' }, { sourceModule: 'student_payment', sourceKeyType: 'payment_method', sourceKey: 'cash', accountId: t.bnk });
    await svc.upsertSourceMapping({ tenantId: t.tenantId, userId: 'verify' }, { sourceModule: 'student_payment', sourceKeyType: 'student', sourceKey: t.studentId, accountId: t.recv });
    const invId = await makeInvoice(t.tenantId, t.studentId, { invoiceNumber: 'F-4001', amount: 250 });
    await addInvoiceItem(t.tenantId, invId, t.catId, 'Scolarité', 250);
    const payId = await makePayment(t.tenantId, t.studentId, invId, { amount: 250, referenceId: 'PAY-4001' });
    const result = await svc.postStudentPayment({ tenantId: t.tenantId, userId: 'verify' }, payId, { journalCode: 'GEN', voucherTypeCode: 'PAY' });
    assert(!result.blocked, 'payment posts (not blocked)');
    const lines = await entryLines(t.tenantId, result.entry.id);
    const dr = lines.find(l => moneyToCents(l.debit_amount) > 0n);
    const cr = lines.find(l => moneyToCents(l.credit_amount) > 0n);
    assert(dr?.account_id === t.bnk && moneyToCents(dr.debit_amount) === 25000n, 'Dr bank = 250.00');
    assert(cr?.account_id === t.recv && moneyToCents(cr.credit_amount) === 25000n, 'Cr receivable = 250.00');
    assert(!!(await postedEntry(t.tenantId, 'student_payment', payId)), 'payment posting request succeeded');
  }

  console.log('\n--- A5: payment missing mapping blocks; idempotent re-post ---');
  {
    const t = await makeTenant('a5');
    await svc.upsertSourceMapping({ tenantId: t.tenantId, userId: 'verify' }, { sourceModule: 'student_payment', sourceKeyType: 'payment_method', sourceKey: 'cash', accountId: t.bnk });
    // receivable mapping intentionally missing
    const invId = await makeInvoice(t.tenantId, t.studentId, { invoiceNumber: 'F-5001', amount: 100 });
    await addInvoiceItem(t.tenantId, invId, t.catId, 'Scolarité', 100);
    const payId = await makePayment(t.tenantId, t.studentId, invId, { amount: 100, referenceId: 'PAY-5001' });
    const blocked = await svc.postStudentPayment({ tenantId: t.tenantId, userId: 'verify' }, payId, { journalCode: 'GEN', voucherTypeCode: 'PAY' });
    assert(blocked.blocked && blocked.reason === 'MAPPING_RECEIVABLE_MISSING', `payment blocked (${blocked.reason})`);
    assert(!!(await openException(t.tenantId, 'student_payment', payId)), 'payment exception queued');
    assert(!(await postedEntry(t.tenantId, 'student_payment', payId)), 'no journal entry for blocked payment');

    await svc.upsertSourceMapping({ tenantId: t.tenantId, userId: 'verify' }, { sourceModule: 'student_payment', sourceKeyType: 'student', sourceKey: t.studentId, accountId: t.recv });
    const first = await svc.postStudentPayment({ tenantId: t.tenantId, userId: 'verify' }, payId, { journalCode: 'GEN', voucherTypeCode: 'PAY' });
    assert(!first.blocked && !first.idempotent, 'payment posts after mapping fix (fresh)');
    const second = await svc.postStudentPayment({ tenantId: t.tenantId, userId: 'verify' }, payId, { journalCode: 'GEN', voucherTypeCode: 'PAY' });
    assert(second.idempotent && second.entry.id === first.entry.id, 'idempotent re-post returns the same original entry');
    const count = await pool.query(`select count(*)::int c from accounting_posting_requests where tenant_id=$1 and source_module='student_payment' and source_document_id=$2`, [t.tenantId, payId]);
    assert(count.rows[0].c === 1, 'only one posting request row for the payment');
  }

  console.log('\n--- A6: exception queue resolve / dismiss ---');
  {
    const t = await makeTenant('a6');
    await svc.upsertSourceMapping({ tenantId: t.tenantId, userId: 'verify' }, { sourceModule: 'student_invoice', sourceKeyType: 'student', sourceKey: t.studentId, accountId: t.recv });
    const invId = await makeInvoice(t.tenantId, t.studentId, { invoiceNumber: 'F-6001', amount: 80 });
    await addInvoiceItem(t.tenantId, invId, t.catId, 'Scolarité', 80);
    await svc.postStudentInvoice({ tenantId: t.tenantId, userId: 'verify' }, invId, { journalCode: 'GEN', voucherTypeCode: 'INV' });
    const exc = await openException(t.tenantId, 'student_invoice', invId);
    assert(!!exc, 'exception exists');
    const r = await svc.resolveAdapterException({ tenantId: t.tenantId, userId: 'verify' }, exc.id, 'dismiss', 'À traiter hors module');
    assert(r.status === 'dismissed', 'exception dismissed');
    const again = await pool.query(`select status from accounting_adapter_exceptions where id=$1`, [exc.id]);
    assert(again.rows[0].status === 'dismissed', 'status persisted as dismissed');
    const listed = await svc.listAdapterExceptions({ tenantId: t.tenantId, userId: 'verify' });
    assert(Array.isArray(listed) && listed.every(e => e.tenantId === t.tenantId), 'listAdapterExceptions tenant-scoped');
  }

  console.log('\n--- A7: default mapping fallback + single default enforced ---');
  {
    const t = await makeTenant('a7');
    // default student->receivable for student_invoice; no per-student mapping
    await svc.upsertSourceMapping({ tenantId: t.tenantId, userId: 'verify' }, { sourceModule: 'student_invoice', sourceKeyType: 'student', sourceKey: null, accountId: t.recv });
    await svc.upsertSourceMapping({ tenantId: t.tenantId, userId: 'verify' }, { sourceModule: 'student_invoice', sourceKeyType: 'fee_category', sourceKey: t.catId, accountId: t.rev });
    const invId = await makeInvoice(t.tenantId, t.studentId, { invoiceNumber: 'F-7001', amount: 120 });
    await addInvoiceItem(t.tenantId, invId, t.catId, 'Scolarité', 120);
    const result = await svc.postStudentInvoice({ tenantId: t.tenantId, userId: 'verify' }, invId, { journalCode: 'GEN', voucherTypeCode: 'INV' });
    assert(!result.blocked, 'default mapping resolves the receivable (no per-student mapping needed)');
    // replace the default and verify it is a single row
    await svc.upsertSourceMapping({ tenantId: t.tenantId, userId: 'verify' }, { sourceModule: 'student_invoice', sourceKeyType: 'student', sourceKey: null, accountId: t.bnk });
    const defs = await pool.query(`select count(*)::int c from accounting_source_mappings where tenant_id=$1 and source_module='student_invoice' and source_key_type='student' and source_key is null`, [t.tenantId]);
    assert(defs.rows[0].c === 1, 'exactly one default mapping row per tenant+module+type');
    const updated = await pool.query(`select account_id from accounting_source_mappings where tenant_id=$1 and source_module='student_invoice' and source_key_type='student' and source_key is null`, [t.tenantId]);
    assert(updated.rows[0].account_id === t.bnk, 'default mapping updated in place');
  }

  console.log('\n--- A8: source-to-ledger reconciliation report ---');
  {
    const t = await makeTenant('a8');
    await svc.upsertSourceMapping({ tenantId: t.tenantId, userId: 'verify' }, { sourceModule: 'student_invoice', sourceKeyType: 'student', sourceKey: t.studentId, accountId: t.recv });
    await svc.upsertSourceMapping({ tenantId: t.tenantId, userId: 'verify' }, { sourceModule: 'student_invoice', sourceKeyType: 'fee_category', sourceKey: t.catId, accountId: t.rev });
    await svc.upsertSourceMapping({ tenantId: t.tenantId, userId: 'verify' }, { sourceModule: 'student_payment', sourceKeyType: 'payment_method', sourceKey: 'cash', accountId: t.bnk });
    await svc.upsertSourceMapping({ tenantId: t.tenantId, userId: 'verify' }, { sourceModule: 'student_payment', sourceKeyType: 'student', sourceKey: t.studentId, accountId: t.recv });

    const invPosted = await makeInvoice(t.tenantId, t.studentId, { invoiceNumber: 'F-8001', amount: 200 });
    await addInvoiceItem(t.tenantId, invPosted, t.catId, 'Scolarité', 200);
    await svc.postStudentInvoice({ tenantId: t.tenantId, userId: 'verify' }, invPosted, { journalCode: 'GEN', voucherTypeCode: 'INV' });
    const payPosted = await makePayment(t.tenantId, t.studentId, invPosted, { amount: 200, referenceId: 'PAY-8001' });
    await svc.postStudentPayment({ tenantId: t.tenantId, userId: 'verify' }, payPosted, { journalCode: 'GEN', voucherTypeCode: 'PAY' });
    const invPending = await makeInvoice(t.tenantId, t.studentId, { invoiceNumber: 'F-8002', amount: 90 });
    await addInvoiceItem(t.tenantId, invPending, t.catId, 'Scolarité', 90);
    const invBlocked = await makeInvoice(t.tenantId, t.studentId, { invoiceNumber: 'F-8003', amount: 70 });
    await addInvoiceItem(t.tenantId, invBlocked, t.cat2Id, 'Transport', 70); // cat2 has NO revenue mapping
    const blockedAttempt = await svc.postStudentInvoice({ tenantId: t.tenantId, userId: 'verify' }, invBlocked, { journalCode: 'GEN', voucherTypeCode: 'INV' });
    assert(blockedAttempt.blocked, 'attempting the unmapped invoice blocks into the queue');

    const report = await svc.studentLedgerReconciliation({ tenantId: t.tenantId, userId: 'verify' });
    assert(report.counts.posted === 2 && report.counts.blocked === 1 && report.counts.pending === 1,
      `report counts posted=2 blocked=1 pending=1 (got ${JSON.stringify(report.counts)})`);
    const st = moneyToCents(report.summary.sourceTotal);
    const postedC = moneyToCents(report.summary.postedTotal);
    const blockedC = moneyToCents(report.summary.blockedTotal);
    const pendingC = moneyToCents(report.summary.pendingTotal);
    assert(st === postedC + blockedC + pendingC,
      `source total = posted + blocked + pending (${report.summary.sourceTotal} vs ${report.summary.postedTotal}+${report.summary.blockedTotal}+${report.summary.pendingTotal})`);
    assert(moneyToCents(report.summary.drift) === blockedC + pendingC,
      `drift equals the blocked/pending amount (${report.summary.drift})`);
    const b = report.rows.find(r => r.documentId === invBlocked);
    assert(b?.state === 'blocked' && b?.reason === 'MAPPING_FEE_CATEGORY_MISSING', 'blocked invoice reported with reason');
    const p = report.rows.find(r => r.documentId === invPending);
    assert(p?.state === 'pending', 'pending invoice reported as pending');
  }

  console.log('\n--- A9: two-tenant isolation ---');
  {
    const t1 = await makeTenant('iso1');
    const t2 = await makeTenant('iso2');
    // full mappings in t1 only
    await svc.upsertSourceMapping({ tenantId: t1.tenantId, userId: 'verify' }, { sourceModule: 'student_invoice', sourceKeyType: 'student', sourceKey: t1.studentId, accountId: t1.recv });
    await svc.upsertSourceMapping({ tenantId: t1.tenantId, userId: 'verify' }, { sourceModule: 'student_invoice', sourceKeyType: 'fee_category', sourceKey: t1.catId, accountId: t1.rev });
    const invT1 = await makeInvoice(t1.tenantId, t1.studentId, { invoiceNumber: 'F-9001', amount: 60 });
    await addInvoiceItem(t1.tenantId, invT1, t1.catId, 'Scolarité', 60);
    const ok1 = await svc.postStudentInvoice({ tenantId: t1.tenantId, userId: 'verify' }, invT1, { journalCode: 'GEN', voucherTypeCode: 'INV' });
    assert(!ok1.blocked, 'tenant 1 posts its invoice');

    // tenant 2 has no mappings: posting t2's invoice must block, never cross-tenant
    const invT2 = await makeInvoice(t2.tenantId, t2.studentId, { invoiceNumber: 'F-9002', amount: 40 });
    await addInvoiceItem(t2.tenantId, invT2, t2.catId, 'Scolarité', 40);
    const ok2 = await svc.postStudentInvoice({ tenantId: t2.tenantId, userId: 'verify' }, invT2, { journalCode: 'GEN', voucherTypeCode: 'INV' });
    assert(ok2.blocked, 'tenant 2 invoice blocked (no mappings)');
    assert(!!(await openException(t2.tenantId, 'student_invoice', invT2)), 'tenant 2 exception in tenant 2 only');

    // cross-tenant isolation: t2 posting request must not see t1 entry; mappings list tenant-scoped
    assert(!(await postedEntry(t2.tenantId, 'student_invoice', invT2)), 'tenant 2 has no posted entry for its invoice');
    const t1m = await svc.listSourceMappings({ tenantId: t1.tenantId, userId: 'verify' });
    const t2m = await svc.listSourceMappings({ tenantId: t2.tenantId, userId: 'verify' });
    assert(t1m.length === 2 && t2m.length === 0, `mappings tenant-scoped (t1=${t1m.length}, t2=${t2m.length})`);
    const t1ex = await svc.listAdapterExceptions({ tenantId: t1.tenantId, userId: 'verify' });
    const t2ex = await svc.listAdapterExceptions({ tenantId: t2.tenantId, userId: 'verify' });
    assert(t1ex.length === 0 && t2ex.length === 1 && t1m.every(m => m.tenantId === t1.tenantId), 'exceptions/mappings never leak across tenants');
  }

  await pool.end();
  if (failed) { console.error('\nVERDICT: FAIL'); process.exit(1); }
  console.log('\nVERDICT: PASS (student accounting adapter: mapped postings, block-with-exception, no suspense, reconciled, tenant-safe)');
}

main().catch(async (error) => { console.error(error); await pool.end().catch(() => {}); process.exit(1); });
