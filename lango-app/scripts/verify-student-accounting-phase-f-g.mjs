// Live acceptance verification for Student Accounting Phases F (fine policies
// + assessments) and G (Broadcast-backed reminder dispatch). Run against the
// docker app (:3000). All rows created here are removed via psql afterward.
// Run: node scripts/verify-student-accounting-phase-f-g.mjs
import { execSync } from 'node:child_process';

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3000';
const ORIGIN = 'http://localhost:3000';
const TENANT = '5814b1af-f033-4c66-9765-c41f435cb696';

const results = [];
const check = (label, ok, detail = '') => {
  results.push({ label, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
};

function sql(query) {
  return execSync(`docker exec schoolos-db psql -U schoolos -d schoolos -t -A -c "${query.replaceAll('"', '\\"')}"`, { encoding: 'utf8' }).trim();
}

async function signIn(email, password) {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  });
  const setCookies = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  if (!setCookies) throw new Error(`sign-in for ${email} returned no cookie (${res.status})`);
  return { cookie: setCookies };
}

async function api(cookie, path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: ORIGIN },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
}

const created = { policyIds: [], ruleIds: [], invoiceIds: [] };

const run = async () => {
  const admin = await signIn('y.elamrani@atlas.ma', 'Admin123!');

  // Find a student who has a guardian with a phone (needed for reminder dispatch).
  const studentId = sql(`SELECT s.id FROM "user" s JOIN guardian_students gs ON gs.student_id=s.id JOIN guardians g ON g.id=gs.guardian_id WHERE s.tenant_id='${TENANT}' AND s.role='student' AND g.phone IS NOT NULL AND g.phone<>'' LIMIT 1`);
  check('found a student with guardian phone', Boolean(studentId), studentId);

  // -------------------------------------------------------------------------
  // Phase F — fine policies + assessments
  // -------------------------------------------------------------------------
  const listPolicies = await api(admin.cookie, '/api/finance/fine-policies');
  check('[F1] GET /api/finance/fine-policies → 200 + array', listPolicies.status === 200 && Array.isArray(listPolicies.json?.data), `status=${listPolicies.status}`);

  const listAssess = await api(admin.cookie, '/api/finance/fine-assessments');
  check('[F2] GET /api/finance/fine-assessments → 200 + array', listAssess.status === 200 && Array.isArray(listAssess.json?.data), `status=${listAssess.status}`);

  const policy = await api(admin.cookie, '/api/finance/fine-policies', {
    method: 'POST',
    body: { name: 'Vérif Phase F', formula: 'flat', flatAmount: 50, graceDays: 0, status: 'active' },
  });
  const policyId = policy.json?.data?.id;
  if (policyId) created.policyIds.push(policyId);
  check('[F3] create fine policy → 200', policy.status === 200 && Boolean(policyId), `status=${policy.status}`);

  // Overdue invoice for the student so both fine-runs and reminders see it.
  const invoice = await api(admin.cookie, '/api/finance/invoices', {
    method: 'POST',
    body: { studentId, amount: 300, dueDate: '2026-01-15', items: [{ description: 'Frais Phase F/G', amount: '300' }] },
  });
  const invoiceId = invoice.json?.data?.id;
  if (invoiceId) created.invoiceIds.push(invoiceId);
  check('[F4] create overdue invoice → 200', invoice.status === 200 && Boolean(invoiceId), `status=${invoice.status}`);

  const fineRun = await api(admin.cookie, '/api/finance/fine-runs', { method: 'POST', body: { finePolicyId: policyId } });
  check('[F5] POST /api/finance/fine-runs → 200 assessed>=1', fineRun.status === 200 && (fineRun.json?.data?.assessed ?? 0) >= 1, `assessed=${fineRun.json?.data?.assessed}`);

  const afterRun = await api(admin.cookie, '/api/finance/fine-assessments');
  const assessment = (afterRun.json?.data ?? []).find((a) => a.invoiceId === invoiceId && a.finePolicyId === policyId);
  check('[F6] fine assessment recorded for invoice', Boolean(assessment), `amount=${assessment?.amount}`);

  if (assessment) {
    const waive = await api(admin.cookie, '/api/finance/fine-assessments', {
      method: 'POST',
      body: { id: assessment.id, waiveReason: 'Vérification Phase F' },
    });
    check('[F7] waive fine → 200 + waived', waive.status === 200 && waive.json?.data?.status === 'waived', `status=${waive.status}`);
  } else {
    check('[F7] waive fine → skipped (no assessment)', false);
  }

  // -------------------------------------------------------------------------
  // Phase G — Broadcast-backed reminders
  // -------------------------------------------------------------------------
  const listRules = await api(admin.cookie, '/api/finance/reminder-rules');
  check('[G1] GET /api/finance/reminder-rules → 200 + array', listRules.status === 200 && Array.isArray(listRules.json?.data), `status=${listRules.status}`);

  const rule = await api(admin.cookie, '/api/finance/reminder-rules', {
    method: 'POST',
    body: { name: 'Vérif Phase G', minBalance: 0, maxPerStudent: 3, status: 'active' },
  });
  const ruleId = rule.json?.data?.id;
  if (ruleId) created.ruleIds.push(ruleId);
  check('[G2] create reminder rule → 200', rule.status === 200 && Boolean(ruleId), `status=${rule.status}`);

  const campaignsBefore = Number(sql(`SELECT count(*) FROM communication_campaigns WHERE tenant_id='${TENANT}'`));

  const runRule = await api(admin.cookie, '/api/finance/reminder-runs', {
    method: 'POST',
    body: { ruleId },
  });
  check('[G3] POST /api/finance/reminder-runs → 200', runRule.status === 200 && runRule.json?.success === true, `status=${runRule.status} message=${runRule.json?.message ?? ''}`);

  const campaignsAfterRule = Number(sql(`SELECT count(*) FROM communication_campaigns WHERE tenant_id='${TENANT}'`));
  check('[G3] rule dispatch wrote a Broadcast campaign (not sms_messages)', campaignsAfterRule > campaignsBefore, `campaigns ${campaignsBefore}→${campaignsAfterRule}`);

  // Single-invoice manual reminder through the same Broadcast pipeline.
  const campaignsBeforeSingle = campaignsAfterRule;
  const single = await api(admin.cookie, '/api/finance/reminders', {
    method: 'POST',
    body: { invoiceId },
  });
  check('[G4] POST /api/finance/reminders (single) → 200', single.status === 200 && single.json?.success === true, `status=${single.status}`);
  const campaignsAfterSingle = Number(sql(`SELECT count(*) FROM communication_campaigns WHERE tenant_id='${TENANT}'`));
  check('[G4] single reminder wrote a Broadcast campaign', campaignsAfterSingle > campaignsBeforeSingle, `campaigns ${campaignsBeforeSingle}→${campaignsAfterSingle}`);

  // Cleanup
  if (created.ruleIds.length) {
    const rids = created.ruleIds.map((id) => `'${id}'`).join(',');
    sql(`DELETE FROM finance_reminder_runs WHERE rule_id IN (${rids})`);
    sql(`DELETE FROM finance_reminder_rules WHERE id IN (${rids})`);
  }
  if (created.policyIds.length) {
    const pids = created.policyIds.map((id) => `'${id}'`).join(',');
    sql(`DELETE FROM fine_assessments WHERE fine_policy_id IN (${pids})`);
    sql(`DELETE FROM fine_policies WHERE id IN (${pids})`);
  }
  if (created.invoiceIds.length) {
    const ids = created.invoiceIds.map((id) => `'${id}'`).join(',');
    // Remove campaigns the reminders dispatched for these invoices.
    sql(`DELETE FROM communication_deliveries WHERE campaign_id IN (SELECT id FROM communication_campaigns WHERE name LIKE 'Relance de frais — %')`);
    sql(`DELETE FROM communication_campaign_recipients WHERE campaign_id IN (SELECT id FROM communication_campaigns WHERE name LIKE 'Relance de frais — %')`);
    sql(`DELETE FROM communication_campaigns WHERE name LIKE 'Relance de frais — %'`);
    sql(`DELETE FROM invoice_events WHERE invoice_id IN (${ids})`);
    sql(`DELETE FROM invoice_items WHERE invoice_id IN (${ids})`);
    sql(`DELETE FROM invoices WHERE id IN (${ids})`);
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
};

run().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
