// Verify + (re)apply migration 0098_accounting_bank_reconciliation.sql against the
// live DB, then exercise the reconciliation service end to end:
//   * bounded, validated CSV import (malformed / oversized / replayed content);
//   * statement-line lifecycle: match / unmatch / split / merge;
//   * signed close (blocked by unmatched lines; variance requires a reason;
//     idempotent re-close; reconciledAt + closed event);
//   * DB-level immutability of every statement artifact once completed;
//   * controlled fee/interest postings through the canonical posting service;
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
  const file = path.join(process.cwd(), 'migrations', '0098_accounting_bank_reconciliation.sql');
  await pool.query(fs.readFileSync(file, 'utf-8'));
  console.log(`[${label}] applied OK`);
}

async function inventory() {
  const tables = await pool.query(`select table_name from information_schema.tables
    where table_schema='public' and table_name in ('accounting_statement_imports','accounting_statement_lines','accounting_statement_matches','accounting_reconciliation_events')`);
  const have = new Set(tables.rows.map(r => r.table_name));
  const expected = ['accounting_statement_imports','accounting_statement_lines','accounting_statement_matches','accounting_reconciliation_events'];
  assert(expected.every(t => have.has(t)), `tables ${have.size}/${expected.length}`);
  const tr = await pool.query(`select distinct trigger_name from information_schema.triggers
    where trigger_name in ('accounting_statement_lines_closed_trigger','accounting_statement_matches_closed_trigger','accounting_statement_imports_closed_trigger','accounting_reconciliation_events_immutable_trigger')`);
  assert(tr.rows.length === 4, `triggers ${tr.rows.length}/4`);
  const col = await pool.query(`select 1 from information_schema.columns
    where table_schema='public' and table_name='bank_reconciliations' and column_name='reconciled_at'`);
  assert(col.rows.length === 1, 'bank_reconciliations.reconciled_at present');
}

async function makeTenant(tag) {
  const suffix = tag + '-' + randomUUID().slice(0, 6);
  const slug = 'v0098-' + randomUUID().slice(0, 10);
  const t = await pool.query(`insert into tenants (name, slug) values ($1,$2) returning id`, [suffix, slug]);
  const tenantId = t.rows[0].id;
  await pool.query(`insert into fiscal_periods (tenant_id,name,start_date,end_date,status)
    values ($1,'ACCOUNTING-VERIFY-2098','2098-01-01','2098-12-31','open')`, [tenantId]);
  const mk = (code, name, type) => pool.query(`insert into chart_of_accounts (tenant_id,code,name,account_type) values ($1,$2,$3,$4) returning id`,
    [tenantId, `${code}-${suffix}`, `${name} ${suffix}`, type]).then(r => r.rows[0].id);
  const dr = await mk('V-DR', 'Débit', 'asset');
  const cr = await mk('V-CR', 'Crédit', 'liability');
  const bnk = await mk('BNK', 'Banque', 'asset');
  const exp = await mk('EXP', 'Frais', 'expense');
  const rev = await mk('REV', 'Produits', 'revenue');
  await pool.query(`insert into accounting_journals (tenant_id,code,name,journal_type)
    values ($1,'GEN','Journal général','general') on conflict (tenant_id,code) do update set is_active=true`, [tenantId]);
  await pool.query(`insert into accounting_voucher_types (tenant_id,journal_id,code,name,source_module,is_system)
    select $1, j.id, 'BNK-FEE', 'Frais/Intérêts bancaires', 'bank_reconciliation', false
    from accounting_journals j where j.tenant_id=$1 and j.code='GEN'
    on conflict (tenant_id, code) do update set is_active=true`, [tenantId]);
  const bank = await pool.query(`insert into bank_accounts (tenant_id,bank_name,account_number) values ($1,'Banque vérif','BANQ-0098') returning id`, [tenantId]);
  return { tenantId, dr, cr, bnk, exp, rev, bankAccountId: bank.rows[0].id };
}

async function makeRecon(tenantId, bankAccountId, statementBalance) {
  const r = await pool.query(`insert into bank_reconciliations (tenant_id,bank_account_id,statement_date,statement_balance,reconciled_balance,status)
    values ($1,$2,'2098-12-20',$3,'0.00','draft') returning id`, [tenantId, bankAccountId, statementBalance]);
  return r.rows[0].id;
}

async function postPair(tenantId, drAccountId, crAccountId, amount, tag) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(`insert into journal_entries (tenant_id,entry_number,entry_date,description,source_module,status)
      values ($1, ('V-'||substr(md5(random()::text),1,14))::text, '2098-01-15', $2, 'accounting_verifier', 'posted') returning id`, [tenantId, tag]);
    const entryId = r.rows[0].id;
    await client.query(`insert into journal_entry_lines (tenant_id,journal_entry_id,account_id,debit_amount,credit_amount,memo) values
      ($1,$2,$3,$4,'0.00','debit'),($1,$2,$5,'0.00',$4,'credit')`, [tenantId, entryId, drAccountId, amount, crAccountId]);
    await client.query('COMMIT');
    const lines = (await pool.query(`select id, account_id, debit_amount, credit_amount from journal_entry_lines where tenant_id=$1 and journal_entry_id=$2 order by account_id`, [tenantId, entryId])).rows;
    return { entryId, drLine: lines.find(l => l.account_id === drAccountId), crLine: lines.find(l => l.account_id === crAccountId) };
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

async function lineCount(tenantId, reconciliationId) {
  const r = await pool.query(`select count(*)::int c from accounting_statement_lines where tenant_id=$1 and reconciliation_id=$2`, [tenantId, reconciliationId]);
  return r.rows[0].c;
}

async function reconStatus(tenantId, reconciliationId) {
  const r = await pool.query(`select status, reconciled_by_id, reconciled_at, reconciled_balance from bank_reconciliations where tenant_id=$1 and id=$2`, [tenantId, reconciliationId]);
  return r.rows[0];
}

const CSV_A1 = `date,description,reference,debit,credit
2098-01-10,Vente client 1,CH-001,,200.00
2098-01-11,Vente client 2,CH-002,,300.00
2098-01-12,Vente client 3,CH-003,,100.00
`;
const CSV_A2_ALT = `date,description,reference,debit,credit
2098-01-14,Prélèvement auto,PR-001,50.00,
2098-01-15,Virement reçu,VR-001,,50.00
`;
const CSV_MALFORMED_HEADER = `date,libelle,montant
2098-01-10,X,10.00
`;
const CSV_MALFORMED_AMOUNT = `date,description,debit,credit
2098-01-10,X,abc,
`;
const CSV_BOTH_SIDES = `date,description,debit,credit
2098-01-10,X,10.00,10.00
`;
const CSV_BAD_DATE = `date,description,debit,credit
2098-13-40,X,,10.00
`;
const CSV_OVERSIZED = `date,description,debit,credit\n` + `2098-01-10,X,1.00,\n`.repeat(100000);

loadLocalEnv();
const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos' });

async function main() {
  const svc = await import('../src/features/accounting/services/reconciliation-service');
  const { parseStatementCsv } = svc;

  console.log('--- PASS 1 (apply) ---');
  await applyFile('pass1');
  await inventory();
  console.log('\n--- PASS 2 (re-run, idempotency) ---');
  await applyFile('pass2');
  await inventory();

  console.log('\n--- CSV parser bounds ---');
  assert(parseStatementCsv(CSV_A1).length === 3, 'valid CSV parses to 3 statement rows');
  let threw = false; try { parseStatementCsv(CSV_MALFORMED_HEADER); } catch { threw = true; }
  assert(threw, 'missing required header column rejected');
  threw = false; try { parseStatementCsv(CSV_MALFORMED_AMOUNT); } catch { threw = true; }
  assert(threw, 'non-numeric amount rejected');
  threw = false; try { parseStatementCsv(CSV_BOTH_SIDES); } catch { threw = true; }
  assert(threw, 'both-sides row rejected (one-sided lines only)');
  threw = false; try { parseStatementCsv(CSV_BAD_DATE); } catch { threw = true; }
  assert(threw, 'invalid date rejected');
  threw = false; try { parseStatementCsv(CSV_OVERSIZED); } catch (e) { threw = e.code === 'IMPORT_TOO_LARGE'; }
  assert(threw, 'oversized CSV (>1 Mo) rejected');

  const A = await makeTenant('A');
  const B = await makeTenant('B');
  const { tenantId, dr, cr, bnk, exp, rev, bankAccountId } = A;

  console.log('\n--- Recon A1: import + match + balanced signed close ---');
  const a1 = await makeRecon(tenantId, bankAccountId, '600.00');
  const a1import = await svc.importStatementLines({ tenantId, userId: 'actor-a' }, a1, 'releve-janvier.csv', CSV_A1);
  assert(a1import.rowsImported === 3 && a1import.alreadyImported === false, 'first import records 3 statement lines');
  const e200a = await postPair(tenantId, dr, cr, '200.00', 'pair-200-a');
  const e300a = await postPair(tenantId, dr, cr, '300.00', 'pair-300-a');
  const e100a = await postPair(tenantId, dr, cr, '100.00', 'pair-100-a');
  const detail = await svc.getReconciliationDetail({ tenantId, userId: 'actor-a' }, a1);
  assert(detail.lines.length === 3 && detail.imports.length === 1 && detail.events.some(e => e.eventType === 'imported'), 'detail shows 3 lines, 1 import batch, imported event');

  const sl = detail.lines.slice();
  const m1 = await svc.matchStatementLine({ tenantId, userId: 'actor-a' }, a1, sl[0].id, e200a.drLine.id);
  assert(m1.lineStatus === 'matched' && m1.reconciledBalance === '200.00', `first match consumes the 200 line (${m1.lineStatus}/${m1.reconciledBalance})`);
  threw = false; try { await svc.matchStatementLine({ tenantId, userId: 'actor-a' }, a1, sl[0].id, e200a.crLine.id, '100.00'); } catch { threw = true; }
  assert(threw, 'over-matching an already-fully-matched statement line rejected');
  const m2 = await svc.matchStatementLine({ tenantId, userId: 'actor-a' }, a1, sl[1].id, e300a.drLine.id);
  const m3 = await svc.matchStatementLine({ tenantId, userId: 'actor-a' }, a1, sl[2].id, e100a.drLine.id);
  assert(m2.reconciledBalance === '500.00' && m3.reconciledBalance === '600.00', 'reconciled balance accumulates (500 -> 600)');

  const closed = await svc.closeReconciliation({ tenantId, userId: 'actor-a' }, a1);
  assert(closed.alreadyClosed === false && closed.reconciliation.status === 'completed', 'balanced signed close completes the reconciliation');
  const a1row = await reconStatus(tenantId, a1);
  assert(a1row.reconciled_by_id === 'actor-a' && a1row.reconciled_at !== null, 'close records reconciler and timestamp');
  const reclose = await svc.closeReconciliation({ tenantId, userId: 'actor-a' }, a1);
  assert(reclose.alreadyClosed === true, 're-close is idempotent');

  console.log('\n--- A1 immutability after close (DB triggers) ---');
  const block = async (label, fn) => { let b = false; try { await fn(); } catch { b = true; } assert(b, label); };
  await block('statement line INSERT after close rejected', () => pool.query(`insert into accounting_statement_lines (tenant_id,reconciliation_id,line_date,description,debit_amount,credit_amount,status)
    values ($1,$2,'2098-01-16','x','0.00','10.00','unmatched')`, [tenantId, a1]));
  await block('statement line UPDATE after close rejected', () => pool.query(`update accounting_statement_lines set description='tampered' where tenant_id=$1 and reconciliation_id=$2`, [tenantId, a1]));
  await block('statement line DELETE after close rejected', () => pool.query(`delete from accounting_statement_lines where tenant_id=$1 and reconciliation_id=$2`, [tenantId, a1]));
  await block('statement match INSERT after close rejected', () => pool.query(`insert into accounting_statement_matches (tenant_id,reconciliation_id,statement_line_id,journal_line_id,matched_amount,matched_by_id)
    values ($1,$2,$3,$4,'10.00','actor-x')`, [tenantId, a1, sl[0].id, e200a.crLine.id]));
  await block('statement match DELETE after close rejected', () => pool.query(`delete from accounting_statement_matches where tenant_id=$1 and reconciliation_id=$2`, [tenantId, a1]));
  await block('import batch INSERT after close rejected', () => pool.query(`insert into accounting_statement_imports (tenant_id,reconciliation_id,filename,content_fingerprint,rows_imported,imported_by_id)
    values ($1,$2,'x.csv','f'.repeat(64),1,'actor-x')`, [tenantId, a1]));
  await block('import batch DELETE after close rejected', () => pool.query(`delete from accounting_statement_imports where tenant_id=$1 and reconciliation_id=$2`, [tenantId, a1]));
  await block('reconciliation event UPDATE rejected (immutable)', () => pool.query(`update accounting_reconciliation_events set reason='tampered' where tenant_id=$1 and reconciliation_id=$2`, [tenantId, a1]));
  await block('reconciliation event DELETE rejected (immutable)', () => pool.query(`delete from accounting_reconciliation_events where tenant_id=$1 and reconciliation_id=$2`, [tenantId, a1]));

  console.log('\n--- Recon A2: replay-safe imports + malformed + variance ---');
  const a2 = await makeRecon(tenantId, bankAccountId, '800.00');
  const c1 = await svc.importStatementLines({ tenantId, userId: 'actor-a' }, a2, 'releve.csv', CSV_A1);
  assert(c1.rowsImported === 3, 'A2 first import 3 lines');
  const replay = await svc.importStatementLines({ tenantId, userId: 'actor-a' }, a2, 'releve-copie.csv', CSV_A1);
  assert(replay.alreadyImported === true && replay.rowsImported === 0, 'identical content re-import is replay-rejected (already imported)');
  assert(await lineCount(tenantId, a2) === 3, 'no duplicate statement lines after replay');
  const alt = await svc.importStatementLines({ tenantId, userId: 'actor-a' }, a2, 'releve-complement.csv', CSV_A2_ALT);
  assert(alt.rowsImported === 2 && await lineCount(tenantId, a2) === 5, 'different content import accepted (5 lines total)');
  const malformed = async (label, content) => { let err; try { await svc.importStatementLines({ tenantId, userId: 'actor-a' }, a2, 'bad.csv', content); } catch (e) { err = e; } assert(err && !err.code.startsWith('IMPORT_EMPTY'), label); };
  await malformed('malformed header import rejected', CSV_MALFORMED_HEADER);
  await malformed('malformed amount import rejected', CSV_MALFORMED_AMOUNT);
  let oversizedErr; try { await svc.importStatementLines({ tenantId, userId: 'actor-a' }, a2, 'huge.csv', CSV_OVERSIZED); } catch (e) { oversizedErr = e; }
  assert(oversizedErr && oversizedErr.code === 'IMPORT_TOO_LARGE', 'oversized import rejected (413 IMPORT_TOO_LARGE)');

  let closeBlocked = false; try { await svc.closeReconciliation({ tenantId, userId: 'actor-a' }, a2); } catch { closeBlocked = true; }
  assert(closeBlocked, 'close rejected while statement lines remain unmatched');
  const e200c = await postPair(tenantId, dr, cr, '200.00', 'pair-200-c');
  const e300c = await postPair(tenantId, dr, cr, '300.00', 'pair-300-c');
  const e100c = await postPair(tenantId, dr, cr, '100.00', 'pair-100-c');
  const e50d = await postPair(tenantId, dr, cr, '50.00', 'pair-50-d');
  const e50e = await postPair(tenantId, dr, cr, '50.00', 'pair-50-e');
  const a2lines = (await svc.getReconciliationDetail({ tenantId, userId: 'actor-a' }, a2)).lines;
  await svc.matchStatementLine({ tenantId, userId: 'actor-a' }, a2, a2lines[0].id, e200c.drLine.id);
  await svc.matchStatementLine({ tenantId, userId: 'actor-a' }, a2, a2lines[1].id, e300c.drLine.id);
  await svc.matchStatementLine({ tenantId, userId: 'actor-a' }, a2, a2lines[2].id, e100c.drLine.id);
  await svc.matchStatementLine({ tenantId, userId: 'actor-a' }, a2, a2lines[3].id, e50d.drLine.id);
  const m4 = await svc.matchStatementLine({ tenantId, userId: 'actor-a' }, a2, a2lines[4].id, e50e.drLine.id);
  assert(m4.reconciledBalance === '700.00', 'all A2 lines matched -> reconciled balance 700');
  let varianceErr; try { await svc.closeReconciliation({ tenantId, userId: 'actor-a' }, a2); } catch (e) { varianceErr = e; }
  assert(varianceErr && varianceErr.code === 'RECONCILIATION_VARIANCE', 'close with an unexplained variance rejected');
  const a2closed = await svc.closeReconciliation({ tenantId, userId: 'actor-a' }, a2, 'Agios et frais bancaires non encore passés');
  assert(a2closed.reconciliation.status === 'completed', 'close with an explicit variance reason succeeds');

  console.log('\n--- Recon A3: split ---');
  const a3 = await makeRecon(tenantId, bankAccountId, '500.00');
  await svc.importStatementLines({ tenantId, userId: 'actor-a' }, a3, 'split.csv', `date,description,reference,debit,credit\n2098-01-20,Vente à éclater,SP-001,500.00,\n`);
  const e200b = await postPair(tenantId, dr, cr, '200.00', 'pair-200-b');
  const e300b = await postPair(tenantId, dr, cr, '300.00', 'pair-300-b');
  const [sl3] = (await svc.getReconciliationDetail({ tenantId, userId: 'actor-a' }, a3)).lines;
  const split = await svc.splitStatementLine({ tenantId, userId: 'actor-a' }, a3, sl3.id, [
    { journalLineId: e200b.drLine.id, amount: '200.00' },
    { journalLineId: e300b.drLine.id, amount: '300.00' },
  ]);
  assert(split.lineStatus === 'matched' && split.reconciledBalance === '500.00', `500 statement line split onto 200+300 (${split.lineStatus}/${split.reconciledBalance})`);
  const a3events = (await svc.getReconciliationDetail({ tenantId, userId: 'actor-a' }, a3)).events.map(e => e.eventType);
  assert(a3events.includes('split'), 'split event recorded');
  const a3closed = await svc.closeReconciliation({ tenantId, userId: 'actor-a' }, a3);
  assert(a3closed.reconciliation.status === 'completed', 'split reconciliation closes balanced');

  console.log('\n--- Recon A4: merge ---');
  const a4 = await makeRecon(tenantId, bankAccountId, '200.00');
  await svc.importStatementLines({ tenantId, userId: 'actor-a' }, a4, 'merge.csv', `date,description,reference,debit,credit\n2098-01-21,Fr 1,MG-001,120.00,\n2098-01-22,Fr 2,MG-002,80.00,\n`);
  const e200d = await postPair(tenantId, dr, cr, '200.00', 'pair-200-d');
  const a4lines = (await svc.getReconciliationDetail({ tenantId, userId: 'actor-a' }, a4)).lines;
  const merge = await svc.mergeStatementLines({ tenantId, userId: 'actor-a' }, a4, [a4lines[0].id, a4lines[1].id], e200d.drLine.id);
  assert(merge.lines === 2 && merge.reconciledBalance === '200.00', '120+80 statement lines merged onto one 200 journal line');
  const a4events = (await svc.getReconciliationDetail({ tenantId, userId: 'actor-a' }, a4)).events.map(e => e.eventType);
  assert(a4events.includes('merged'), 'merge event recorded');
  const a4closed = await svc.closeReconciliation({ tenantId, userId: 'actor-a' }, a4);
  assert(a4closed.reconciliation.status === 'completed', 'merged reconciliation closes balanced');

  console.log('\n--- Recon A5: unmatch lifecycle ---');
  const a5 = await makeRecon(tenantId, bankAccountId, '200.00');
  await svc.importStatementLines({ tenantId, userId: 'actor-a' }, a5, 'unmatch.csv', `date,description,reference,debit,credit\n2098-01-23,Vente 1,UN-001,,200.00\n`);
  const e200f = await postPair(tenantId, dr, cr, '200.00', 'pair-200-f');
  const [sl5] = (await svc.getReconciliationDetail({ tenantId, userId: 'actor-a' }, a5)).lines;
  await svc.matchStatementLine({ tenantId, userId: 'actor-a' }, a5, sl5.id, e200f.drLine.id);
  const unmatch = await svc.unmatchStatementLine({ tenantId, userId: 'actor-a' }, a5, sl5.id, e200f.drLine.id);
  assert(unmatch.lineStatus === 'unmatched' && unmatch.reconciledBalance === '0.00', `unmatch reverts line to unmatched and resets balance (${unmatch.lineStatus}/${unmatch.reconciledBalance})`);
  const a5events = (await svc.getReconciliationDetail({ tenantId, userId: 'actor-a' }, a5)).events.map(e => e.eventType);
  assert(a5events.includes('unmatched'), 'unmatch event recorded');

  console.log('\n--- Recon A6: controlled fee/interest postings ---');
  const a6 = await makeRecon(tenantId, bankAccountId, '0.00');
  const fee = await svc.postReconciliationFeeOrInterest({ tenantId, userId: 'actor-a' }, a6, {
    kind: 'fee', amount: '25.00', bankAssetAccountId: bnk, offsetAccountId: exp,
    description: 'Frais de tenue de compte', entryDate: '2098-06-01',
    idempotencyKey: 'fee-0098-a-12345678', journalCode: 'GEN', voucherTypeCode: 'BNK-FEE',
  });
  assert(fee.eventType === 'fee_posted' && fee.journalEntryId, 'fee posts through the canonical service');
  const feeLines = (await pool.query(`select account_id, debit_amount, credit_amount from journal_entry_lines where tenant_id=$1 and journal_entry_id=$2 order by account_id`, [tenantId, fee.journalEntryId])).rows;
  assert(feeLines.some(l => l.account_id === exp && l.debit_amount === '25.00') && feeLines.some(l => l.account_id === bnk && l.credit_amount === '25.00'),
    'fee entry balanced (expense debit 25 / bank credit 25)');
  const feeReplay = await svc.postReconciliationFeeOrInterest({ tenantId, userId: 'actor-a' }, a6, {
    kind: 'fee', amount: '25.00', bankAssetAccountId: bnk, offsetAccountId: exp,
    description: 'Frais de tenue de compte', entryDate: '2098-06-01',
    idempotencyKey: 'fee-0098-a-12345678', journalCode: 'GEN', voucherTypeCode: 'BNK-FEE',
  });
  assert(feeReplay.idempotent === true && feeReplay.journalEntryId === fee.journalEntryId, 'fee posting is idempotent (same key -> same entry)');
  const interest = await svc.postReconciliationFeeOrInterest({ tenantId, userId: 'actor-a' }, a6, {
    kind: 'interest', amount: '15.00', bankAssetAccountId: bnk, offsetAccountId: rev,
    description: 'Intérêts créditeurs', entryDate: '2098-06-15',
    idempotencyKey: 'int-0098-a-12345678', journalCode: 'GEN', voucherTypeCode: 'BNK-FEE',
  });
  assert(interest.eventType === 'interest_posted', 'interest posts through the canonical service');
  const intLines = (await pool.query(`select account_id, debit_amount, credit_amount from journal_entry_lines where tenant_id=$1 and journal_entry_id=$2 order by account_id`, [tenantId, interest.journalEntryId])).rows;
  assert(intLines.some(l => l.account_id === bnk && l.debit_amount === '15.00') && intLines.some(l => l.account_id === rev && l.credit_amount === '15.00'),
    'interest entry balanced (bank debit 15 / revenue credit 15)');
  let badOffset; try { await svc.postReconciliationFeeOrInterest({ tenantId, userId: 'actor-a' }, a6, {
    kind: 'fee', amount: '5.00', bankAssetAccountId: bnk, offsetAccountId: rev,
    description: 'mauvais compte', entryDate: '2098-06-20', idempotencyKey: 'fee-0098-bad-123456', journalCode: 'GEN', voucherTypeCode: 'BNK-FEE',
  }); } catch (e) { badOffset = e; }
  assert(badOffset && badOffset.code === 'INVALID_OFFSET_ACCOUNT_TYPE', 'fee on a revenue account rejected (controlled offset types)');
  const a6events = (await svc.getReconciliationDetail({ tenantId, userId: 'actor-a' }, a6)).events.map(e => e.eventType);
  assert(a6events.includes('fee_posted') && a6events.includes('interest_posted'), 'fee + interest events recorded');

  console.log('\n--- two-tenant isolation ---');
  const bRecon = await makeRecon(B.tenantId, B.bankAccountId, '100.00');
  let cross; try { await svc.getReconciliationDetail({ tenantId, userId: 'actor-a' }, bRecon); } catch (e) { cross = e; }
  assert(cross && cross.code === 'RECONCILIATION_NOT_FOUND', 'tenant A cannot read tenant B reconciliation');
  cross = null; try { await svc.importStatementLines({ tenantId, userId: 'actor-a' }, bRecon, 'x.csv', CSV_A1); } catch (e) { cross = e; }
  assert(cross && cross.code === 'RECONCILIATION_NOT_FOUND', 'tenant A cannot import into tenant B reconciliation');
  cross = null; try { await svc.closeReconciliation({ tenantId, userId: 'actor-a' }, bRecon); } catch (e) { cross = e; }
  assert(cross && cross.code === 'RECONCILIATION_NOT_FOUND', 'tenant A cannot close tenant B reconciliation');
  const bLine = await svc.importStatementLines({ tenantId: B.tenantId, userId: 'actor-b' }, bRecon, 'b.csv', `date,description,reference,debit,credit\n2098-01-10,Vente B,CH-B,,100.00\n`);
  assert(bLine.rowsImported === 1, 'tenant B imports its own statement line');
  const bPair = await postPair(B.tenantId, B.dr, B.cr, '100.00', 'pair-B');
  cross = null; try { await svc.matchStatementLine({ tenantId, userId: 'actor-a' }, bRecon, (await svc.getReconciliationDetail({ tenantId: B.tenantId, userId: 'actor-b' }, bRecon)).lines[0].id, bPair.drLine.id); } catch (e) { cross = e; }
  assert(cross && cross.code === 'RECONCILIATION_NOT_FOUND', 'tenant A cannot match against tenant B reconciliation');

  console.log(failed ? '\nVERDICT: FAILED' : '\nVERDICT: PASS (reconciliation import/lifecycle/close hardened, replay-safe, tenant-safe)');
  await pool.end();
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => { console.error('FATAL', e); await pool.end(); process.exit(1); });
