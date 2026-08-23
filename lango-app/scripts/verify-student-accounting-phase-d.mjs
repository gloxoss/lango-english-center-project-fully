// Live acceptance verification for Student Accounting Phase D (invoice
// lifecycle + multi-invoice payment allocations + receipts + statements).
// Run against the docker app (:3000). All rows created here are removed via
// psql afterward.
// Run: node scripts/verify-student-accounting-phase-d.mjs
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

const created = { invoiceIds: [] };

const run = async () => {
  const admin = await signIn('y.elamrani@atlas.ma', 'Admin123!');
  const studentId = sql(`SELECT id FROM "user" WHERE tenant_id='${TENANT}' AND role='student' LIMIT 1`);
  check('found a student', Boolean(studentId), studentId);

  const dueDate = '2026-12-31';

  // 1. Draft → issue
  const draft = await api(admin.cookie, '/api/finance/invoices', {
    method: 'POST',
    body: { studentId, amount: 400, dueDate, status: 'draft', items: [{ description: 'Frais de scolarité', amount: '400' }] },
  });
  check('[1] create draft invoice', draft.status === 200 && draft.json?.data?.status === 'draft', `status=${draft.status}`);
  const draftId = draft.json?.data?.id;
  if (draftId) created.invoiceIds.push(draftId);
  const issue = await api(admin.cookie, `/api/finance/invoices/${draftId}/issue`, { method: 'PUT' });
  check('[1] issue draft → pending', issue.status === 200 && issue.json?.data?.status === 'pending', `status=${issue.status}`);

  // 2. Second invoice + multi-invoice split payment → receipt
  const second = await api(admin.cookie, '/api/finance/invoices', {
    method: 'POST',
    body: { studentId, amount: 200, dueDate, items: [{ description: 'Frais de transport', amount: '200' }] },
  });
  const secondId = second.json?.data?.id;
  if (secondId) created.invoiceIds.push(secondId);
  const pay = await api(admin.cookie, '/api/finance/payments', {
    method: 'POST',
    body: {
      allocations: [
        { invoiceId: draftId, amount: '250.00' },
        { invoiceId: secondId, amount: '150.00' },
      ],
      paymentMethod: 'card',
    },
  });
  check('[2] multi-invoice split payment', pay.status === 200 && pay.json?.success === true, `status=${pay.status}`);
  check('[2] receipt RC-numbered', Boolean(pay.json?.data?.receipt?.receiptNumber?.startsWith(`RC-${new Date().getFullYear()}-`)), pay.json?.data?.receipt?.receiptNumber);
  const receiptId = pay.json?.data?.receipt?.id;

  // 3. Receipt list + detail read-back
  const receipts = await api(admin.cookie, '/api/finance/receipts');
  check('[3] receipts list', receipts.status === 200 && Array.isArray(receipts.json?.data), `count=${receipts.json?.data?.length}`);
  const receiptDetail = receiptId ? await api(admin.cookie, `/api/finance/receipts/${receiptId}`) : null;
  check('[3] receipt detail', receiptDetail?.status === 200 && Array.isArray(receiptDetail.json?.data?.allocations), `allocations=${receiptDetail?.json?.data?.allocations?.length}`);

  // 4. Overpay → 409
  const overpay = await api(admin.cookie, '/api/finance/payments', {
    method: 'POST',
    body: { allocations: [{ invoiceId: draftId, amount: '9999.00' }], paymentMethod: 'cash' },
  });
  check('[4] overpay → 409 PAYMENT_EXCEEDS_BALANCE', overpay.status === 409 && overpay.json?.error?.code === 'PAYMENT_EXCEEDS_BALANCE', `status=${overpay.status}`);

  // 5. Credit a fully-paid invoice → 409
  const third = await api(admin.cookie, '/api/finance/invoices', {
    method: 'POST',
    body: { studentId, amount: 100, dueDate, items: [{ description: 'Frais divers', amount: '100' }] },
  });
  const thirdId = third.json?.data?.id;
  if (thirdId) created.invoiceIds.push(thirdId);
  await api(admin.cookie, '/api/finance/payments', { method: 'POST', body: { allocations: [{ invoiceId: thirdId, amount: '100.00' }], paymentMethod: 'transfer' } });
  const creditPaid = await api(admin.cookie, `/api/finance/invoices/${thirdId}/credit`, { method: 'POST' });
  check('[5] credit paid invoice → 409', creditPaid.status === 409 && creditPaid.json?.error?.code === 'INVOICE_NOT_CREDITABLE', `status=${creditPaid.status}`);

  // 6. Cancel a pending invoice
  const fourth = await api(admin.cookie, '/api/finance/invoices', {
    method: 'POST',
    body: { studentId, amount: 50, dueDate, items: [{ description: 'Frais annulable', amount: '50' }] },
  });
  const fourthId = fourth.json?.data?.id;
  if (fourthId) created.invoiceIds.push(fourthId);
  const cancel = await api(admin.cookie, `/api/finance/invoices/${fourthId}/cancel`, { method: 'PUT' });
  check('[6] cancel pending invoice', cancel.status === 200 && cancel.json?.data?.status === 'cancelled', `status=${cancel.status}`);

  // 7. Statement math (opening + charges − credits = closing)
  const stmt = await api(admin.cookie, `/api/finance/statements?studentId=${studentId}`);
  const s = stmt.json?.data;
  const equationOk = s && (s.openingBalance + s.chargesTotal - s.creditsTotal) === s.closingBalance;
  check('[7] statement equation holds', stmt.status === 200 && equationOk === true, `opening=${s?.openingBalance} charges=${s?.chargesTotal} credits=${s?.creditsTotal} closing=${s?.closingBalance}`);

  // 8. Deprecated allocations POST → 410
  const allocPost = await api(admin.cookie, '/api/finance/allocations', { method: 'POST', body: {} });
  check('[8] POST /api/finance/allocations → 410', allocPost.status === 410, `status=${allocPost.status}`);

  // Cleanup
  if (created.invoiceIds.length) {
    const ids = created.invoiceIds.map((id) => `'${id}'`).join(',');
    sql(`DELETE FROM receipts WHERE student_id='${studentId}'`);
    sql(`DELETE FROM payment_allocations WHERE payment_id IN (SELECT id FROM payments WHERE invoice_id IN (${ids}))`);
    sql(`DELETE FROM payments WHERE invoice_id IN (${ids})`);
    sql(`DELETE FROM invoice_events WHERE invoice_id IN (${ids})`);
    sql(`DELETE FROM invoice_items WHERE invoice_id IN (${ids})`);
    sql(`DELETE FROM invoices WHERE id IN (${ids})`);
    sql(`DELETE FROM student_credits WHERE student_id='${studentId}' AND source='invoice_credit'`);
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
};

run().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
