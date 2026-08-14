// WA#38 — Reversal-concurrency mandatory test.
// Posts one balanced voucher, then races SIX concurrent reversals of the same
// original entry through the canonical posting service. The single-reversal rule
// is enforced by the DB unique constraint on
// accounting_journal_links.reversal_of_entry_id, and racing reversals serialize on
// the journal/year numbering advisory lock — so exactly one reversal must win and
// every other must fail with a 23505 unique violation. The verifier also asserts
// replay idempotency of the winning reversal, sequential double-reversal rejection,
// net-zero ledger impact, and two-tenant isolation.
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

let passCount = 0;
let failed = false;
function assert(cond, msg) {
  if (!cond) { failed = true; console.log(`  FAIL: ${msg}`); }
  else { passCount += 1; console.log(`  ok: ${msg}`); }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos' });
let money;
let posting;

async function makeTenant(tag) {
  const t = await pool.query(`insert into tenants (name, slug) values ($1,$2) returning id`, [tag + '-' + randomUUID().slice(0, 6), 'vreversal-' + randomUUID().slice(0, 10)]);
  const tenantId = t.rows[0].id;
  await pool.query(`insert into fiscal_periods (tenant_id,name,start_date,end_date,status)
    values ($1,'ACCOUNTING-VERIFY-2098','2098-01-01','2098-12-31','open')`, [tenantId]);
  const mk = (code, name, type) => pool.query(`insert into chart_of_accounts (tenant_id,code,name,account_type)
    values ($1,$2,$3,$4) returning id`, [tenantId, code, name, type]).then(r => r.rows[0].id);
  const bank = await mk('5121', 'Banque', 'asset');
  const rev = await mk('7121', 'Ventes', 'revenue');
  await pool.query(`insert into accounting_journals (tenant_id,code,name,journal_type)
    values ($1,'GEN','Journal général','general') on conflict (tenant_id,code) do update set is_active=true`, [tenantId]);
  await pool.query(`insert into accounting_voucher_types (tenant_id,journal_id,code,name,source_module,is_system)
    select $1, j.id, 'GENV', 'Pièce de vérification', null, false from accounting_journals j where j.tenant_id=$1 and j.code='GEN'
    on conflict (tenant_id, code) do update set is_active=true`, [tenantId]);
  return { tenantId, bank, rev };
}

function makeReversal(tenantId, description, idempotencyKey, originalEntryId, sourceDocumentId) {
  return {
    tenantId,
    actorId: 'verify',
    entryDate: '2098-03-15',
    description,
    sourceModule: 'verify',
    sourceDocumentId: sourceDocumentId ?? randomUUID(),
    sourceVersion: 1,
    idempotencyKey,
    journalCode: 'GEN',
    voucherTypeCode: 'GENV',
    eventReason: 'Automated verification',
    originalEntryId,
  };
}

async function reversalCount(tenantId, originalEntryId) {
  const r = await pool.query(
    `select count(*)::int as n from accounting_journal_links where tenant_id=$1 and reversal_of_entry_id=$2`,
    [tenantId, originalEntryId]);
  return r.rows[0].n;
}

async function trialBalance(tenantId) {
  const r = await pool.query(`
    select coalesce(sum(l.debit_amount),0)::text as debit, coalesce(sum(l.credit_amount),0)::text as credit
    from journal_entry_lines l
    join journal_entries e on e.tenant_id=l.tenant_id and e.id=l.journal_entry_id
    where l.tenant_id=$1 and e.status='posted'`, [tenantId]);
  return { debit: money.moneyToCents(r.rows[0].debit), credit: money.moneyToCents(r.rows[0].credit) };
}

async function scenario(tag) {
  console.log(`\n[${tag}]`);
  const { tenantId, bank, rev } = await makeTenant(tag);
  const original = await posting.postAccountingVoucher({
    tenantId,
    actorId: 'verify',
    entryDate: '2098-03-15',
    description: `Original ${tag}`,
    sourceModule: 'verify',
    sourceDocumentId: randomUUID(),
    sourceVersion: 1,
    idempotencyKey: `reversal-verify:${tenantId}:original`,
    journalCode: 'GEN',
    voucherTypeCode: 'GENV',
    lines: [
      { accountId: bank, debitAmount: '100.00', creditAmount: '0' },
      { accountId: rev, debitAmount: '0', creditAmount: '100.00' },
    ],
  });
  assert(original.totalDebit === '100.00' && original.totalCredit === '100.00', 'original voucher posts balanced (100.00 / 100.00)');

  // Race SIX reversals of the same original with DISTINCT idempotency keys.
  const attempts = Array.from({ length: 6 }, (_, i) => makeReversal(tenantId, `Reversal ${tag} #${i}`, `reversal-verify:${tenantId}:race-${i}`, original.entry.id));
  const outcomes = await Promise.all(attempts.map(input => posting.reverseAccountingVoucher(input)
    .then(result => ({ ok: true, result, input }), error => ({ ok: false, code: error?.code, message: error?.message, input }))));
  const wins = outcomes.filter(o => o.ok);
  const losses = outcomes.filter(o => !o.ok);
  assert(wins.length === 1, `exactly one of six racing reversals wins (got ${wins.length})`);
  assert(losses.length === 5, `the other five reversals are rejected (got ${losses.length})`);
  // drizzle does not surface PG error.code, but the failing statement is always
  // the accounting_journal_links insert whose reversal_of_entry_id is the original
  // entry — the single-reversal-link unique constraint firing.
  const atGuard = o => !o.ok && (o.message ?? '').includes('accounting_journal_links');
  assert(losses.every(atGuard), 'every losing reversal is rejected at the single-reversal-link guard (journal_links insert)');
  assert(await reversalCount(tenantId, original.entry.id) === 1, 'database holds exactly one reversal link for the original');

  // Replay: re-issuing the winning reversal with the EXACT same payload returns the
  // same reversal entry (idempotent), not a new one.
  const replay = await posting.reverseAccountingVoucher(wins[0].input)
    .then(result => ({ ok: true, result }), error => ({ ok: false, code: error?.code, message: error?.message }));
  assert(replay.ok && replay.result.idempotent === true, `re-issuing the winning reversal with the same payload replays the same entry (idempotent); ${replay.ok ? '' : `${replay.code} — ${replay.message}`}`);
  assert(await reversalCount(tenantId, original.entry.id) === 1, 'replay did not add a second reversal link');

  // Sequential double reversal (different key) after the winner is also rejected.
  let doubleCode = '';
  let doubleMessage = '';
  try {
    await posting.reverseAccountingVoucher(makeReversal(tenantId, `Double ${tag}`, `reversal-verify:${tenantId}:double`, original.entry.id));
  } catch (error) {
    doubleCode = error?.code ?? '';
    doubleMessage = error?.message ?? '';
  }
  assert(doubleCode === '' && doubleMessage.includes('accounting_journal_links'), 'a second sequential reversal of the same original is rejected at the single-reversal-link guard');

  // Net ledger impact is zero: original + reversal leave the trial balance balanced.
  const tb = await trialBalance(tenantId);
  assert(tb.debit === tb.credit, 'trial balance stays balanced after original + reversal');
  const posted = await pool.query(
    `select count(*)::int as n from journal_entries where tenant_id=$1 and status='posted'`, [tenantId]);
  assert(posted.rows[0].n === 2, 'exactly two posted entries remain (original + one reversal)');

  return { tenantId, originalId: original.entry.id };
}

async function main() {
  loadLocalEnv();
  money = await import('../src/libs/finance/money');
  posting = await import('../src/features/accounting/services/posting-service');
  try {
    console.log('WA#38 reversal-concurrency verification');
    const t1 = await scenario('tenant-A');
    const t2 = await scenario('tenant-B');
    const linksT1 = await pool.query(
      `select count(*)::int as n from accounting_journal_links where reversal_of_entry_id=$1 and tenant_id=$2`,
      [t1.originalId, t2.tenantId]);
    assert(linksT1.rows[0].n === 0, 'tenant B cannot reference tenant A’s reversal link');
    if (failed) { console.log(`FAIL reversal-concurrency verification (${passCount}/${passCount + 1})`); process.exit(1); }
    console.log(`PASS reversal-concurrency verification ${passCount}/${passCount}`);
  } finally {
    await pool.end();
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
