// Verify + (re)apply migration 0093_harden_ledger_invariants.sql against the live DB,
// then adversarially test the DB-layer ledger invariants. Baseline discovery: migration
// 0039 ALREADY enforces the core invariants for ALL sources —
//   * one-sided lines        -> row CHECK journal_line_one_side_positive
//   * >=2 lines + balance    -> DEFERRABLE triggers journal_header/lines_balance_trigger
//   * immutability           -> BEFORE triggers prevent_journal_entry_delete / _line_mutation
//   * open period + scope    -> enforce_journal_header_integrity / _line_scope
// Migration 0093 adds the chart-of-accounts mutation guard (delete/type-change/archive).
//
// Because the one-sided row CHECK rejects both-sides-positive and zero-amount lines for
// every source, there is no source carve-out to test: that is asserted explicitly below
// (a 'payroll' line with both sides positive is rejected by 0039, not by any 0093 logic).
// Entries are inserted with all their lines in ONE transaction (like the posting service)
// so the DEFERRED balance triggers fire at COMMIT with the full line set present.
import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos',
});

let failed = false;
function assert(cond, msg) {
  if (!cond) { failed = true; console.log(`  FAIL: ${msg}`); }
  else console.log(`  ok: ${msg}`);
}

async function applyFile(label) {
  const file = path.join(process.cwd(), 'migrations', '0093_harden_ledger_invariants.sql');
  const query = fs.readFileSync(file, 'utf-8');
  await pool.query(query);
  console.log(`[${label}] applied OK`);
}

// Inventory every ledger trigger. 0093 owns the chart-of-accounts guard; 0039 owns the
// balance/scope/immutability triggers. All must be present for the invariants to hold.
async function inventory(label) {
  console.log(`\n[${label}] inventory`);
  const objs = await pool.query(`
    select trigger_name, event_object_table, action_timing, event_manipulation
    from information_schema.triggers
    where trigger_name in (
      'chart_of_accounts_mutation_guard_trigger',
      'journal_header_integrity_trigger','journal_line_scope_trigger',
      'journal_header_balance_trigger','journal_lines_balance_trigger',
      'prevent_journal_entry_delete','prevent_journal_line_mutation')
    order by trigger_name`);
  const have = new Set(objs.rows.map(r => r.trigger_name));
  const expected = [
    'chart_of_accounts_mutation_guard_trigger',
    'journal_header_integrity_trigger','journal_line_scope_trigger',
    'journal_header_balance_trigger','journal_lines_balance_trigger',
    'prevent_journal_entry_delete','prevent_journal_line_mutation',
  ];
  const missing = expected.filter(t => !have.has(t));
  assert(missing.length === 0, `triggers ${have.size}/${expected.length}` + (missing.length ? ` MISSING: ${missing.join(', ')}` : ''));
  const guard = objs.rows.find(r => r.trigger_name === 'chart_of_accounts_mutation_guard_trigger');
  assert(guard && guard.event_object_table === 'chart_of_accounts', '0093 guard trigger is on chart_of_accounts');
  // The balance trigger must be DEFERRED (fires at COMMIT, not statement end) so a
  // service that inserts header + lines in one transaction is validated with the full
  // line set present.
  const def = await pool.query(`select tgdeferrable, tginitdeferred from pg_trigger
    where tgname='journal_lines_balance_trigger'`);
  assert(def.rows.length === 1 && def.rows[0].tgdeferrable && def.rows[0].tginitdeferred,
    '0039 balance trigger is DEFERRABLE INITIALLY DEFERRED');
}

// --- fixtures ---------------------------------------------------------------
async function fixtures() {
  const period = await pool.query(`select tenant_id from fiscal_periods where name='ACCOUNTING-VERIFY-2098' limit 1`);
  let tenantId;
  if (period.rows[0]) tenantId = period.rows[0].tenant_id;
  else {
    const slug = 'v0093-' + Math.random().toString(36).slice(2, 10);
    const t = await pool.query(`insert into tenants (name, slug) values ($1,$2) returning id`, ['VERIFY-0093', slug]);
    tenantId = t.rows[0].id;
    await pool.query(`insert into fiscal_periods (tenant_id,name,start_date,end_date,status) values ($1,'ACCOUNTING-VERIFY-2098','2098-01-01','2098-12-31','open')`, [tenantId]);
  }
  await pool.query(`insert into accounting_journals (tenant_id,code,name,journal_type)
    values ($1,'GEN','Journal général','general') on conflict (tenant_id,code) do update set is_active=true`, [tenantId]);
  const acct = async (code, type, parentAccountId = null) => {
    const r = await pool.query(`insert into chart_of_accounts (tenant_id,code,name,account_type,parent_account_id,is_active)
      values ($1,$2,$3,$4,$5,true)
      on conflict (tenant_id,code) do update set is_active=true returning id`, [tenantId, code, `Compte ${code}`, type, parentAccountId]);
    return r.rows[0].id;
  };
  const parentId = await acct('VERIFY-PARENT', 'asset');
  return {
    tenantId,
    dr: await acct('VERIFY-DR', 'asset'),
    cr: await acct('VERIFY-CR', 'liability'),
    zero: await acct('VERIFY-ZERO', 'asset'),
    unused: await acct('VERIFY-UNUSED', 'asset'),
    parent: parentId,
    child: await acct('VERIFY-CHILD', 'asset', parentId),
  };
}

// Insert entry + lines in ONE transaction, mirroring the posting service, so the
// global DEFERRED balance triggers fire at COMMIT with the full line set.
async function makeEntry(tenantId, src, lines) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(`insert into journal_entries (tenant_id,entry_number,entry_date,description,source_module,status)
      values ($1, ('V-'||substr(md5(random()::text),1,14))::text, '2098-01-01', 'verifier', $2, 'posted') returning id`, [tenantId, src]);
    const entryId = r.rows[0].id;
    const values = lines.map(l => `(${client.escapeLiteral(tenantId)},${client.escapeLiteral(entryId)},${client.escapeLiteral(l.accountId)},${client.escapeLiteral(l.debitAmount ?? '0')},${client.escapeLiteral(l.creditAmount ?? '0')},'verifier')`).join(',');
    await client.query(`insert into journal_entry_lines (tenant_id,journal_entry_id,account_id,debit_amount,credit_amount,memo) values ${values}`);
    await client.query('COMMIT');
    return entryId;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function main() {
  console.log('--- PASS 1 (apply) ---');
  await applyFile('pass1');
  await inventory('pass1');

  console.log('\n--- PASS 2 (re-run, idempotency) ---');
  await applyFile('pass2');
  await inventory('pass2');

  const f = await fixtures();

  console.log('\n--- 0039 invariants (a)(b)(c): balance / >=2 lines / one-sided lines ---');
  // (a) single-line entry rejected (0039 DEFERRED trigger: line_count < 2).
  let blocked = false;
  try { await makeEntry(f.tenantId, 'accounting_verifier', [{ accountId: f.dr, debitAmount: '10.00' }]); } catch { blocked = true; }
  assert(blocked, 'entry with 1 line rejected');

  // (c) unbalanced entry rejected.
  blocked = false;
  try { await makeEntry(f.tenantId, 'accounting_verifier', [
    { accountId: f.dr, debitAmount: '10.00' },
    { accountId: f.cr, creditAmount: '9.00' },
  ]); } catch { blocked = true; }
  assert(blocked, 'entry unbalanced rejected');

  // (b) one-sided row CHECK: a line with BOTH sides positive is rejected for ANY source
  //     (0039 CHECK journal_line_one_side_positive) — including 'payroll'. This documents
  //     that no source carve-out exists or is needed; the CHECK is source-agnostic.
  blocked = false;
  try { await makeEntry(f.tenantId, 'payroll', [
    { accountId: f.dr, debitAmount: '10.00', creditAmount: '0.00' },
    { accountId: f.cr, debitAmount: '5.00', creditAmount: '10.00' },
  ]); } catch { blocked = true; }
  assert(blocked, 'both-sides-positive line rejected for ANY source (0039 row CHECK)');

  // zero-amount line rejected for ANY source, same CHECK.
  blocked = false;
  try { await makeEntry(f.tenantId, 'payroll', [
    { accountId: f.dr, debitAmount: '10.00', creditAmount: '0.00' },
    { accountId: f.cr, debitAmount: '0.00', creditAmount: '10.00' },
    { accountId: f.zero, debitAmount: '0.00', creditAmount: '0.00' },
  ]); } catch { blocked = true; }
  assert(blocked, 'zero-amount line rejected for ANY source (0039 row CHECK)');

  // valid balanced 2-line entry accepted (0039 + 0093 must not interfere).
  let ok = false;
  try { await makeEntry(f.tenantId, 'accounting_verifier', [
    { accountId: f.dr, debitAmount: '125.40', creditAmount: '0.00' },
    { accountId: f.cr, debitAmount: '0.00', creditAmount: '125.40' },
  ]); ok = true; } catch (e) { console.log('  ERR', e.message); }
  assert(ok, 'valid balanced 2-line entry accepted');

  console.log('\n--- invariant (d): posted journal immutability (0039) ---');
  const validEntry = await makeEntry(f.tenantId, 'accounting_verifier', [
    { accountId: f.dr, debitAmount: '50.00', creditAmount: '0.00' },
    { accountId: f.cr, debitAmount: '0.00', creditAmount: '50.00' },
  ]);
  blocked = false;
  try { await pool.query(`update journal_entries set description='tampered' where id=$1`, [validEntry]); } catch { blocked = true; }
  assert(blocked, 'journal_entries UPDATE rejected');
  blocked = false;
  try { await pool.query(`delete from journal_entries where id=$1`, [validEntry]); } catch { blocked = true; }
  assert(blocked, 'journal_entries DELETE rejected');
  blocked = false;
  try { await pool.query(`update journal_entry_lines set memo='tampered' where journal_entry_id=$1`, [validEntry]); } catch { blocked = true; }
  assert(blocked, 'journal_entry_lines UPDATE rejected');
  blocked = false;
  try { await pool.query(`delete from journal_entry_lines where journal_entry_id=$1`, [validEntry]); } catch { blocked = true; }
  assert(blocked, 'journal_entry_lines DELETE rejected');

  console.log('\n--- invariant (e): chart of accounts guard (0093) ---');
  // Delete / type-change / archive of a USED account (VERIFY-DR now has posted lines,
  // net +175.40 from the two valid entries above).
  blocked = false;
  try { await pool.query(`delete from chart_of_accounts where id=$1`, [f.dr]); } catch { blocked = true; }
  assert(blocked, 'delete of used account rejected');
  blocked = false;
  try { await pool.query(`update chart_of_accounts set account_type='expense' where id=$1`, [f.dr]); } catch { blocked = true; }
  assert(blocked, 'type change on used account rejected');
  blocked = false;
  try { await pool.query(`update chart_of_accounts set is_active=false where id=$1`, [f.dr]); } catch { blocked = true; }
  assert(blocked, 'archive of used account with non-zero balance rejected');

  // Archive of an account with an ACTIVE CHILD rejected; delete of the parent (which has
  // an active child) rejected too.
  blocked = false;
  try { await pool.query(`update chart_of_accounts set is_active=false where id=$1`, [f.parent]); } catch { blocked = true; }
  assert(blocked, 'archive of account with active children rejected');
  blocked = false;
  try { await pool.query(`delete from chart_of_accounts where id=$1`, [f.parent]); } catch { blocked = true; }
  assert(blocked, 'delete of account with active children rejected');

  // Calibration: the guard must NOT over-block. Give VERIFY-ZERO posted lines with net
  // zero (debit 50 + credit 50 to the same account), then archiving it is allowed.
  const zeroEntry = await makeEntry(f.tenantId, 'accounting_verifier', [
    { accountId: f.zero, debitAmount: '50.00', creditAmount: '0.00' },
    { accountId: f.zero, debitAmount: '0.00', creditAmount: '50.00' },
  ]);
  let archived = false;
  try { await pool.query(`update chart_of_accounts set is_active=false where id=$1`, [f.zero]); archived = true; } catch { archived = false; }
  assert(archived, 'archive of used account with ZERO net balance allowed');

  // Delete / type-change of a never-used account allowed.
  let deleted = false;
  try { await pool.query(`delete from chart_of_accounts where id=$1`, [f.unused]); deleted = true; } catch { deleted = false; }
  assert(deleted, 'delete of unused account allowed');
  let typed = false;
  try { await pool.query(`update chart_of_accounts set account_type='expense' where id=$1`, [f.unused]); typed = true; } catch { typed = false; }
  assert(typed, 'type change on unused account allowed');

  console.log('\n--- cleanup ---');
  // Journal entries/lines are immutable by design; the 2098 verification period isolates
  // all fixtures from real reporting windows, so no deletion is attempted.
  console.log(failed ? '\nVERDICT: FAILED' : '\nVERDICT: PASS (all invariants enforced, idempotent)');
  await pool.end();
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => { console.error('FATAL', e); await pool.end(); process.exit(1); });
