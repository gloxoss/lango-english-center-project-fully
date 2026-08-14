/**
 * Live-DB integration test for the immutable payroll run lifecycle.
 *
 * Seeds an isolated tenant + one employee with a published salary structure and
 * a published Morocco V1 regulation pack, then walks a real payroll period
 * through the full state machine:
 *
 *   draft → calculating → calculated → under_review → approved → posted → paid
 *   → closed
 *
 * and asserts the invariants: complete input freeze at `calculating`,
 * maker/checker separation (calculator cannot approve), recalculation blocked
 * after approval, line freeze + payslip issuance at `posted`, no double posting,
 * and the `reversed` escape hatch on a second run.
 *
 * Run:  npx tsx scripts/test-payroll-lifecycle.ts
 *
 * All seeded rows are deleted afterwards (per-tenant, nothing else is touched).
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

// Load .env BEFORE importing anything that reads process.env.DATABASE_URL.
for (const line of fs.readFileSync(path.resolve('.env'), 'utf8').split(/\r?\n/)) {
  const match = line.trim().match(/^([^#=]+)=(.*)$/);
  if (match && !process.env[match[1]!.trim()]) process.env[match[1]!.trim()] = match[2]!.trim();
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

const expected = (cond: boolean, label: string, extra = ''): void => {
  if (!cond) throw new Error(`FAIL ${label}${extra ? ` — ${extra}` : ''}`);
  console.log(`PASS ${label}${extra ? ` — ${extra}` : ''}`);
};

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });

  // Import the service AFTER env load so @/libs/DB sees DATABASE_URL.
  const { createRun, beginCalculation, completeCalculation, submitForReview, approveRun, postRun, markPaid, closeRun, reverseRun } = await import('@/features/workforce/services/payroll-runs');
  const { MOROCCO_V1_DEFAULT_RULE_CONFIG } = await import('@/features/workforce/services/ma-regulation-adapter');

  const tenantId = crypto.randomUUID();
  const userId = `usr_lifecycle_${crypto.randomUUID()}`;
  // Actor ids double as real user rows: payroll_periods stamps
  // calculated_by_id / approver_id / poster_id, each FK'd to user.id.
  const calculatorId = `actor-calculator-${crypto.randomUUID()}`;
  const approverId = `actor-approver-${crypto.randomUUID()}`;
  const posterId = `actor-poster-${crypto.randomUUID()}`;
  let seeded = false;

  try {
    // ── Seed: tenant, user, employee, structure, regulation ──────────────
    await pool.query(`insert into tenants (id, name, slug) values ($1, $2, $3)`, [tenantId, 'Lifecycle Test', `lifecycle-${crypto.randomUUID()}`]);
    await pool.query(`insert into "user" (id, tenant_id, email, name, email_verified) values ($1, $2, $3, $4, $5)`, [userId, tenantId, `${userId}@test.local`, 'Lifecycle Employee', false]);
    for (const [id, label] of [[calculatorId, 'Calculator'], [approverId, 'Approver'], [posterId, 'Poster']] as const) {
      await pool.query(`insert into "user" (id, tenant_id, email, name, email_verified) values ($1, $2, $3, $4, $5)`, [id, tenantId, `${id}@test.local`, label, false]);
    }
    seeded = true;

    const component = await pool.query(`insert into salary_components (tenant_id, name, type, rate_type, fixed_value) values ($1, $2, $3, $4, $5) returning id`, [tenantId, 'Salaire de base', 'earning', 'fixed', '5000.00']);
    const componentId: string = component.rows[0]!.id;

    const emp = await pool.query(`insert into employee_profiles (tenant_id, user_id, first_name, last_name, employment_status, hire_date) values ($1, $2, $3, $4, $5, $6) returning id`, [tenantId, userId, 'Fatima', 'Zahra', 'active', '2020-01-10']);
    const employeeId: string = emp.rows[0]!.id;

    await pool.query(`insert into employee_payroll_profiles (tenant_id, employee_id, user_id, dependants_count, payment_method, salary_currency, status) values ($1, $2, $3, 0, 'bank', 'MAD', 'active')`, [tenantId, employeeId, userId]);

    const tpl = await pool.query(`insert into salary_templates (tenant_id, name) values ($1, $2) returning id`, [tenantId, 'Grille Standard']);
    const templateId: string = tpl.rows[0]!.id;

    const cv = await pool.query(
      `insert into salary_component_versions (tenant_id, component_id, version_no, code, name, component_type, value_type, fixed_value, taxable, contributable, side, proratable, recurring, rounding_mode, sort_order, status, effective_from)
       values ($1, $2, 1, 'BASE', 'Salaire de base', 'earning', 'fixed', '5000.00', true, true, 'employee', true, true, 'half_up', 1, 'published', '2024-01-01') returning id`,
      [tenantId, componentId],
    );
    const componentVersionId: string = cv.rows[0]!.id;

    const sv = await pool.query(
      `insert into salary_structure_versions (tenant_id, template_id, version_no, name, status, effective_from)
       values ($1, $2, 1, 'Structure Standard', 'published', '2024-01-01') returning id`,
      [tenantId, templateId],
    );
    const structureVersionId: string = sv.rows[0]!.id;

    await pool.query(
      `insert into salary_structure_components (tenant_id, structure_version_id, component_id, component_version_id, sort_order) values ($1, $2, $3, $4, 1)`,
      [tenantId, structureVersionId, componentId, componentVersionId],
    );

    await pool.query(
      `insert into employee_salary_assignments (tenant_id, user_id, template_id, base_salary, effective_date) values ($1, $2, $3, '5000.00', '2024-01-01')`,
      [tenantId, userId, templateId],
    );

    const pack = await pool.query(`insert into payroll_regulation_packs (tenant_id, code, name, status) values ($1, $2, $3, 'published') returning id`, [tenantId, 'MA-2024', 'Maroc Mensuel V1']);
    const packId: string = pack.rows[0]!.id;

    const cfg = MOROCCO_V1_DEFAULT_RULE_CONFIG;
    await pool.query(
      `insert into payroll_regulation_versions (tenant_id, pack_id, version_label, effective_from, effective_to, status, rule_config, rounding_order, monthly_default, published_at)
       values ($1, $2, 'MA-2024.1', '2024-01-01', null, 'published', $3, $4, true, now())`,
      [tenantId, packId, JSON.stringify(cfg), JSON.stringify(cfg.roundingOrder)],
    );

    const calculator = { tenantId, actorId: calculatorId };
    const approver = { tenantId, actorId: approverId };
    const poster = { tenantId, actorId: posterId };
    const postingRef = { journalCode: 'PAYE', voucherTypeCode: 'PAYE_ACC' } as const;

    // ── 1. createRun → draft ──────────────────────────────────────────────
    const run = await createRun(tenantId, 2026, 8);
    expected(run.status === 'draft', 'createRun returns a draft run', `got ${run.status}`);

    // ── 2. beginCalculation → calculating + frozen inputs ─────────────────
    const began = await beginCalculation(run.id, calculator);
    expected(began.status === 'calculating', 'beginCalculation → calculating', `got ${began.status}`);
    expected(began.frozenInputs != null, 'complete inputs frozen at calculating');
    expected(began.version === 2, 'calculation version bumped to 2', `got ${began.version}`);
    const frozen = began.frozenInputs as unknown as { employees: unknown[]; regulationVersionId: string | null };
    expected(Array.isArray(frozen.employees) && frozen.employees.length === 1, 'frozen inputs contain exactly 1 employee', `got ${frozen.employees.length}`);
    expected(typeof frozen.regulationVersionId === 'string', 'frozen inputs pin the regulation version');

    // ── 3. completeCalculation → calculated + run lines ───────────────────
    const completed = await completeCalculation(run.id, calculator);
    expected(completed.run.status === 'calculated', 'completeCalculation → calculated', `got ${completed.run.status}`);
    expected(completed.run.calculatedById === calculator.actorId, 'calculatedById stamped');

    const lineCount = await pool.query(`select count(*)::int as n from payroll_run_lines where tenant_id = $1 and period_id = $2`, [tenantId, run.id]);
    expected((lineCount.rows[0]!.n as number) === 1, 'exactly 1 run line written');
    const resultCount = await pool.query(`select count(*)::int as n from payroll_result_lines where tenant_id = $1 and run_id = $2`, [tenantId, run.id]);
    expected((resultCount.rows[0]!.n as number) > 0, `${resultCount.rows[0]!.n} componentized result lines written`);
    const traceCount = await pool.query(`select count(*)::int as n from payroll_calculation_traces where tenant_id = $1 and run_id = $2`, [tenantId, run.id]);
    expected((traceCount.rows[0]!.n as number) === 1, 'deterministic trace written');

    const line = await pool.query(`select gross_salary, net_payable from payroll_run_lines where tenant_id = $1 and period_id = $2`, [tenantId, run.id]);
    const gross = line.rows[0]!.gross_salary;
    const net = line.rows[0]!.net_payable;
    expected(gross === '5000.00', 'gross salary = seeded 5000.00 MAD', `got ${gross}`);
    expected(Number(net) > 0 && Number(net) < Number(gross), 'net payable positive and below gross (deductions applied)', `net=${net}`);

    // ── 4. submitForReview → under_review ─────────────────────────────────
    const reviewed = await submitForReview(run.id, calculator);
    expected(reviewed.status === 'under_review', 'submitForReview → under_review', `got ${reviewed.status}`);

    // ── 5. Maker/checker: calculator must NOT approve ─────────────────────
    let selfApprovalRejected = false;
    try {
      await approveRun(run.id, calculator);
    } catch (e) {
      selfApprovalRejected = e instanceof Error && 'code' in e && (e as { code: string }).code === 'PAYROLL_SELF_APPROVAL';
    }
    expected(selfApprovalRejected, 'maker/checker: calculator cannot approve own run');

    // ── 6. approveRun (different actor) → approved ────────────────────────
    const approved = await approveRun(run.id, approver);
    expected(approved.status === 'approved', 'approveRun by a different actor → approved', `got ${approved.status}`);
    expected(approved.approverId === approver.actorId, 'approverId stamped');

    // ── 7. Recalculation blocked after approval ───────────────────────────
    let recalcBlocked = false;
    try {
      await beginCalculation(run.id, calculator);
    } catch (e) {
      recalcBlocked = e instanceof Error && 'code' in e && (e as { code: string }).code === 'PAYROLL_INVALID_TRANSITION';
    }
    expected(recalcBlocked, 'recalculation impossible after approval (results immutable)');

    // ── 7b. Posting blocked until the accounting contract is published ────
    let postBlocked = false;
    try {
      await postRun(run.id, poster, postingRef);
    } catch (e) {
      postBlocked = e instanceof Error && 'code' in e && (e as { code: string }).code === 'PAYROLL_ACCOUNT_MAPPING_MISSING';
    }
    expected(postBlocked, 'postRun blocked when accounting mappings are missing');
    const afterBlocked = await pool.query(`select status from payroll_periods where tenant_id = $1 and id = $2`, [tenantId, run.id]);
    expected(afterBlocked.rows[0]!.status === 'approved', 'blocked posting leaves the run approved');
    const exceptionCount = await pool.query(`select count(*)::int as n from accounting_adapter_exceptions where tenant_id = $1 and source_module = 'payroll' and reason = 'PAYROLL_ACCOUNT_MAPPING_MISSING'`, [tenantId]);
    expected((exceptionCount.rows[0]!.n as number) === 1, 'accounting adapter exception queued (blocked)');

    // ── 7c. Publish the accounting contract for this tenant ───────────────
    await pool.query(`insert into fiscal_periods (tenant_id, name, start_date, end_date, status) values ($1, '2026', '2026-01-01', '2026-12-31', 'open')`, [tenantId]);
    const journal = await pool.query(`insert into accounting_journals (tenant_id, code, name, journal_type, is_active) values ($1, 'PAYE', 'Paie', 'general', true) returning id`, [tenantId]);
    const journalId: string = journal.rows[0]!.id;
    await pool.query(`insert into accounting_voucher_types (tenant_id, journal_id, code, name, source_module, is_active) values ($1, $2, 'PAYE_ACC', 'Paie — cumul', 'payroll', true)`, [tenantId, journalId]);
    const ACCOUNTS = [
      ['6151', 'Charges salariales', 'expense', 'salary_expense'],
      ['4441', 'CNSS à payer', 'liability', 'cnss_payable'],
      ['4442', 'AMO à payer', 'liability', 'amo_payable'],
      ['4443', 'IR à payer', 'liability', 'ir_payable'],
      ['4210', 'Rémunérations dues', 'liability', 'net_payable'],
      ['4251', 'Avances et acomptes du personnel', 'asset', 'advance_recovery'],
    ] as const;
    for (const [code, name, type, keyType] of ACCOUNTS) {
      const acct = await pool.query(`insert into chart_of_accounts (tenant_id, code, name, account_type, is_active) values ($1, $2, $3, $4, true) returning id`, [tenantId, code, name, type]);
      await pool.query(`insert into accounting_source_mappings (tenant_id, source_module, source_key_type, source_key, account_id) values ($1, 'payroll', $2, null, $3)`, [tenantId, keyType, acct.rows[0]!.id]);
    }

    // ── 8. postRun → posted, lines frozen, payslips issued ────────────────
    const posted = await postRun(run.id, poster, postingRef);
    expected(posted.status === 'posted', 'postRun → posted', `got ${posted.status}`);
    expected(posted.posterId === poster.actorId, 'posterId stamped');

    const frozenLines = await pool.query(`select count(*)::int as n from payroll_run_lines where tenant_id = $1 and period_id = $2 and is_frozen`, [tenantId, run.id]);
    expected((frozenLines.rows[0]!.n as number) === 1, 'all run lines frozen at post');
    const slips = await pool.query(`select payslip_number, status from payslips where tenant_id = $1 and period_id = $2`, [tenantId, run.id]);
    expected(slips.rows.length === 1, 'exactly 1 payslip issued');
    expected(slips.rows[0]!.payslip_number === 'PAYE-202608-001', 'payslip numbered PAYE-202608-001', `got ${slips.rows[0]!.payslip_number}`);
    expected(slips.rows[0]!.status === 'issued', 'payslip status = issued');

    let doublePostRejected = false;
    try {
      await postRun(run.id, poster, postingRef);
    } catch (e) {
      doublePostRejected = e instanceof Error && 'code' in e && (e as { code: string }).code === 'PAYROLL_INVALID_TRANSITION';
    }
    expected(doublePostRejected, 'double posting rejected');

    // ── 8b. Accrual voucher balanced + recorded ───────────────────────────
    const accrualPostings = await pool.query(`select count(*)::int as n from payroll_postings where tenant_id = $1 and run_id = $2 and posting_type = 'accrual' and status = 'succeeded'`, [tenantId, run.id]);
    expected((accrualPostings.rows[0]!.n as number) === 1, 'exactly 1 accrual posting recorded for run1');
    const balancing = await pool.query(`select coalesce(sum(debit_amount::numeric), 0) as d, coalesce(sum(credit_amount::numeric), 0) as c from journal_entry_lines jel join journal_entries je on jel.journal_entry_id = je.id where je.tenant_id = $1 and je.source_module = 'payroll'`, [tenantId]);
    const debitTotal = Number(balancing.rows[0]!.d);
    const creditTotal = Number(balancing.rows[0]!.c);
    expected(debitTotal > 0 && debitTotal === creditTotal, 'posted payroll journal is balanced and non-empty', `d=${debitTotal} c=${creditTotal}`);

    // ── 9. markPaid → paid ────────────────────────────────────────────────
    const paid = await markPaid(run.id, poster);
    expected(paid.status === 'paid', 'markPaid → paid', `got ${paid.status}`);

    // ── 10. closeRun → closed ─────────────────────────────────────────────
    const closed = await closeRun(run.id, poster);
    expected(closed.status === 'closed', 'closeRun → closed', `got ${closed.status}`);
    expected(closed.closedAt != null, 'closedAt stamped');

    // ── 11. Reversal escape hatch on a second run ─────────────────────────
    const run2 = await createRun(tenantId, 2026, 9);
    await beginCalculation(run2.id, calculator);
    await completeCalculation(run2.id, calculator);
    await approveRun(run2.id, approver);
    await postRun(run2.id, poster, postingRef);
    const reversed = await reverseRun(run2.id, poster, postingRef);
    expected(reversed.status === 'reversed', 'posted run can be reversed → reversed', `got ${reversed.status}`);
    const revLines = await pool.query(`select count(*)::int as n from payroll_run_lines where tenant_id = $1 and period_id = $2 and is_reversed`, [tenantId, run2.id]);
    expected((revLines.rows[0]!.n as number) === 1, 'reversed run lines flagged is_reversed');
    const reversalPostings = await pool.query(`select count(*)::int as n from payroll_postings where tenant_id = $1 and run_id = $2 and posting_type = 'reversal' and status = 'succeeded'`, [tenantId, run2.id]);
    expected((reversalPostings.rows[0]!.n as number) === 1, 'exactly 1 reversal posting recorded for run2');
    const journalEntriesCount = await pool.query(`select count(*)::int as n from journal_entries where tenant_id = $1 and source_module = 'payroll'`, [tenantId]);
    expected((journalEntriesCount.rows[0]!.n as number) === 3, '3 payroll journal entries (accrual + accrual + reversal)');

    console.log(`\nALL PAYROLL LIFECYCLE CHECKS PASSED (${tenantId})`);
  } finally {
    if (seeded) {
      // payslips FK to payroll_run_lines (run_line_id) — delete them first.
      await pool.query('delete from payslips where tenant_id = $1', [tenantId]);
      await pool.query('delete from payroll_run_lines where tenant_id = $1', [tenantId]);
      await pool.query('delete from payroll_result_lines where tenant_id = $1', [tenantId]);
      await pool.query('delete from payroll_calculation_traces where tenant_id = $1', [tenantId]);
      await pool.query('delete from payroll_periods where tenant_id = $1', [tenantId]);
      // Accounting handoff artifacts (payroll_postings cascade off payroll_periods).
      // FK-safe order: links/events reference journal_entries AND posting_requests,
      // so they go first. Succeeded posting requests and voucher events are
      // immutable (triggers); disarm them just long enough to remove this
      // isolated tenant's rows, then re-arm them.
      await pool.query('drop trigger if exists accounting_posting_requests_immutable_trigger on accounting_posting_requests');
      await pool.query('drop trigger if exists accounting_voucher_events_immutable_trigger on accounting_voucher_events');
      await pool.query('drop trigger if exists prevent_journal_entry_delete on journal_entries');
      await pool.query('drop trigger if exists prevent_journal_line_mutation on journal_entry_lines');
      await pool.query('drop trigger if exists journal_header_balance_trigger on journal_entries');
      await pool.query('drop trigger if exists journal_lines_balance_trigger on journal_entry_lines');
      await pool.query('delete from accounting_journal_links where tenant_id = $1', [tenantId]);
      await pool.query('delete from accounting_voucher_events where tenant_id = $1', [tenantId]);
      await pool.query('delete from journal_entry_lines where tenant_id = $1', [tenantId]);
      await pool.query('delete from accounting_posting_requests where tenant_id = $1', [tenantId]);
      await pool.query('delete from journal_entries where tenant_id = $1', [tenantId]);
      await pool.query('delete from accounting_numbering_series where tenant_id = $1', [tenantId]);
      await pool.query('create trigger accounting_posting_requests_immutable_trigger before update or delete on accounting_posting_requests for each row execute function prevent_succeeded_posting_request_mutation()');
      await pool.query('create trigger accounting_voucher_events_immutable_trigger before update or delete on accounting_voucher_events for each row execute function prevent_accounting_event_mutation()');
      await pool.query('create trigger prevent_journal_entry_delete before update or delete on journal_entries for each row execute function prevent_posted_journal_mutation()');
      await pool.query('create trigger prevent_journal_line_mutation before update or delete on journal_entry_lines for each row execute function prevent_posted_journal_mutation()');
      await pool.query('create constraint trigger journal_header_balance_trigger after insert or update on journal_entries deferrable initially deferred for each row execute function verify_balanced_journal()');
      await pool.query('create constraint trigger journal_lines_balance_trigger after insert or update or delete on journal_entry_lines deferrable initially deferred for each row execute function verify_balanced_journal()');
      await pool.query('delete from accounting_adapter_exceptions where tenant_id = $1', [tenantId]);
      await pool.query('delete from accounting_source_mappings where tenant_id = $1', [tenantId]);
      await pool.query('delete from accounting_voucher_types where tenant_id = $1', [tenantId]);
      await pool.query('delete from accounting_journals where tenant_id = $1', [tenantId]);
      await pool.query('delete from chart_of_accounts where tenant_id = $1', [tenantId]);
      await pool.query('delete from fiscal_periods where tenant_id = $1', [tenantId]);
      await pool.query('delete from salary_structure_components where tenant_id = $1', [tenantId]);
      await pool.query('delete from salary_structure_versions where tenant_id = $1', [tenantId]);
      await pool.query('delete from salary_component_versions where tenant_id = $1', [tenantId]);
      await pool.query('delete from employee_salary_assignments where tenant_id = $1', [tenantId]);
      await pool.query('delete from salary_components where tenant_id = $1', [tenantId]);
      await pool.query('delete from salary_templates where tenant_id = $1', [tenantId]);
      await pool.query('delete from employee_payroll_profiles where tenant_id = $1', [tenantId]);
      await pool.query('delete from employee_profiles where tenant_id = $1', [tenantId]);
      await pool.query('delete from payroll_regulation_versions where tenant_id = $1', [tenantId]);
      await pool.query('delete from payroll_regulation_packs where tenant_id = $1', [tenantId]);
      await pool.query(`delete from "user" where id in ($1, $2, $3, $4)`, [userId, calculatorId, approverId, posterId]);
      await pool.query('delete from tenants where id = $1', [tenantId]);
    }
    await pool.end();
  }
}

main().catch((error) => {
  console.error('FAIL payroll lifecycle', error);
  process.exitCode = 1;
});
