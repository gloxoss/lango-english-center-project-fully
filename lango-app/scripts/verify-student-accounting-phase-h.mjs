// Live acceptance verification for Student Accounting Phase H (per-tenant
// currency, configurable payment methods, CMI NAPS gateway sessions, offline
// field enforcement, CSV/XLSX journal export + ERP push adapters).
// Run against the docker app (:3000). All rows created here are removed via
// psql afterward. Requires docker + schoolos-db + app up.
// Run: node scripts/verify-student-accounting-phase-h.mjs
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
  try { json = JSON.parse(text); } catch { /* not json (e.g. CSV/XLSX) */ }
  return { status: res.status, json, text, headers: res.headers };
}

const created = { configIds: [], invoiceIds: [], paymentIds: [], sessionIds: [] };

const run = async () => {
  const admin = await signIn('y.elamrani@atlas.ma', 'Admin123!');

  const studentId = sql(`SELECT id FROM "user" WHERE tenant_id='${TENANT}' AND role='student' LIMIT 1`);
  check('found a student', Boolean(studentId), studentId);

  // -------------------------------------------------------------------------
  // H1 — per-tenant base currency
  // -------------------------------------------------------------------------
  const setCurrency = await api(admin.cookie, '/api/settings/values', {
    method: 'POST',
    body: { settings: [{ key: 'finance.currency', value: 'EUR' }] },
  });
  check('[H1] set finance.currency → EUR', setCurrency.status === 200 && setCurrency.json?.success === true, `status=${setCurrency.status}`);

  // -------------------------------------------------------------------------
  // H2 — configurable payment methods
  // -------------------------------------------------------------------------
  const onlineMethod = await api(admin.cookie, '/api/finance/payment-methods', {
    method: 'POST',
    body: { methodCode: 'cmi-h', labelFr: 'Carte bancaire (CMI) — vérif H', provider: 'cmi-naps', gatewayMode: 'sandbox' },
  });
  const onlineMethodId = onlineMethod.json?.data?.id;
  if (onlineMethodId) created.configIds.push(onlineMethodId);
  check('[H2] create online method (provider cmi-naps) → 200', onlineMethod.status === 200 && Boolean(onlineMethodId), `status=${onlineMethod.status}`);

  const inactiveMethod = await api(admin.cookie, '/api/finance/payment-methods', {
    method: 'POST',
    body: { methodCode: 'inactive-h', labelFr: 'Méthode inactive — vérif H', isActive: false },
  });
  const inactiveMethodId = inactiveMethod.json?.data?.id;
  if (inactiveMethodId) created.configIds.push(inactiveMethodId);
  check('[H2] create inactive method → 200', inactiveMethod.status === 200 && Boolean(inactiveMethodId), `status=${inactiveMethod.status}`);

  // -------------------------------------------------------------------------
  // H4 — offline method field enforcement (transfer requires a reference)
  // -------------------------------------------------------------------------
  const transferMethod = await api(admin.cookie, '/api/finance/payment-methods', {
    method: 'POST',
    body: { methodCode: 'transfer-h', labelFr: 'Virement — vérif H', requiresReference: true },
  });
  const transferMethodId = transferMethod.json?.data?.id;
  if (transferMethodId) created.configIds.push(transferMethodId);
  check('[H4] create transfer method (requiresReference) → 200', transferMethod.status === 200 && Boolean(transferMethodId), `status=${transferMethod.status}`);

  const invoice = await api(admin.cookie, '/api/finance/invoices', {
    method: 'POST',
    body: { studentId, amount: 300, dueDate: '2026-12-31', items: [{ description: 'Frais Phase H', amount: '300' }] },
  });
  const invoiceId = invoice.json?.data?.id;
  if (invoiceId) created.invoiceIds.push(invoiceId);
  check('[H2] create invoice → 200', invoice.status === 200 && Boolean(invoiceId), `status=${invoice.status}`);

  const payInactive = await api(admin.cookie, '/api/finance/payments', {
    method: 'POST',
    body: { allocations: [{ invoiceId, amount: '300.00' }], paymentMethod: 'inactive-h' },
  });
  check('[H2] payment with inactive method → 422 PAYMENT_METHOD_INACTIVE', payInactive.status === 422 && payInactive.json?.error?.code === 'PAYMENT_METHOD_INACTIVE', `status=${payInactive.status} code=${payInactive.json?.error?.code}`);

  const payNoRef = await api(admin.cookie, '/api/finance/payments', {
    method: 'POST',
    body: { allocations: [{ invoiceId, amount: '300.00' }], paymentMethod: 'transfer-h' },
  });
  check('[H4] transfer without reference → 422 PAYMENT_REFERENCE_REQUIRED', payNoRef.status === 422 && payNoRef.json?.error?.code === 'PAYMENT_REFERENCE_REQUIRED', `status=${payNoRef.status} code=${payNoRef.json?.error?.code}`);

  // -------------------------------------------------------------------------
  // H3 — online gateway session (sandbox) + callback
  // -------------------------------------------------------------------------
  const start = await api(admin.cookie, '/api/finance/payments/online', {
    method: 'POST',
    body: { invoiceId, paymentMethod: 'cmi-h' },
  });
  const extRef = start.json?.data?.externalReference;
  const sessionId = start.json?.data?.sessionId;
  if (sessionId) created.sessionIds.push(sessionId);
  check('[H3] POST /payments/online → externalReference + pending session', start.status === 200 && /^GW-/.test(extRef ?? '') && Boolean(sessionId), `status=${start.status} ref=${extRef}`);

  const pending = Number(sql(`SELECT count(*) FROM payment_gateway_sessions WHERE id='${sessionId}' AND status='pending'`));
  check('[H3] session persisted pending', pending === 1, `pending=${pending}`);

  const callback = await api('', '/api/finance/payments/online/callback', {
    method: 'POST',
    body: { externalReference: extRef, amount: 300, currency: 'EUR', status: 'paid' },
  });
  const paymentId = callback.json?.data?.paymentId;
  if (paymentId) created.paymentIds.push(paymentId);
  check('[H3] paid callback → payment posted', callback.status === 200 && Boolean(paymentId), `status=${callback.status} paymentId=${paymentId}`);

  const invoicePaid = Number(sql(`SELECT paid_amount FROM invoices WHERE id='${invoiceId}'`));
  check('[H3] invoice paidAmount reduced to 300', invoicePaid === 300, `paid=${invoicePaid}`);

  // -------------------------------------------------------------------------
  // H5 — accounting export (CSV with EUR) + ERP push stubs
  // -------------------------------------------------------------------------
  const csv = await api(admin.cookie, '/api/finance/exports/journal?format=csv');
  check('[H5] GET journal CSV → 200 + EUR rows', csv.status === 200 && csv.text.includes('EUR'), `status=${csv.status} hasEUR=${csv.text.includes('EUR')}`);

  const xlsx = await api(admin.cookie, '/api/finance/exports/journal?format=xlsx');
  const xlsxType = xlsx.headers.get?.('content-type') ?? '';
  check('[H5] GET journal XLSX → 200 + xlsx mime', xlsx.status === 200 && xlsxType.includes('spreadsheetml'), `status=${xlsx.status} type=${xlsxType}`);

  const push = await api(admin.cookie, '/api/finance/exports/journal/push', {
    method: 'POST',
    body: { target: 'dammancom' },
  });
  check('[H5] push DAMANCOM → 501 ERP_NOT_IMPLEMENTED', push.status === 501 && push.json?.error?.code === 'ERP_NOT_IMPLEMENTED', `status=${push.status} code=${push.json?.error?.code}`);

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------
  if (created.paymentIds.length) {
    const pids = created.paymentIds.map((id) => `'${id}'`).join(',');
    sql(`DELETE FROM payment_allocations WHERE payment_id IN (${pids})`);
    sql(`DELETE FROM payments WHERE id IN (${pids})`);
  }
  if (created.sessionIds.length) {
    const sids = created.sessionIds.map((id) => `'${id}'`).join(',');
    sql(`DELETE FROM payment_gateway_sessions WHERE id IN (${sids})`);
  }
  if (created.invoiceIds.length) {
    const ids = created.invoiceIds.map((id) => `'${id}'`).join(',');
    sql(`DELETE FROM invoice_events WHERE invoice_id IN (${ids})`);
    sql(`DELETE FROM invoice_items WHERE invoice_id IN (${ids})`);
    sql(`DELETE FROM invoices WHERE id IN (${ids})`);
  }
  if (created.configIds.length) {
    const cids = created.configIds.map((id) => `'${id}'`).join(',');
    sql(`DELETE FROM payment_method_configurations WHERE id IN (${cids})`);
  }
  // Restore default currency.
  await api(admin.cookie, '/api/settings/values', {
    method: 'POST',
    body: { settings: [{ key: 'finance.currency', value: 'MAD' }] },
  });

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
};

run().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
