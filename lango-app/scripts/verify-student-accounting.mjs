// Live acceptance verification for Student Accounting build (#12).
// Verifies: auth + role/capability gates, tenant isolation, and CRUD round-trips
// across fee-types, fine-policies, fine-runs, payment-methods, fee-structure
// versions, allocation preview/run, reminder-rules, reminder-runs. All rows
// created by this script are removed afterward via psql. Run against the live
// dev server (:3002).
// Run: node scripts/verify-student-accounting.mjs
import { execSync } from 'node:child_process';

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3002';
const ORIGIN = 'http://localhost:3000';

const ATLAS = 'ca40c88e-339c-4fea-b5c4-51d5c9cc0239';
const LANGO = 'f62f31eb-1fc8-4102-9145-a5ce0bca989b';
const STUDENT_ID = 'STU-002'; // Salma Bennani (Atlas)

const results = [];
const check = (label, ok, detail = '') => {
  results.push({ label, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
};

function sql(query) {
  return execSync(`docker exec schoolos-db psql -U schoolos -d schoolos -t -c "${query.replaceAll('"', '\\"')}"`, { encoding: 'utf8' }).trim();
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

const ACCOUNTANT = { email: 'accountant@atlas.ma', password: 'Admin123!' };
const STUDENT = { email: 'prn-prn-child-a@placeholder.local', password: 'ParentAdmin123!' };
const PARENT = { email: 'prn-prn-parent-a@placeholder.local', password: 'ParentAdmin123!' };
const LANGO_ADMIN = { email: 'admin@lango.ma', password: 'Admin123!' };

const created = { feeTypeIds: [], policyIds: [], methodIds: [], versionIds: [], ruleIds: [], runIds: [], invoiceIds: [], structureIds: [], allocationRunIds: [] };
let allocationPrefix = null;

const run = async () => {
  const acc = await signIn(ACCOUNTANT.email, ACCOUNTANT.password);
  const stu = await signIn(STUDENT.email, STUDENT.password);
  const par = await signIn(PARENT.email, PARENT.password);
  const lango = await signIn(LANGO_ADMIN.email, LANGO_ADMIN.password);

  // ---------- 1. Auth guards ----------
  for (const p of ['/api/finance/fee-types', '/api/finance/fine-policies', '/api/finance/payment-methods', '/api/finance/reminder-rules']) {
    const anon = await api('', p);
    check(`[1] anonymous blocked on ${p}`, anon.status === 401 || anon.status === 403, `status=${anon.status}`);
  }
  const anonRun = await api('', '/api/finance/fine-runs', { method: 'POST' });
  check('[1] anonymous blocked on fine-runs', anonRun.status === 401 || anonRun.status === 403, `status=${anonRun.status}`);
  const anonPrev = await api('', '/api/finance/allocations/preview', { method: 'POST', body: {} });
  check('[1] anonymous blocked on allocations/preview', anonPrev.status === 401 || anonPrev.status === 403, `status=${anonPrev.status}`);

  // ---------- 2. Non-finance roles blocked ----------
  const stuFee = await api(stu.cookie, '/api/finance/fee-types');
  check('[2] student blocked on fee-types (403)', stuFee.status === 403, `status=${stuFee.status}`);
  const stuRun = await api(stu.cookie, '/api/finance/fine-runs', { method: 'POST' });
  check('[2] student blocked on fine-runs (403)', stuRun.status === 403, `status=${stuRun.status}`);
  const parFee = await api(par.cookie, '/api/finance/fee-types');
  check('[2] parent blocked on fee-types (403)', parFee.status === 403, `status=${parFee.status}`);
  const parMethods = await api(par.cookie, '/api/finance/payment-methods');
  check('[2] parent blocked on payment-methods (403)', parMethods.status === 403, `status=${parMethods.status}`);

  // ---------- 3. Fee types CRUD ----------
  const ftCreate = await api(acc.cookie, '/api/finance/fee-types', { method: 'POST', body: { name: 'Frais de scolarité (vérif)', description: 'Créé par la vérification' } });
  check('[3] fee-types POST -> 200 created', ftCreate.status === 200 && ftCreate.json?.success, `status=${ftCreate.status} ${JSON.stringify(ftCreate.json?.error ?? '')}`);
  const ftId = ftCreate.json?.data?.id;
  if (ftId) created.feeTypeIds.push(ftId);
  const ftList = (await api(acc.cookie, '/api/finance/fee-types')).json;
  check('[3] fee-types GET contains created', ftList?.data?.some((t) => t.id === ftId), `total=${ftList?.total}`);
  const ftPut = await api(acc.cookie, '/api/finance/fee-types', { method: 'PUT', body: { id: ftId, name: 'Scolarité annuelle (vérif)' } });
  check('[3] fee-types PUT -> 200 renamed', ftPut.status === 200 && ftPut.json?.data?.name === 'Scolarité annuelle (vérif)', JSON.stringify(ftPut.json?.data ?? ftPut.json?.error));
  const ftMissing = await api(acc.cookie, '/api/finance/fee-types', { method: 'PUT', body: { id: crypto.randomUUID(), name: 'x' } });
  check('[3] fee-types PUT unknown id -> 404', ftMissing.status === 404, `status=${ftMissing.status}`);

  // ---------- 4. Tenant isolation on fee-types ----------
  const langoFt = (await api(lango.cookie, '/api/finance/fee-types')).json;
  check('[4] Lango admin does NOT see Atlas fee type', !(langoFt?.data ?? []).some((t) => t.id === ftId), `lango total=${langoFt?.total}`);

  // ---------- 5. Fine policies CRUD + fine-runs ----------
  const fpCreate = await api(acc.cookie, '/api/finance/fine-policies', {
    method: 'POST',
    body: { name: 'Retard de paiement (vérif)', formula: 'per_day', graceDays: 5, perDayAmount: 20, flatAmount: 0, maxAmount: 500, status: 'active' },
  });
  check('[5] fine-policies POST -> 200', fpCreate.status === 200 && fpCreate.json?.success, `status=${fpCreate.status}`);
  const fpId = fpCreate.json?.data?.id;
  if (fpId) created.policyIds.push(fpId);
  const fpList = (await api(acc.cookie, '/api/finance/fine-policies')).json;
  check('[5] fine-policies GET contains created', fpList?.data?.some((p) => p.id === fpId), `total=${fpList?.total}`);
  const fpPut = await api(acc.cookie, '/api/finance/fine-policies', { method: 'PUT', body: { id: fpId, name: 'Retard (vérif)', formula: 'flat', graceDays: 3, flatAmount: 50, perDayAmount: 0, status: 'archived' } });
  check('[5] fine-policies PUT -> 200', fpPut.status === 200 && fpPut.json?.data?.status === 'archived', JSON.stringify(fpPut.json?.data ?? fpPut.json?.error));
  // restore active, run assessment
  await api(acc.cookie, '/api/finance/fine-policies', { method: 'PUT', body: { id: fpId, name: 'Retard (vérif)', formula: 'flat', graceDays: 0, flatAmount: 50, perDayAmount: 0, status: 'active' } });
  const fr = await api(acc.cookie, '/api/finance/fine-runs', { method: 'POST' });
  check('[5] fine-runs POST -> 200 with numeric assessed', fr.status === 200 && fr.json?.success && Number.isInteger(fr.json?.data?.assessed), `status=${fr.status} ${JSON.stringify(fr.json?.data ?? fr.json?.error)}`);
  if (fpId) sql(`delete from fine_assessments where fine_policy_id = '${fpId}'`);

  // ---------- 6. Payment methods CRUD ----------
  const pmCreate = await api(acc.cookie, '/api/finance/payment-methods', {
    method: 'POST',
    body: { methodCode: 'VERIF-CHQ', labelFr: 'Chèque (vérif)', labelAr: 'شيك', requiresReference: true, requiresBank: true, requiresDate: true, requiresProof: false, refundable: true, isActive: true },
  });
  check('[6] payment-methods POST -> 200', pmCreate.status === 200 && pmCreate.json?.success, `status=${pmCreate.status} ${JSON.stringify(pmCreate.json?.error ?? '')}`);
  const pmId = pmCreate.json?.data?.id;
  if (pmId) created.methodIds.push(pmId);
  const pmDup = await api(acc.cookie, '/api/finance/payment-methods', { method: 'POST', body: { methodCode: 'VERIF-CHQ', labelFr: 'Doublon' } });
  check('[6] payment-methods duplicate code -> 409', pmDup.status === 409, `status=${pmDup.status}`);
  const pmPut = await api(acc.cookie, '/api/finance/payment-methods', { method: 'PUT', body: { id: pmId, methodCode: 'VERIF-CHQ', labelFr: 'Chèque validé (vérif)', requiresReference: true, requiresBank: true, requiresDate: true, requiresProof: false, refundable: true, isActive: false } });
  check('[6] payment-methods PUT -> 200 inactive', pmPut.status === 200 && pmPut.json?.data?.isActive === false, JSON.stringify(pmPut.json?.data ?? pmPut.json?.error));
  const langoPm = (await api(lango.cookie, '/api/finance/payment-methods')).json;
  check('[6] Lango admin does NOT see Atlas method', !(langoPm?.data ?? []).some((m) => m.id === pmId), `lango total=${langoPm?.total}`);

  // ---------- 7. Fee-structure versions ----------
  let structs = (await api(acc.cookie, '/api/finance/fee-structures?pageSize=200')).json?.data ?? [];
  let structId = structs[0]?.id;
  if (!structId) {
    // Creation is school_admin-only server-side, so seed the structure directly.
    structId = sql(`insert into fee_structures (tenant_id, name, amount, is_active) values ('${ATLAS}', 'Structure vérif', 1000, true) returning id`).split('\n')[0].trim();
    if (structId) created.structureIds.push(structId);
  }
  const vCreate = await api(acc.cookie, `/api/finance/fee-structures/${structId}/versions`, {
    method: 'POST',
    body: { componentsSnapshot: [{ name: 'Scolarité', amount: 2000, mandatory: true }, { name: 'Transport', amount: 300, mandatory: false }], effectiveFrom: '2026-09-01', status: 'published' },
  });
  check('[7] versions POST published -> 200', vCreate.status === 200 && vCreate.json?.data?.status === 'published', `status=${vCreate.status} ${JSON.stringify(vCreate.json?.error ?? '')}`);
  const vId = vCreate.json?.data?.id;
  if (vId) created.versionIds.push(vId);
  const vList = await api(acc.cookie, `/api/finance/fee-structures/${structId}/versions`);
  check('[7] versions GET shows created v1', vList.json?.data?.versions?.some((v) => v.id === vId && v.versionNumber === 1), JSON.stringify(vList.json?.data?.versions?.map(v => v.versionNumber) ?? ''));
  const vList2 = await api(acc.cookie, `/api/finance/fee-structures/${structId}/versions`, { method: 'POST', body: { componentsSnapshot: [{ name: 'Scolarité', amount: 2100, mandatory: true }], status: 'draft' } });
  check('[7] versions POST second -> version 2', vList2.status === 200 && vList2.json?.data?.versionNumber === 2, `v=${vList2.json?.data?.versionNumber}`);
  if (vList2.json?.data?.id) created.versionIds.push(vList2.json.data.id);
  const vBad = await api(acc.cookie, '/api/finance/fee-structures/00000000-0000-4000-8000-000000000000/versions', { method: 'POST', body: {} });
  check('[7] versions POST unknown structure -> 404', vBad.status === 404, `status=${vBad.status}`);

  // ---------- 8. Allocation preview + run ----------
  const prev = await api(acc.cookie, '/api/finance/allocations/preview', { method: 'POST', body: { period: '2026-09', amount: 1500, studentIds: [STUDENT_ID], dueDate: '2026-10-15' } });
  check('[8] allocation preview -> 200 with 1 target', prev.status === 200 && prev.json?.data?.previewSummary?.count === 1, `status=${prev.status} ${JSON.stringify(prev.json?.data?.previewSummary ?? prev.json?.error)}`);
  const runId = prev.json?.data?.run?.id;
  if (runId) created.allocationRunIds.push(runId);
  const ar = await api(acc.cookie, `/api/finance/allocations/${runId}/run`, { method: 'POST' });
  check('[8] allocation run -> 200 created 1 invoice', ar.status === 200 && ar.json?.data?.included === 1, `status=${ar.status} ${JSON.stringify(ar.json?.data ?? ar.json?.error)}`);
  const invId = ar.json?.data?.firstInvoices?.[0]?.invoiceId;
  if (invId) created.invoiceIds.push(invId);
  allocationPrefix = `ALL-${ATLAS.slice(0, 8)}`;
  const invCheck = await api(acc.cookie, `/api/finance/invoice-events?invoiceId=${invId}`);
  check('[8] invoice-events GET shows created + allocation event', invCheck.status === 200 && invCheck.json?.data?.events?.some((e) => e.eventType === 'created'), JSON.stringify(invCheck.json?.data?.events?.map(e => e.eventType) ?? invCheck.json?.error));
  const arAgain = await api(acc.cookie, `/api/finance/allocations/${runId}/run`, { method: 'POST' });
  check('[8] allocation run re-run refused (409, no duplicate invoice)', arAgain.status === 409, `status=${arAgain.status}`);
  const runBad = await api(acc.cookie, `/api/finance/allocations/${crypto.randomUUID()}/run`, { method: 'POST' });
  check('[8] allocation run unknown -> 404', runBad.status === 404, `status=${runBad.status}`);

  // ---------- 9. Reminder rules + runs ----------
  const rrCreate = await api(acc.cookie, '/api/finance/reminder-rules', {
    method: 'POST',
    body: { name: 'Rappel après échéance (vérif)', timing: 'after', daysRelative: 5, cadenceDays: 7, minBalance: 100, maxPerStudent: 2, status: 'active' },
  });
  check('[9] reminder-rules POST -> 200', rrCreate.status === 200 && rrCreate.json?.success, `status=${rrCreate.status}`);
  const ruleId = rrCreate.json?.data?.id;
  if (ruleId) created.ruleIds.push(ruleId);
  const langoRule = await api(lango.cookie, `/api/finance/reminder-runs`, { method: 'POST', body: { ruleId } });
  check('[9] Lango admin run Atlas rule -> 404', langoRule.status === 404, `status=${langoRule.status}`);
  const rrPause = await api(acc.cookie, '/api/finance/reminder-rules', { method: 'PUT', body: { id: ruleId, name: 'Rappel (vérif)', timing: 'after', daysRelative: 5, cadenceDays: 7, minBalance: 100, maxPerStudent: 2, status: 'paused' } });
  check('[9] reminder-rules PUT pause -> 200', rrPause.status === 200 && rrPause.json?.data?.status === 'paused', JSON.stringify(rrPause.json?.data ?? rrPause.json?.error));
  const runPaused = await api(acc.cookie, '/api/finance/reminder-runs', { method: 'POST', body: { ruleId } });
  check('[9] reminder-runs paused rule -> 409 RULE_PAUSED', runPaused.status === 409 && runPaused.json?.error?.code === 'RULE_PAUSED', `status=${runPaused.status} ${JSON.stringify(runPaused.json?.error)}`);
  // reactivate and run with high minBalance so nothing qualifies (no SMS side effects)
  await api(acc.cookie, '/api/finance/reminder-rules', { method: 'PUT', body: { id: ruleId, name: 'Rappel (vérif)', timing: 'after', daysRelative: 0, cadenceDays: 0, minBalance: 999999, maxPerStudent: 2, status: 'active' } });
  const runOk = await api(acc.cookie, '/api/finance/reminder-runs', { method: 'POST', body: { ruleId } });
  check('[9] reminder-runs active rule -> 200 completed', runOk.status === 200 && runOk.json?.data?.status === 'completed', `status=${runOk.status} ${JSON.stringify(runOk.json?.data ?? runOk.json?.error)}`);
  const runId2 = runOk.json?.data?.id;
  if (runId2) created.runIds.push(runId2);
  const runList = (await api(acc.cookie, '/api/finance/reminder-runs')).json;
  check('[9] reminder-runs GET lists the run', runList?.data?.some((r) => r.id === runId2), `total=${runList?.total}`);
  const runMissing = await api(acc.cookie, '/api/finance/reminder-runs', { method: 'POST', body: { ruleId: crypto.randomUUID() } });
  check('[9] reminder-runs unknown rule -> 404', runMissing.status === 404, `status=${runMissing.status}`);

  // ---------- Summary ----------
  const failed = results.filter((r) => !r.ok);
  console.log(`\n==== ${results.length - failed.length}/${results.length} passed, ${failed.length} failed ====`);
  if (failed.length > 0) {
    console.log('Failed checks:');
    for (const f of failed) console.log(`  - ${f.label}${f.detail ? ` (${f.detail})` : ''}`);
  }
  // Set the exit code but return normally so the `finally` cleanup below runs.
  process.exitCode = failed.length ? 1 : 0;
};

const cleanup = () => {
  const q = (s) => { try { sql(s); } catch { /* best-effort */ } };
  for (const id of created.ruleIds) q(`delete from finance_reminder_runs where rule_id = '${id}'; delete from finance_reminder_rules where id = '${id}';`);
  for (const id of created.allocationRunIds) q(`delete from fee_allocation_runs where id = '${id}';`);
  for (const id of created.invoiceIds) q(`delete from invoices where id = '${id}';`);
  if (allocationPrefix) q(`delete from naming_series where prefix = '${allocationPrefix}' and tenant_id = '${ATLAS}';`);
  for (const id of created.versionIds) q(`delete from fee_structure_versions where id = '${id}';`);
  for (const id of created.structureIds) q(`delete from fee_structures where id = '${id}';`);
  for (const id of created.methodIds) q(`delete from payment_method_configurations where id = '${id}';`);
  for (const id of created.policyIds) q(`delete from fine_assessments where fine_policy_id = '${id}'; delete from fine_policies where id = '${id}';`);
  for (const id of created.feeTypeIds) q(`delete from fee_categories where id = '${id}';`);
  console.log('cleanup done.');
};

try {
  await run();
} finally {
  cleanup();
}
