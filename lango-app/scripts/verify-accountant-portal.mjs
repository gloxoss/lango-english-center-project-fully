// Live acceptance verification for the Accountant Portal cleanup (#14).
// Verifies: role/capability gates on /api/accountant/me/* (parents with
// finance.read must NOT read tenant-wide finance data), real /api/accountant/
// me/home KPIs, tenant-scoped overdue list on /api/finance/reminders, POST
// reminder send (happy path + isolation). Uses docker exec psql for the
// temporary guardian link used by the happy-path POST, cleaned up afterward.
// Run against the live dev server (:3002).
// Run: node scripts/verify-accountant-portal.mjs
import { execSync } from 'node:child_process';

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3002';
const ORIGIN = 'http://localhost:3000';

const ATLAS = 'ca40c88e-339c-4fea-b5c4-51d5c9cc0239';
const GUARDIAN_ID = '2cbbd2c0-cb9c-4822-8b53-e8faa2d6b65b'; // Vrf Parent (PRN-CHILD-A)
const TEST_LINK_ID = '00000000-0000-4000-8000-00000000f002';

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
  const body = await res.json().catch(() => ({}));
  if (!setCookies) throw new Error(`sign-in for ${email} returned no cookie (${res.status} ${JSON.stringify(body).slice(0, 200)})`);
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

const STUDENT = { email: 'prn-prn-child-a@placeholder.local', password: 'ParentAdmin123!' };
const PARENT = { email: 'prn-prn-parent-a@placeholder.local', password: 'ParentAdmin123!' };
const ACCOUNTANT = { email: 'accountant@atlas.ma', password: 'Admin123!' };

const run = async () => {
  const acc = await signIn(ACCOUNTANT.email, ACCOUNTANT.password);

  // ---------- Item 1: auth guards ----------
  const anonHome = await api('', '/api/accountant/me/home');
  check('[1] unauthenticated blocked on accountant/home', anonHome.status === 401 || anonHome.status === 403, `status=${anonHome.status}`);
  const anonRem = await api('', '/api/finance/reminders');
  check('[1] unauthenticated blocked on finance/reminders', anonRem.status === 401 || anonRem.status === 403, `status=${anonRem.status}`);

  // ---------- Item 2: non-finance roles blocked ----------
  const stu = await signIn(STUDENT.email, STUDENT.password);
  const stuHome = await api(stu.cookie, '/api/accountant/me/home');
  check('[2] student blocked on accountant/home (403)', stuHome.status === 403, `status=${stuHome.status}`);
  const stuRem = await api(stu.cookie, '/api/finance/reminders');
  check('[2] student blocked on finance/reminders (403)', stuRem.status === 403, `status=${stuRem.status}`);

  // ---------- Item 3: parent (finance.read, not accountant role) blocked ----------
  const par = await signIn(PARENT.email, PARENT.password);
  const parHome = await api(par.cookie, '/api/accountant/me/home');
  check('[3] parent blocked on accountant/home (403) — role gate', parHome.status === 403, `status=${parHome.status}`);
  const parRem = await api(par.cookie, '/api/finance/reminders');
  check('[3] parent blocked on finance/reminders (403)', parRem.status === 403, `status=${parRem.status}`);

  // ---------- Item 4: accountant home KPIs match real Atlas data ----------
  const home = (await api(acc.cookie, '/api/accountant/me/home')).json;
  check('[4] home: pendingOverdueInvoicesCount = 3', home.data?.pendingOverdueInvoicesCount === 3, `count=${home.data?.pendingOverdueInvoicesCount}`);
  check('[4] home: pendingOverdueTotalAmount = 6800', home.data?.pendingOverdueTotalAmount === 6800, `amount=${home.data?.pendingOverdueTotalAmount}`);
  check('[4] home: no active cashier session', home.data?.activeCashierSession === null, `session=${JSON.stringify(home.data?.activeCashierSession)}`);
  check('[4] home: cash/online today are numbers', Number.isFinite(home.data?.cashCollectedToday) && Number.isFinite(home.data?.onlineCollectedToday), JSON.stringify({ cash: home.data?.cashCollectedToday, online: home.data?.onlineCollectedToday }));

  // ---------- Item 5: overdue list is real + tenant-scoped ----------
  const rem = await api(acc.cookie, '/api/finance/reminders');
  const nums = rem.json?.data?.map((r) => r.invoiceNumber) ?? [];
  check('[5] reminders GET: total = 1 (INV-2026-0002)', rem.json?.total === 1 && nums[0] === 'INV-2026-0002', `total=${rem.json?.total} ${JSON.stringify(nums)}`);
  const row = rem.json?.data?.[0];
  check('[5] reminders GET: Salma Bennani, overdue, solde 3000', row?.studentName === 'Salma Bennani' && row?.status === 'overdue' && (Number(row.netAmount) - Number(row.paidAmount)) === 3000, JSON.stringify(row));
  const invNums = new Set(nums);
  check('[5] reminders GET: only Atlas overdue invoice (no cross-tenant leak)', invNums.size === 1 && invNums.has('INV-2026-0002'), `set=${[...invNums].join(',')}`);

  // ---------- Item 6: POST isolation — nonexistent invoice -> 404 ----------
  const notFound = await api(acc.cookie, '/api/finance/reminders', { method: 'POST', body: { invoiceId: crypto.randomUUID() } });
  check('[6] POST nonexistent invoice -> 404 NOT_FOUND', notFound.status === 404, `status=${notFound.status} code=${notFound.json?.error?.code}`);

  // ---------- Item 7: POST happy path (temporary guardian link) ----------
  const overdueId = row?.id;
  sql(`insert into guardian_students (id, tenant_id, student_id, guardian_id, relationship_type, is_primary_contact, status) values ('${TEST_LINK_ID}', '${ATLAS}', 'STU-002', '${GUARDIAN_ID}', 'pere', true, 'active') on conflict do nothing`);
  try {
    const sent = await api(acc.cookie, '/api/finance/reminders', { method: 'POST', body: { invoiceId: overdueId } });
    check('[7] POST reminder -> 200 sent', sent.status === 200 && sent.json?.data?.status === 'sent', `status=${sent.status} ${JSON.stringify(sent.json?.data ?? sent.json?.error)}`);
    check('[7] POST reminder -> recipientPhone +212600000000', sent.json?.data?.recipientPhone === '+212600000000', `phone=${sent.json?.data?.recipientPhone}`);
    check('[7] POST reminder -> studentId STU-002', sent.json?.data?.studentId === 'STU-002', `studentId=${sent.json?.data?.studentId}`);
    if (sent.json?.data?.id) {
      sql(`delete from sms_messages where id = '${sent.json.data.id}'`);
      check('[7] cleanup: smsMessage removed', true);
    } else {
      check('[7] cleanup: smsMessage removed', false, 'no sms id returned');
    }
  } finally {
    sql(`delete from guardian_students where id = '${TEST_LINK_ID}'`);
    check('[7] cleanup: guardian link removed', true);
  }

  // ---------- Summary ----------
  const failed = results.filter((r) => !r.ok);
  console.log(`\n==== ${results.length - failed.length}/${results.length} passed, ${failed.length} failed ====`);
  if (failed.length > 0) {
    console.log('Failed checks:');
    for (const f of failed) console.log(`  - ${f.label}${f.detail ? ` (${f.detail})` : ''}`);
  }
  process.exit(failed.length ? 1 : 0);
};

run().catch((err) => {
  console.error('FATAL', err.message);
  process.exit(1);
});
