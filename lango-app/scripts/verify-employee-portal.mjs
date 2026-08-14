// Live acceptance verification for the Employee Self-Service Portal.
// Hits the running dev server (default http://localhost:3002) with real sessions.
// Run: node scripts/verify-employee-portal.mjs
import { Pool } from 'pg';

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3002';
const ORIGIN = 'http://localhost:3000';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos',
});

const results = [];
const check = (label, ok, detail = '') => {
  results.push({ label, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
};

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
  return { cookie: setCookies, token: body.token ?? null, body };
}

async function api(cookie, path, { method = 'GET', body, expectStatus } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
      Origin: ORIGIN,
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  if (expectStatus !== undefined && res.status !== expectStatus) {
    throw new Error(`${method} ${path} expected ${expectStatus}, got ${res.status}: ${text.slice(0, 300)}`);
  }
  return { status: res.status, json, text, res };
}

const USERS = {
  u1: { id: 'USR-001', email: 'y.elamrani@atlas.ma' },
  u2: { id: 'USR-002', email: 'fz.idrissi@atlas.ma' },
  lango: { id: 'USR-LANGO-001', email: 'admin@lango.ma' },
  acc: { id: 'USR-ACC-001', email: 'accountant@atlas.ma' },
};
const PASSWORD = 'Admin123!';

const run = async () => {
  const session = {};
  for (const [k, u] of Object.entries(USERS)) {
    const s = await signIn(u.email, PASSWORD);
    session[k] = s.cookie;
    console.log(`signed in ${u.id} (${u.email})`);
  }

  // ---------- Item 1: non-employee (USR-ACC-001) gets 403 NOT_AN_EMPLOYEE ----------
  for (const path of ['/api/employee/me/home', '/api/employee/me/profile', '/api/employee/me/leave', '/api/employee/me/time', '/api/employee/me/payroll']) {
    const r = await api(session.acc, path);
    const code = r.json?.error?.code;
    check(`[1] non-employee 403 NOT_AN_EMPLOYEE on ${path}`, r.status === 403 && code === 'NOT_AN_EMPLOYEE', `status=${r.status} code=${code}`);
  }

  // ---------- Item 2: two real employees see only their own data ----------
  const p1 = (await api(session.u1, '/api/employee/me/payroll')).json;
  const p2 = (await api(session.u2, '/api/employee/me/payroll')).json;
  check('[2] USR-001 sees exactly his own payslip(s)', p1.data.payslips.length === 1 && p1.data.payslips.every((x) => x.userId === 'USR-001'), `count=${p1.data.payslips.length}`);
  check('[2] USR-002 sees exactly his own payslip(s)', p2.data.payslips.length === 1 && p2.data.payslips.every((x) => x.userId === 'USR-002'), `count=${p2.data.payslips.length}`);
  check('[2] USR-001 net on 2026-07 payslip', p1.data.payslips[0]?.netSalary === '6982.40', `net=${p1.data.payslips[0]?.netSalary}`);
  check('[2] USR-002 net on 2026-07 payslip', p2.data.payslips[0]?.netSalary === '5386.80', `net=${p2.data.payslips[0]?.netSalary}`);

  const t1 = (await api(session.u1, '/api/employee/me/time')).json;
  const t2 = (await api(session.u2, '/api/employee/me/time')).json;
  check('[2] USR-001 punches: 5 rows, 2 closed sessions + 1 open', t1.data.punches.length === 5 && t1.data.sessions.length === 2 && !!t1.data.openSession, `punches=${t1.data.punches.length} sessions=${t1.data.sessions.length} open=${!!t1.data.openSession}`);
  check('[2] USR-002 punches: 4 rows, 2 closed sessions, no open', t2.data.punches.length === 4 && t2.data.sessions.length === 2 && !t2.data.openSession, `punches=${t2.data.punches.length} sessions=${t2.data.sessions.length} open=${!!t2.data.openSession}`);

  const l1 = (await api(session.u1, '/api/employee/me/leave')).json;
  const l2 = (await api(session.u2, '/api/employee/me/leave')).json;
  check('[2] USR-001 leave: 1 own request only', l1.data.length === 1 && l1.data.every((x) => x.userId === 'USR-001'), `count=${l1.data.length}`);
  check('[2] USR-002 leave: 1 own request only', l2.data.length === 1 && l2.data.every((x) => x.userId === 'USR-002'), `count=${l2.data.length}`);
  check('[2] no cross-user leakage (leave)', !l1.data.some((x) => x.userId === 'USR-002') && !l2.data.some((x) => x.userId === 'USR-001'), '');

  const h1 = (await api(session.u1, '/api/employee/me/home')).json;
  check('[2] USR-001 home: totalRemaining=25 (30 accrued - 5 used)', h1.data.totalRemaining === 25, `totalRemaining=${h1.data.totalRemaining}`);
  check('[2] USR-001 home: latest payslip net 6982.40', h1.data.latestPayslip?.netSalary === '6982.40', `net=${h1.data.latestPayslip?.netSalary}`);
  check('[2] USR-001 home: currently clocked in (open punch)', h1.data.punch?.punchType === 'in', `punch=${JSON.stringify(h1.data.punch)}`);
  check('[2] USR-001 home: today schedule array present', Array.isArray(h1.data.todaySchedule), `len=${h1.data.todaySchedule?.length}`);

  // ---------- Item 3: self-service leave request flows into the admin view ----------
  const cats1 = (await api(session.u1, '/api/employee/me/home')).json.data.leaveBalances;
  const annual = cats1.find((c) => c.categoryName === 'Congé annuel');
  const created = (await api(session.u1, '/api/employee/me/leave', {
    method: 'POST',
    body: { categoryId: annual.categoryId, startDate: '2026-09-14', endDate: '2026-09-15', reason: 'Verification automatique' },
    expectStatus: 201,
  })).json;
  const newLeaveId = created.data?.id ?? created.data?.leaveReq?.id ?? created.id;
  check('[3] USR-001 created leave request via API (201)', !!newLeaveId, `id=${newLeaveId}`);

  const l1b = (await api(session.u1, '/api/employee/me/leave')).json;
  check('[3] new request visible in own leave list (pending)', l1b.data.some((x) => x.id === newLeaveId && x.status === 'pending'), '');

  const adminLeave = (await api(session.acc, '/api/hr/leave/requests?status=all')).json;
  check('[3] admin (accountant) sees the self-service request', adminLeave.data?.some?.((x) => x.id === newLeaveId), `adminCount=${adminLeave.data?.length}`);

  // Employee cannot cancel someone else's approved request -> scoped 404
  const u2approved = l2.data.find((x) => x.status === 'approved');
  const crossCancel = await api(session.u1, `/api/employee/me/leave/${u2approved.id}/cancel`, { method: 'POST' });
  check('[3] cross-user cancel is rejected (404, self-scoped)', crossCancel.status === 404, `status=${crossCancel.status}`);

  // Cancel own pending request
  const cancelled = await api(session.u1, `/api/employee/me/leave/${newLeaveId}/cancel`, { method: 'POST' });
  check('[3] USR-001 cancels own pending request', cancelled.status === 200 && cancelled.json?.data?.status === 'cancelled', `status=${cancelled.status}`);

  // Already-reviewed request cannot be cancelled -> 409
  const reviewCancel = await api(session.u2, `/api/employee/me/leave/${u2approved.id}/cancel`, { method: 'POST' });
  check('[3] cancelling an approved request -> 409 ALREADY_REVIEWED', reviewCancel.status === 409 && reviewCancel.json?.error?.code === 'ALREADY_REVIEWED', `status=${reviewCancel.status} code=${reviewCancel.json?.error?.code}`);

  // ---------- Item 4: immutability & bankRib re-authentication ----------
  const patchPayslip = await api(session.u1, '/api/employee/me/payroll', { method: 'PATCH', body: {} });
  check('[4] PATCH payslip -> 405 (immutable)', patchPayslip.status === 405, `status=${patchPayslip.status}`);

  const payslipId = p1.data.payslips[0].id;
  const dl = await api(session.u1, `/api/employee/me/payroll/${payslipId}/download`);
  check('[4] payslip download serves HTML bulletin', dl.status === 200 && dl.res.headers.get('content-type')?.includes('text/html') && dl.res.headers.get('content-disposition')?.includes('attachment'), `status=${dl.status}`);

  const ribNoPass = await api(session.u1, '/api/employee/me/profile', { method: 'PATCH', body: { bankRib: 'MA9999999999999999999999' } });
  check('[4] bare bankRib PATCH -> 403 BANK_RIB_REAUTH_REQUIRED', ribNoPass.status === 403 && ribNoPass.json?.error?.code === 'BANK_RIB_REAUTH_REQUIRED', `status=${ribNoPass.status}`);

  const ribWrongPass = await api(session.u1, '/api/employee/me/profile', { method: 'PATCH', body: { bankRib: 'MA9999999999999999999999', currentPassword: 'WrongPass!' } });
  check('[4] bankRib + wrong password -> 403 REAUTH_FAILED', ribWrongPass.status === 403 && ribWrongPass.json?.error?.code === 'REAUTH_FAILED', `status=${ribWrongPass.status}`);

  const passNoChange = await api(session.u1, '/api/employee/me/profile', { method: 'PATCH', body: { currentPassword: PASSWORD } });
  check('[4] password without any change -> 422 REAUTH_WITHOUT_CHANGE', passNoChange.status === 422 && passNoChange.json?.error?.code === 'REAUTH_WITHOUT_CHANGE', `status=${passNoChange.status}`);

  const ribOk = await api(session.u1, '/api/employee/me/profile', { method: 'PATCH', body: { bankRib: 'MA9999999999999999999999', currentPassword: PASSWORD } });
  check('[4] bankRib + correct password -> 200 updated', ribOk.status === 200 && ribOk.json?.data?.applied?.bankRib === 'MA9999999999999999999999', `status=${ribOk.status} rib=${ribOk.json?.data?.applied?.bankRib}`);

  const nameOk = await api(session.u1, '/api/employee/me/profile', { method: 'PATCH', body: { phone: '+212600000000' } });
  check('[4] non-sensitive field update -> 200', nameOk.status === 200, `status=${nameOk.status}`);

  // ---------- Item 5: cross-tenant sweep (Lango employee vs Atlas data) ----------
  const lp = (await api(session.lango, '/api/employee/me/payroll')).json;
  check('[5] Lango employee sees only Lango payslip', lp.data.payslips.length === 1 && lp.data.payslips.every((x) => x.userId === 'USR-LANGO-001'), `count=${lp.data.payslips.length}`);
  const crossDl = await api(session.lango, `/api/employee/me/payroll/${payslipId}/download`);
  check('[5] Lango employee cannot download Atlas payslip -> 404', crossDl.status === 404, `status=${crossDl.status}`);

  const crossLeaveCancel = await api(session.lango, `/api/employee/me/leave/${newLeaveId}/cancel`, { method: 'POST' });
  check('[5] Lango employee cannot cancel Atlas leave request -> 404', crossLeaveCancel.status === 404, `status=${crossLeaveCancel.status}`);

  const langoLeave = (await api(session.lango, '/api/employee/me/leave', { method: 'POST', body: { categoryId: (await api(session.lango, '/api/employee/me/home')).json.data.leaveBalances[0].categoryId, startDate: '2026-10-01', endDate: '2026-10-03', reason: 'Congé Lango' }, expectStatus: 201 })).json;
  const langoLeaveId = langoLeave.data?.id ?? langoLeave.id;
  const adminLeaveAfter = (await api(session.acc, '/api/hr/leave/requests?status=all')).json;
  check('[5] Atlas admin does NOT see Lango leave request (tenant-scoped)', !adminLeaveAfter.data?.some?.((x) => x.id === langoLeaveId), `adminCount=${adminLeaveAfter.data?.length}`);
  const langoOwnList = (await api(session.lango, '/api/employee/me/leave')).json;
  check('[5] Lango employee sees own request', langoOwnList.data.some((x) => x.id === langoLeaveId), '');

  const crossProfile = await api(session.lango, '/api/employee/me/profile');
  check('[5] Lango profile is self-scoped to Lango employee', crossProfile.status === 200 && crossProfile.json?.data?.employee?.userId === 'USR-LANGO-001', `employeeUserId=${crossProfile.json?.data?.employee?.userId}`);

  // ---------- DB-side verification ----------
  const db = await pool.query(
    `SELECT status FROM leave_requests WHERE id = $1`,
    [newLeaveId],
  );
  check('[DB] cancelled request row status = cancelled', db.rows[0]?.status === 'cancelled', `status=${db.rows[0]?.status}`);

  const dbRib = await pool.query(
    `SELECT bank_rib FROM employee_profiles WHERE tenant_id = 'ca40c88e-339c-4fea-b5c4-51d5c9cc0239' AND user_id = 'USR-001'`,
  );
  check('[DB] USR-001 bank_rib updated to test RIB', dbRib.rows[0]?.bank_rib === 'MA9999999999999999999999', `rib=${dbRib.rows[0]?.bank_rib}`);

  const audit = await pool.query(
    `SELECT action, entity_type, count(*) FROM audit_logs WHERE entity_type IN ('leave_request','employee_profile','payslip') GROUP BY action, entity_type ORDER BY entity_type`,
  );
  console.log('[DB] audit rows:', audit.rows);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n==== RESULT: ${results.length - failed.length}/${results.length} passed ====`);
  if (failed.length) {
    console.log('FAILED:');
    for (const f of failed) console.log(`  - ${f.label}`);
    process.exitCode = 1;
  }
};

run().catch((e) => {
  console.error('VERIFY SCRIPT ERROR:', e);
  process.exitCode = 1;
}).finally(() => pool.end());
