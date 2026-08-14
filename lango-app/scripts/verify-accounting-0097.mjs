// Verify + (re)apply migration 0097_accounting_period_close_reopen.sql against the
// live DB, then exercise the period-service close/reopen workflow end to end:
//   * close writes an immutable ledger snapshot (run + balances) + 'closed' event;
//   * blockers (pending approved documents, draft reconciliations) reject close;
//   * close is idempotent for an already-closed period;
//   * reopen is a two-step maker-checker flow (request -> approve/reject by a
//     different actor); approval reopens AND supersedes the snapshot;
//   * closing runs, balances and period events are immutable (except supersede);
//   * every close/request/decision is recorded in the immutable event log;
//   * all reads/decisions are tenant-scoped (two-tenant check).
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
  const file = path.join(process.cwd(), 'migrations', '0097_accounting_period_close_reopen.sql');
  await pool.query(fs.readFileSync(file, 'utf-8'));
  console.log(`[${label}] applied OK`);
}

async function inventory() {
  const tables = await pool.query(`select table_name from information_schema.tables
    where table_schema='public' and table_name in ('accounting_closing_runs','accounting_closing_balances','accounting_period_reopen_requests','accounting_period_events')`);
  const haveTables = new Set(tables.rows.map(r => r.table_name));
  const expectedTables = ['accounting_closing_runs','accounting_closing_balances','accounting_period_reopen_requests','accounting_period_events'];
  assert(expectedTables.every(t => haveTables.has(t)), `tables ${haveTables.size}/${expectedTables.length}`);
  const tr = await pool.query(`select distinct trigger_name from information_schema.triggers
    where trigger_name in ('accounting_closing_runs_period_closed_trigger','accounting_closing_runs_immutable_trigger','accounting_closing_balances_immutable_trigger','accounting_period_events_immutable_trigger','accounting_period_reopen_requests_mutation_guard')`);
  assert(tr.rows.length === 5, `triggers ${tr.rows.length}/5`);
}

// Create tenant + 2098 open period + accounts + GEN journal, all under a unique
// random suffix so repeated runs stay isolated.
async function makeTenant(tag) {
  const suffix = tag + '-' + randomUUID().slice(0, 6);
  const slug = 'v0097-' + randomUUID().slice(0, 10);
  const t = await pool.query(`insert into tenants (name, slug) values ($1,$2) returning id`, [suffix, slug]);
  const tenantId = t.rows[0].id;
  const periodRes = await pool.query(`insert into fiscal_periods (tenant_id,name,start_date,end_date,status)
    values ($1, $2, '2098-01-01','2098-12-31','open') returning id`, [tenantId, `ACCOUNTING-VERIFY-${suffix}`]);
  const period = periodRes.rows[0];
  const dr = (await pool.query(`insert into chart_of_accounts (tenant_id,code,name,account_type) values ($1,$2,$3,'asset') returning id`,
    [tenantId, `V-DR-${suffix}`, `Débit ${suffix}`])).rows[0].id;
  const cr = (await pool.query(`insert into chart_of_accounts (tenant_id,code,name,account_type) values ($1,$2,$3,'liability') returning id`,
    [tenantId, `V-CR-${suffix}`, `Crédit ${suffix}`])).rows[0].id;
  await pool.query(`insert into accounting_journals (tenant_id,code,name,journal_type)
    values ($1,'GEN','Journal général','general') on conflict (tenant_id,code) do update set is_active=true`, [tenantId]);
  return { tenantId, periodId: period.id, dr, cr };
}

// Insert entry + lines in ONE transaction so the DEFERRED balance triggers fire at
// COMMIT with the full line set.
async function postBalanced(tenantId, drAccountId, crAccountId, amount) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(`insert into journal_entries (tenant_id,entry_number,entry_date,description,source_module,status)
      values ($1, ('V-'||substr(md5(random()::text),1,14))::text, '2098-01-01', 'close-verifier', 'accounting_verifier', 'posted') returning id`, [tenantId]);
    const entryId = r.rows[0].id;
    await client.query(`insert into journal_entry_lines (tenant_id,journal_entry_id,account_id,debit_amount,credit_amount,memo) values
      ($1,$2,$3,$4,'0.00','debit'),($1,$2,$5,'0.00',$4,'credit')`, [tenantId, entryId, drAccountId, amount, crAccountId]);
    await client.query('COMMIT');
    return entryId;
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

loadLocalEnv();
const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos' });

async function main() {
  const { closePeriod, requestReopen, decideReopen, getClosingBalances } = await import('../src/features/accounting/services/period-service');
  console.log('--- PASS 1 (apply) ---');
  await applyFile('pass1');
  await inventory();

  console.log('\n--- PASS 2 (re-run, idempotency) ---');
  await applyFile('pass2');
  await inventory();

  const actorA = 'verifier-actor-a';
  const actorB = 'verifier-actor-b';
  const A = await makeTenant('A');
  const B = await makeTenant('B');

  console.log('\n--- close: blockers + snapshot + idempotency ---');
  // Blocker: pending approved accounting_document in the period.
  let blocked = false;
  try {
    await pool.query(`insert into accounting_documents (tenant_id,document_type,status,document_date,description,total_amount,created_by_id)
      values ($1,'expense','pending_approval','2098-01-15','pièce en attente','100.00',$2)`, [A.tenantId, actorA]);
  } catch (e) { console.log('  ERR inserting doc', e.message); }
  try { await closePeriod({ tenantId: A.tenantId, userId: actorA }, A.periodId, 'clôture annuelle'); } catch { blocked = true; }
  assert(blocked, 'close rejected while a pending_approval document exists');
  await pool.query(`update accounting_documents set status='draft' where tenant_id=$1`, [A.tenantId]);

  // Blocker: draft bank reconciliation.
  const bank = (await pool.query(`insert into bank_accounts (tenant_id,bank_name,account_number) values ($1,'Banque vérif','BANQ-0097') returning id`, [A.tenantId])).rows[0].id;
  await pool.query(`insert into bank_reconciliations (tenant_id,bank_account_id,statement_date,statement_balance,reconciled_balance,status)
    values ($1,$2,'2098-12-20',0,0,'draft')`, [A.tenantId, bank]);
  blocked = false;
  try { await closePeriod({ tenantId: A.tenantId, userId: actorA }, A.periodId, 'clôture annuelle'); } catch { blocked = true; }
  assert(blocked, 'close rejected while a draft reconciliation exists');
  await pool.query(`update bank_reconciliations set status='completed' where tenant_id=$1`, [A.tenantId]);

  // Happy path: post a balanced entry, then close.
  await postBalanced(A.tenantId, A.dr, A.cr, '125.40');
  const closed = await closePeriod({ tenantId: A.tenantId, userId: actorA }, A.periodId, 'clôture annuelle');
  assert(closed.period.status === 'closed', 'close sets period status to closed');
  assert(closed.closingRun && closed.closingRun.postedEntryCount === 1, 'closing run records 1 posted entry');
  assert(closed.closingRun && closed.closingRun.debitTotal === '125.40' && closed.closingRun.creditTotal === '125.40' && closed.closingRun.netBalance === '0.00',
    'closing run totals are balanced (125.40 / 125.40 / 0)');
  const balRows = (await pool.query(`select account_code, debit_total, credit_total, net_balance from accounting_closing_balances where closing_run_id=$1 order by account_code`, [closed.closingRun.id])).rows;
  assert(balRows.length === 2 && balRows.some(r => r.account_code.startsWith('V-DR-') && r.debit_total === '125.40') && balRows.some(r => r.account_code.startsWith('V-CR-') && r.credit_total === '125.40'),
    'closing balances capture per-account debit/credit');

  // Idempotent re-close returns the same active run without a duplicate.
  const recl = await closePeriod({ tenantId: A.tenantId, userId: actorA }, A.periodId, 'nouvelle tentative');
  assert(recl.alreadyClosed === true && recl.closingRun && recl.closingRun.id === closed.closingRun.id, 're-close is idempotent (same run)');
  const runs = (await pool.query(`select count(*)::int c from accounting_closing_runs where fiscal_period_id=$1 and not superseded`, [A.periodId])).rows[0].c;
  assert(runs === 1, 'exactly one active closing run per period');

  // Reproducible-as-of: the snapshot read matches the pinned balances.
  const ev = await getClosingBalances({ tenantId: A.tenantId, userId: actorA }, closed.closingRun.id);
  assert(ev.run.id === closed.closingRun.id && ev.balances.length === 2, 'getClosingBalances returns the pinned snapshot');

  console.log('\n--- reopen: maker-checker flow ---');
  // Request requires a closed period.
  blocked = false;
  try { await requestReopen({ tenantId: A.tenantId, userId: actorA }, B.periodId, 'demande incohérente'); } catch { blocked = true; }
  assert(blocked, 'reopen request on a non-closed period rejected (tenant scoped too)');

  const req = await requestReopen({ tenantId: A.tenantId, userId: actorA }, A.periodId, 'Erreur de saisie découverte après clôture');
  assert(req.status === 'pending' && req.requestedById === actorA, 'reopen request recorded as pending');
  blocked = false;
  try { await requestReopen({ tenantId: A.tenantId, userId: actorA }, A.periodId, 'double demande'); } catch { blocked = true; }
  assert(blocked, 'duplicate pending reopen request rejected');

  // Same-actor approval is forbidden (maker-checker).
  blocked = false;
  try { await decideReopen({ tenantId: A.tenantId, userId: actorA }, req.id, 'approved', 'auto-approbation'); } catch { blocked = true; }
  assert(blocked, 'requester cannot approve their own reopen request');

  // Rejection keeps the period closed.
  const rejected = await decideReopen({ tenantId: A.tenantId, userId: actorB }, req.id, 'rejected', 'pièces manquantes');
  assert(rejected.request.status === 'rejected', 'reopen request can be rejected');
  const stillClosed = (await pool.query(`select status from fiscal_periods where id=$1`, [A.periodId])).rows[0].status;
  assert(stillClosed === 'closed', 'rejected reopen leaves the period closed');

  // Approval by a different actor reopens + supersedes the snapshot.
  const req2 = await requestReopen({ tenantId: A.tenantId, userId: actorB }, A.periodId, 'Clôture prématurée, reprise des saisies');
  const approved = await decideReopen({ tenantId: A.tenantId, userId: actorA }, req2.id, 'approved', 'clôture prématurée confirmée');
  assert(approved.period && approved.period.status === 'open', 'approved reopen sets period back to open');
  assert(approved.supersededClosingRunId === closed.closingRun.id, 'approval supersedes the active closing run');
  const superseded = (await pool.query(`select superseded, superseded_by_id from accounting_closing_runs where id=$1`, [closed.closingRun.id])).rows[0];
  assert(superseded.superseded === true && superseded.superseded_by_id === actorA, 'closing run marked superseded with decision actor');
  const activeRuns = (await pool.query(`select count(*)::int c from accounting_closing_runs where fiscal_period_id=$1 and not superseded`, [A.periodId])).rows[0].c;
  assert(activeRuns === 0, 'no active closing run remains after reopen');

  blocked = false;
  try { await decideReopen({ tenantId: A.tenantId, userId: actorA }, req2.id, 'approved', 'deuxième fois'); } catch { blocked = true; }
  assert(blocked, 'deciding an already-decided request is rejected');

  console.log('\n--- immutability + audit events ---');
  blocked = false;
  try { await pool.query(`update accounting_closing_runs set reason='tampered' where id=$1`, [closed.closingRun.id]); } catch { blocked = true; }
  assert(blocked, 'closing run core fields are immutable');
  blocked = false;
  try { await pool.query(`delete from accounting_closing_runs where id=$1`, [closed.closingRun.id]); } catch { blocked = true; }
  assert(blocked, 'closing run cannot be deleted');
  blocked = false;
  try { await pool.query(`update accounting_closing_balances set account_code='HACK' where closing_run_id=$1`, [closed.closingRun.id]); } catch { blocked = true; }
  assert(blocked, 'closing balances are immutable');
  blocked = false;
  try { await pool.query(`update accounting_period_events set reason='tampered' where tenant_id=$1`, [A.tenantId]); } catch { blocked = true; }
  assert(blocked, 'period events are immutable (update)');
  blocked = false;
  try { await pool.query(`delete from accounting_period_events where tenant_id=$1`, [A.tenantId]); } catch { blocked = true; }
  assert(blocked, 'period events are immutable (delete)');

  const events = (await pool.query(`select event_type from accounting_period_events where tenant_id=$1 and fiscal_period_id=$2 order by created_at`, [A.tenantId, A.periodId])).rows.map(r => r.event_type);
  assert(events.includes('closed') && events.includes('reopen_requested') && events.includes('reopen_rejected') && events.includes('reopen_approved'),
    `event trail records close + request + reject + approve (${events.join(',')})`);

  console.log('\n--- two-tenant isolation ---');
  // Tenant B owns its own period; tenant A must not see or decide B's artifacts.
  const bClosed = await closePeriod({ tenantId: B.tenantId, userId: actorB }, B.periodId, 'clôture B');
  blocked = false;
  try { await getClosingBalances({ tenantId: A.tenantId, userId: actorA }, bClosed.closingRun.id); } catch { blocked = true; }
  assert(blocked, 'tenant A cannot read tenant B closing run');
  const bReq = await requestReopen({ tenantId: B.tenantId, userId: actorA }, B.periodId, 'Demande B de réouverture');
  blocked = false;
  try { await decideReopen({ tenantId: A.tenantId, userId: actorB }, bReq.id, 'approved', 'cross-tenant'); } catch { blocked = true; }
  assert(blocked, 'tenant A cannot decide tenant B reopen request');

  console.log(failed ? '\nVERDICT: FAILED' : '\nVERDICT: PASS (close/reopen hardened, idempotent, tenant-safe)');
  await pool.end();
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => { console.error('FATAL', e); await pool.end(); process.exit(1); });
