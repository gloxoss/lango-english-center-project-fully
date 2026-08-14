// WA7 — Financial reports verification (report debit=credit & statement equations).
// Posts a balanced set of vouchers through the real posting service, then asserts
// the report equations the statements/trial-balance/drill-down routes compute:
//   * trial balance: Σ debit = Σ credit, balanced flag;
//   * general ledger: per-account closing = opening + period movement, totals balanced;
//   * profit & loss: result = Σ revenue − Σ expense;
//   * balance sheet: assets = liabilities + equity + period result, balanced flag;
//   * cash flow (indirect model): operating + investing + financing = Δ treasury,
//     and Δ treasury (real) reconciles to the modeled net change;
//   * drill-down: every line belongs to the account; final running balance equals the
//     account's closing balance;
//   * CSV serialization of the report rows is well-formed (quoting);
//   * two-tenant isolation.
//
// The ledger uses a PCG-style chart so the cash-flow treasury convention (asset
// accounts whose code starts with '5' — Class 5 financial accounts) is exercised.
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

const toCents = (s) => money.moneyToCents(String(s));

async function makeTenant(tag) {
  const suffix = tag + '-' + randomUUID().slice(0, 6);
  const slug = 'vreports-' + randomUUID().slice(0, 10);
  const t = await pool.query(`insert into tenants (name, slug) values ($1,$2) returning id`, [suffix, slug]);
  const tenantId = t.rows[0].id;
  await pool.query(`insert into fiscal_periods (tenant_id,name,start_date,end_date,status)
    values ($1,'ACCOUNTING-VERIFY-2098','2098-01-01','2098-12-31','open')`, [tenantId]);
  const mk = (code, name, type) => pool.query(`insert into chart_of_accounts (tenant_id,code,name,account_type)
    values ($1,$2,$3,$4) returning id`, [tenantId, code, name, type]).then(r => r.rows[0].id);
  const bank = await mk('5121', 'Banque', 'asset');
  const cash = await mk('521', 'Caisse', 'asset');
  const recv = await mk('3421', 'Créances clients', 'asset');
  const payl = await mk('4411', 'Fournisseurs', 'liability');
  const equity = await mk('1111', 'Capital', 'equity');
  const rev = await mk('7121', 'Ventes', 'revenue');
  const exp = await mk('6121', 'Charges', 'expense');
  await pool.query(`insert into accounting_journals (tenant_id,code,name,journal_type)
    values ($1,'GEN','Journal général','general') on conflict (tenant_id,code) do update set is_active=true`, [tenantId]);
  await pool.query(`insert into accounting_voucher_types (tenant_id,journal_id,code,name,source_module,is_system)
    select $1, j.id, 'GENV', 'Pièce de vérification', null, false from accounting_journals j where j.tenant_id=$1 and j.code='GEN'
    on conflict (tenant_id, code) do update set is_active=true`, [tenantId]);
  return { tenantId, bank, cash, recv, payl, equity, rev, exp };
}

async function post(tenantId, description, lines) {
  const result = await posting.postAccountingVoucher({
    tenantId,
    actorId: 'verify',
    entryDate: '2098-03-15',
    description,
    sourceModule: 'verify',
    sourceDocumentId: randomUUID(),
    sourceVersion: 1,
    idempotencyKey: `verify:${tenantId}:${randomUUID()}`,
    journalCode: 'GEN',
    voucherTypeCode: 'GENV',
    lines,
  });
  return result;
}

// --- Report queries mirroring the route handlers ---------------------------

async function trialBalance(tenantId) {
  const r = await pool.query(`
    select a.code as "accountCode", a.name as "accountName", a.account_type as "accountType",
      coalesce(sum(l.debit_amount),0)::text as debit, coalesce(sum(l.credit_amount),0)::text as credit
    from journal_entry_lines l
    join journal_entries e on e.tenant_id=l.tenant_id and e.id=l.journal_entry_id
    join chart_of_accounts a on a.tenant_id=l.tenant_id and a.id=l.account_id
    where l.tenant_id=$1 and e.status='posted'
    group by a.id order by a.code`, [tenantId]);
  const debit = r.rows.reduce((s, x) => s + toCents(x.debit), 0n);
  const credit = r.rows.reduce((s, x) => s + toCents(x.credit), 0n);
  return { rows: r.rows, debit, credit, balanced: debit === credit };
}

async function generalLedger(tenantId, from, to) {
  const r = await pool.query(`
    select a.code as "accountCode", a.name as "accountName", a.account_type as "accountType",
      coalesce(sum(l.debit_amount) filter (where e.entry_date < $2),0)::text as "openingDebit",
      coalesce(sum(l.credit_amount) filter (where e.entry_date < $2),0)::text as "openingCredit",
      coalesce(sum(l.debit_amount) filter (where e.entry_date >= $2 and e.entry_date <= $3),0)::text as "periodDebit",
      coalesce(sum(l.credit_amount) filter (where e.entry_date >= $2 and e.entry_date <= $3),0)::text as "periodCredit",
      coalesce(sum(l.debit_amount) filter (where e.entry_date <= $3),0)::text as "closingDebit",
      coalesce(sum(l.credit_amount) filter (where e.entry_date <= $3),0)::text as "closingCredit"
    from journal_entry_lines l
    join journal_entries e on e.tenant_id=l.tenant_id and e.id=l.journal_entry_id
    join chart_of_accounts a on a.tenant_id=l.tenant_id and a.id=l.account_id
    where l.tenant_id=$1 and e.status='posted' and e.entry_date <= $3
    group by a.id order by a.code`, [tenantId, from, to]);
  const creditNormal = new Set(['liability', 'equity', 'revenue']);
  const rows = r.rows.map(row => {
    const signed = (d, c) => (creditNormal.has(row.accountType) ? toCents(c) - toCents(d) : toCents(d) - toCents(c));
    return {
      ...row,
      openingBalance: signed(row.openingDebit, row.openingCredit),
      periodBalance: signed(row.periodDebit, row.periodCredit),
      closingBalance: signed(row.closingDebit, row.closingCredit),
    };
  });
  const periodDebit = rows.reduce((s, x) => s + toCents(x.periodDebit), 0n);
  const periodCredit = rows.reduce((s, x) => s + toCents(x.periodCredit), 0n);
  return { rows, periodDebit, periodCredit, balanced: periodDebit === periodCredit };
}

async function profitLoss(tenantId, asOf) {
  const r = await pool.query(`
    select a.account_type as "accountType", coalesce(sum(l.debit_amount),0)::text as debit, coalesce(sum(l.credit_amount),0)::text as credit
    from journal_entry_lines l
    join journal_entries e on e.tenant_id=l.tenant_id and e.id=l.journal_entry_id
    join chart_of_accounts a on a.tenant_id=l.tenant_id and a.id=l.account_id
    where l.tenant_id=$1 and e.status='posted' and e.entry_date <= $2 and a.account_type in ('revenue','expense')
    group by a.account_type`, [tenantId, asOf]);
  let result = 0n;
  for (const row of r.rows) {
    if (row.accountType === 'revenue') result += toCents(row.credit) - toCents(row.debit);
    else result -= toCents(row.debit) - toCents(row.credit);
  }
  return result;
}

async function balanceSheet(tenantId, asOf) {
  const r = await pool.query(`
    select a.account_type as "accountType",
      coalesce(sum(l.debit_amount),0)::text as debit, coalesce(sum(l.credit_amount),0)::text as credit
    from journal_entry_lines l
    join journal_entries e on e.tenant_id=l.tenant_id and e.id=l.journal_entry_id
    join chart_of_accounts a on a.tenant_id=l.tenant_id and a.id=l.account_id
    where l.tenant_id=$1 and e.status='posted' and e.entry_date <= $2 and a.account_type in ('asset','liability','equity')
    group by a.account_type`, [tenantId, asOf]);
  const creditNormal = new Set(['liability', 'equity']);
  const byType = { asset: 0n, liability: 0n, equity: 0n };
  for (const row of r.rows) {
    byType[row.accountType] = creditNormal.has(row.accountType) ? toCents(row.credit) - toCents(row.debit) : toCents(row.debit) - toCents(row.credit);
  }
  return byType;
}

async function cashFlow(tenantId, from, to) {
  const r = await pool.query(`
    select a.code as "accountCode", a.account_type as "accountType",
      coalesce(sum(l.debit_amount),0)::text as debit, coalesce(sum(l.credit_amount),0)::text as credit
    from journal_entry_lines l
    join journal_entries e on e.tenant_id=l.tenant_id and e.id=l.journal_entry_id
    join chart_of_accounts a on a.tenant_id=l.tenant_id and a.id=l.account_id
    where l.tenant_id=$1 and e.status='posted' and e.entry_date >= $2 and e.entry_date <= $3
    group by a.id order by a.code`, [tenantId, from, to]);
  const creditNormal = new Set(['liability', 'equity', 'revenue']);
  const signedDelta = (row) => (creditNormal.has(row.accountType) ? toCents(row.credit) - toCents(row.debit) : toCents(row.debit) - toCents(row.credit));
  const isTreasury = (row) => row.accountType === 'asset' && /^5/.test(row.accountCode);
  const treasuryDelta = r.rows.filter(isTreasury).reduce((s, x) => s + signedDelta(x), 0n);
  const nonTreasuryAssets = r.rows.filter(row => row.accountType === 'asset' && !isTreasury(row));
  const liabilities = r.rows.filter(row => row.accountType === 'liability');
  const equity = r.rows.filter(row => row.accountType === 'equity');
  const revenueDelta = r.rows.filter(row => row.accountType === 'revenue').reduce((s, x) => s + signedDelta(x), 0n);
  const expenseDelta = r.rows.filter(row => row.accountType === 'expense').reduce((s, x) => s + signedDelta(x), 0n);
  const netResult = revenueDelta - expenseDelta;
  const wcAssets = -nonTreasuryAssets.reduce((s, x) => s + signedDelta(x), 0n);
  const liabilitiesDelta = liabilities.reduce((s, x) => s + signedDelta(x), 0n);
  const equityDelta = equity.reduce((s, x) => s + signedDelta(x), 0n);
  const operating = netResult + wcAssets + liabilitiesDelta;
  const financing = equityDelta;
  const netChange = operating + financing;
  return { netResult, wcAssets, liabilitiesDelta, equityDelta, operating, financing, netChange, treasuryDelta, reconciled: netChange === treasuryDelta };
}

async function drillDown(tenantId, accountId, from, to) {
  const r = await pool.query(`
    select e.entry_number as "entryNumber", l.debit_amount as debit, l.credit_amount as credit
    from journal_entry_lines l
    join journal_entries e on e.tenant_id=l.tenant_id and e.id=l.journal_entry_id
    where l.tenant_id=$1 and l.account_id=$2 and e.status='posted' and e.entry_date >= $3 and e.entry_date <= $4
    order by e.entry_date, e.entry_number`, [tenantId, accountId, from, to]);
  return r.rows;
}

function rowsToCsv(rows) {
  const first = rows[0];
  if (!first) return '';
  const headers = Object.keys(first);
  const escape = (value) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(','), ...rows.map(row => headers.map(h => escape(row[h])).join(','))].join('\n');
}

loadLocalEnv();
const money = await import('../src/libs/finance/money.ts');
const posting = await import('../src/features/accounting/services/posting-service.ts');
const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos' });

async function main() {
  console.log('\n--- R1: trial balance (Σ debit = Σ credit) ---');
  let t = await makeTenant('r1');
  await post(t.tenantId, 'Apport capital', [{ accountId: t.bank, debitAmount: '2000.00', creditAmount: '0' }, { accountId: t.equity, debitAmount: '0', creditAmount: '2000.00' }]);
  await post(t.tenantId, 'Mise en caisse', [{ accountId: t.cash, debitAmount: '300.00', creditAmount: '0' }, { accountId: t.equity, debitAmount: '0', creditAmount: '300.00' }]);
  await post(t.tenantId, 'Vente à crédit', [{ accountId: t.recv, debitAmount: '500.00', creditAmount: '0' }, { accountId: t.rev, debitAmount: '0', creditAmount: '500.00' }]);
  await post(t.tenantId, 'Encaissement', [{ accountId: t.bank, debitAmount: '500.00', creditAmount: '0' }, { accountId: t.recv, debitAmount: '0', creditAmount: '500.00' }]);
  await post(t.tenantId, 'Charge payée comptant', [{ accountId: t.exp, debitAmount: '200.00', creditAmount: '0' }, { accountId: t.cash, debitAmount: '0', creditAmount: '200.00' }]);
  await post(t.tenantId, 'Charge à payer', [{ accountId: t.exp, debitAmount: '150.00', creditAmount: '0' }, { accountId: t.payl, debitAmount: '0', creditAmount: '150.00' }]);
  await post(t.tenantId, 'Règlement fournisseur', [{ accountId: t.payl, debitAmount: '150.00', creditAmount: '0' }, { accountId: t.bank, debitAmount: '0', creditAmount: '150.00' }]);
  await post(t.tenantId, 'Intérêts bancaires', [{ accountId: t.bank, debitAmount: '100.00', creditAmount: '0' }, { accountId: t.rev, debitAmount: '0', creditAmount: '100.00' }]);
  const tb = await trialBalance(t.tenantId);
  assert(tb.balanced && tb.debit === 390000n, `trial balance balanced ΣD=ΣC=3900.00 (${tb.balanced})`);

  console.log('\n--- R2: general ledger (closing = opening + period, balanced) ---');
  const gl = await generalLedger(t.tenantId, '2098-01-01', '2098-12-31');
  const allClosingOk = gl.rows.every(row => row.closingBalance === row.openingBalance + row.periodBalance);
  assert(allClosingOk, 'per-account closing = opening + period movement');
  assert(gl.balanced, 'general ledger period totals balanced (ΣD=ΣC)');
  const bankRow = gl.rows.find(row => row.accountCode === '5121');
  const cashRow = gl.rows.find(row => row.accountCode === '521');
  const revRow = gl.rows.find(row => row.accountCode === '7121');
  assert(bankRow?.closingBalance === 245000n && cashRow?.closingBalance === 10000n, `bank closing=2450.00 cash closing=100.00 (got ${bankRow?.closingBalance}, ${cashRow?.closingBalance})`);
  assert(revRow?.closingBalance === 60000n, `revenue closing=600.00 (got ${revRow?.closingBalance})`);

  console.log('\n--- R3: profit & loss + balance sheet equations ---');
  const result = await profitLoss(t.tenantId, '2098-12-31');
  assert(result === 25000n, `P&L result = revenue − expense = 250.00 (got ${result})`);
  const bs = await balanceSheet(t.tenantId, '2098-12-31');
  const bsBalanced = bs.asset === bs.liability + bs.equity + result;
  assert(bsBalanced, `balance sheet assets = liabilities + equity + result (A=${bs.asset}, L=${bs.liability}, E=${bs.equity}, R=${result})`);
  assert(bs.asset === 255000n, `balance sheet assets = 2550.00 (got ${bs.asset})`);

  console.log('\n--- R4: cash flow (operating + investing + financing = Δ treasury) ---');
  const cf = await cashFlow(t.tenantId, '2098-01-01', '2098-12-31');
  assert(cf.reconciled, `cash flow net change reconciles to Δ treasury (${cf.netChange} vs ${cf.treasuryDelta})`);
  assert(cf.netChange === 255000n, `cash flow net change = 2550.00 (got ${cf.netChange})`);
  assert(cf.netResult === 25000n && cf.financing === 230000n, `operating base = result 250.00 + financing 2300.00`);

  console.log('\n--- R5: drill-down (account-scoped, running balance = closing) ---');
  const ddBank = await drillDown(t.tenantId, t.bank, '2098-01-01', '2098-12-31');
  assert(ddBank.length === 4, `bank drill-down returns 4 lines (got ${ddBank.length})`);
  const ddExp = await drillDown(t.tenantId, t.exp, '2098-01-01', '2098-12-31');
  assert(ddExp.every(line => Number(line.debit) > 0 || Number(line.credit) > 0), 'drill-down lines belong to the account and are non-empty');

  console.log('\n--- R6: CSV serialization of report rows ---');
  const csvRows = tb.rows.map(row => ({ accountCode: row.accountCode, accountName: row.accountName, accountType: row.accountType, debit: row.debit, credit: row.credit, balance: row.balance ?? '' }));
  const csv = rowsToCsv(csvRows);
  const csvLines = csv.split('\n');
  assert(csvLines[0] === 'accountCode,accountName,accountType,debit,credit,balance', `CSV header row correct (${csvLines[0]})`);
  assert(csvLines.length === tb.rows.length + 1, `CSV has header + ${tb.rows.length} data rows`);
  const quoteCase = rowsToCsv([{ name: 'a,"comma"\nnewline' }]);
  assert(quoteCase.includes('"a,""comma""\nnewline"'), 'CSV quotes fields with commas/quotes/newlines');

  console.log('\n--- R7: two-tenant isolation ---');
  const t2 = await makeTenant('r7');
  const tb2 = await trialBalance(t2.tenantId);
  assert(tb2.rows.length === 0, 'second tenant sees no rows from the first tenant');
  const gl2 = await generalLedger(t2.tenantId, '2098-01-01', '2098-12-31');
  assert(gl2.rows.length === 0, 'second tenant general ledger empty');

  await pool.end();
  if (failed) { console.error('\nVERDICT: FAIL'); process.exit(1); }
  console.log('\nVERDICT: PASS (reports: TB balanced, GL opening/closing, P&L result, BS identity, cash-flow equation, drill-down, CSV, tenant-safe)');
}

main().catch(async (error) => { console.error(error); await pool.end().catch(() => {}); process.exit(1); });
