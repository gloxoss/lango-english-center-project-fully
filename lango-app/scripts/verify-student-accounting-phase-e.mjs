// Live acceptance verification for Student Accounting Phase E (payment
// reversals, refund linkage, cashier close + reconcile, credits API).
// Run against the docker app (:3000). All rows created here are removed via
// psql afterward.
// Run: node scripts/verify-student-accounting-phase-e.mjs
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

const created = { invoiceIds: [], paymentIds: [], sessionIds: [] };

const run = async () => {
  const admin = await signIn('y.elamrani@atlas.ma', 'Admin123!');
  const studentId = sql(`SELECT id FROM "user" WHERE tenant_id='${TENANT}' AND role='student' LIMIT 1`);
  check('found a student', Boolean(studentId), studentId);
  const dueDate = '2026-12-31';

  // 1. Create + pay an invoice, then reverse the payment.
  const invA = await api(admin.cookie, '/api/finance/invoices', {
    method: 'POST',
    body: { studentId, amount: 200, dueDate, items: [{ description: 'Frais Phase E', amount: '200' }] },
  });
  const invAId = invA.json?.data?.id;
  if (invAId) created.invoiceIds.push(invAId);
  const payA = await api(admin.cookie, '/api/finance/payments', {
    method: 'POST',
    body: { allocations: [{ invoiceId: invAId, amount: '200.00' }], paymentMethod: 'card' },
  });
  const paymentAId = payA.json?.data?.payment?.id;
  if (paymentAId) created.paymentIds.push(paymentAId);
  check('[1] create + pay invoice A', payA.status === 200 && Boolean(paymentAId), `status=${payA.status}`);

  const reverse = await api(admin.cookie, `/api/finance/payments/${paymentAId}/reverse`, {
    method: 'POST',
    body: { reason: 'Vérification Phase E' },
  });
  check('[1] reverse payment → 201 approved', reverse.status === 201 && reverse.json?.data?.status === 'approved', `status=${reverse.status}`);
  const payAStatus = sql(`SELECT status FROM payments WHERE id='${paymentAId}'`);
  check('[1] payment marked reversed', payAStatus === 'reversed', payAStatus);
  const invAPaid = sql(`SELECT paid_amount FROM invoices WHERE id='${invAId}'`);
  check('[1] invoice A balance restored', Number(invAPaid) === 0, `paid_amount=${invAPaid}`);

  // 2. Pay a second invoice, then refund part of it.
  const invB = await api(admin.cookie, '/api/finance/invoices', {
    method: 'POST',
    body: { studentId, amount: 100, dueDate, items: [{ description: 'Frais Phase E B', amount: '100' }] },
  });
  const invBId = invB.json?.data?.id;
  if (invBId) created.invoiceIds.push(invBId);
  const payB = await api(admin.cookie, '/api/finance/payments', {
    method: 'POST',
    body: { allocations: [{ invoiceId: invBId, amount: '100.00' }], paymentMethod: 'card' },
  });
  const paymentBId = payB.json?.data?.payment?.id;
  if (paymentBId) created.paymentIds.push(paymentBId);

  const refund = await api(admin.cookie, '/api/finance/refunds', {
    method: 'POST',
    body: { studentId, paymentId: paymentBId, amount: '60.00', refundMethod: 'cash', reason: 'Vérification Phase E' },
  });
  check('[2] refund payment → 201', refund.status === 201, `status=${refund.status}`);
  const payBStatus = sql(`SELECT status FROM payments WHERE id='${paymentBId}'`);
  check('[2] payment marked refunded', payBStatus === 'refunded', payBStatus);
  const invBPaid = sql(`SELECT paid_amount FROM invoices WHERE id='${invBId}'`);
  check('[2] invoice B reduced to 40', Number(invBPaid) === 40, `paid_amount=${invBPaid}`);

  // 3. Open + close a cashier session (variance path).
  const open = await api(admin.cookie, '/api/accountant/me/cashier', {
    method: 'POST',
    body: { startingFloat: 100 },
  });
  const sessionId = open.json?.data?.id;
  if (sessionId) created.sessionIds.push(sessionId);
  check('[3] open cashier session', open.status === 201 && Boolean(sessionId), `status=${open.status}`);

  const close = await api(admin.cookie, `/api/finance/cashier-sessions/${sessionId}/close`, {
    method: 'POST',
    body: { actualCash: 150 },
  });
  check('[3] close session → 200 variance +50', close.status === 200, `status=${close.status}`);
  const closingRow = sql(`SELECT expected_cash||'|'||actual_cash||'|'||variance FROM cashier_closings WHERE cashier_session_id='${sessionId}' LIMIT 1`);
  check('[3] cashier_closings snapshot written', closingRow === '100.00|150.00|50.00', closingRow);

  // 4. Reconcile the closed session.
  const reconcile = await api(admin.cookie, `/api/finance/cashier-sessions/${sessionId}/reconcile`, { method: 'POST' });
  check('[4] reconcile session → 200', reconcile.status === 200, `status=${reconcile.status}`);
  const sessionStatus = sql(`SELECT status FROM cashier_sessions WHERE id='${sessionId}'`);
  check('[4] session reconciled', sessionStatus === 'reconciled', sessionStatus);

  // 5. Credits API returns success (list, tenant-scoped).
  const credits = await api(admin.cookie, `/api/finance/credits?studentId=${studentId}`);
  check('[5] GET /api/finance/credits → success + array', credits.status === 200 && Array.isArray(credits.json?.data), `count=${credits.json?.data?.length}`);

  // Cleanup
  if (created.paymentIds.length) {
    const pids = created.paymentIds.map((id) => `'${id}'`).join(',');
    sql(`DELETE FROM refunds WHERE payment_id IN (${pids})`);
    sql(`DELETE FROM payment_reversals WHERE payment_id IN (${pids})`);
    sql(`DELETE FROM payment_allocations WHERE payment_id IN (${pids})`);
    sql(`DELETE FROM payments WHERE id IN (${pids})`);
  }
  if (created.sessionIds.length) {
    const sids = created.sessionIds.map((id) => `'${id}'`).join(',');
    sql(`DELETE FROM cashier_closings WHERE cashier_session_id IN (${sids})`);
    sql(`DELETE FROM cashier_sessions WHERE id IN (${sids})`);
  }
  if (created.invoiceIds.length) {
    const ids = created.invoiceIds.map((id) => `'${id}'`).join(',');
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
