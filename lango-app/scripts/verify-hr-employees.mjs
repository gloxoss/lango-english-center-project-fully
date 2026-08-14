// Live acceptance verification — Phase 3: Employee directory / profile / wizard.
// Covers: T4 sensitive-field redaction, T5 tenant isolation, T6 manager cycles,
// T7 no-login employees. Hits the running dev server (default http://localhost:3002).
// Run: node scripts/verify-hr-employees.mjs
import { Pool } from 'pg';

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3002';
const ORIGIN = 'http://localhost:3000';
const ATLAS = 'ca40c88e-339c-4fea-b5c4-51d5c9cc0239';
const LANGO = 'f62f31eb-1fc8-4102-9145-a5ce0bca989b';
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
    headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: ORIGIN },
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
  u1: { id: 'USR-001', email: 'y.elamrani@atlas.ma' },        // school_admin, Atlas
  lango: { id: 'USR-LANGO-001', email: 'admin@lango.ma' },     // school_admin, Lango
  acc: { id: 'USR-ACC-001', email: 'accountant@atlas.ma' },    // accountant, Atlas
};
const PASSWORD = 'Admin123!';

const SENSITIVE_KEYS = ['salary', 'nationalId', 'bankRib', 'cnssNumber', 'amoNumber', 'contractType'];

const run = async () => {
  const session = {};
  for (const [k, u] of Object.entries(USERS)) {
    const s = await signIn(u.email, PASSWORD);
    session[k] = s.cookie;
    console.log(`signed in ${u.id} (${u.email})`);
  }

  let createdId = null;

  // ---------- T4a: school_admin (sensitive permitted) sees sensitive fields ----------
  {
    const r = await api(session.u1, '/api/hr/employees');
    check('T4a list 200 as school_admin', r.status === 200, `status ${r.status}`);
    const rows = r.json?.data ?? [];
    check('T4a atlas directory non-empty', Array.isArray(rows) && rows.length > 0, `${rows.length} rows`);
    const hasSensitive = rows.length > 0 && rows.every(row => SENSITIVE_KEYS.every(k => k in row));
    check('T4a sensitive fields PRESENT for sensitive-permitted caller', hasSensitive,
      hasSensitive ? 'salary/nationalId/bankRib/cnss/amo/contractType all present' : JSON.stringify(Object.keys(rows[0] ?? {})));
  }

  // ---------- T4b: accountant has NO hr.* access ----------
  {
    const r = await api(session.acc, '/api/hr/employees');
    check('T4b accountant blocked on directory', r.status === 403, `status ${r.status}, code ${r.json?.error?.code}`);
  }

  // ---------- T4c: revoke hr.sensitive.read for u1 → fields absent ----------
  let overrideId = null;
  {
    const ins = await pool.query(
      `INSERT INTO user_permission_overrides (tenant_id, user_id, permission_id, granted)
       VALUES ($1, $2, 'hr.sensitive.read', false) RETURNING id`,
      [ATLAS, 'USR-001'],
    );
    overrideId = ins.rows[0]?.id ?? null;

    const list = await api(session.u1, '/api/hr/employees');
    const rows = list.json?.data ?? [];
    const absent = rows.length > 0 && rows.every(row => SENSITIVE_KEYS.every(k => !(k in row)));
    check('T4c sensitive fields ABSENT for revoked caller (list)', list.status === 200 && absent,
      `status ${list.status}, absent=${absent}`);

    const single = await api(session.u1, `/api/hr/employees/${rows[0]?.id ?? ''}`);
    const singleRow = single.json?.data;
    const singleAbsent = singleRow && SENSITIVE_KEYS.every(k => !(k in singleRow));
    check('T4c sensitive fields ABSENT for revoked caller (detail)', single.status === 200 && singleAbsent,
      `status ${single.status}, absent=${singleAbsent}`);

    if (overrideId) await pool.query('DELETE FROM user_permission_overrides WHERE id = $1', [overrideId]);
  }

  // ---------- T5: tenant isolation ----------
  {
    const r = await api(session.lango, '/api/hr/employees');
    const data = r.json?.data;
    const rows = Array.isArray(data) ? data : [];
    const dbRows = await pool.query('SELECT id FROM employee_profiles WHERE tenant_id = $1', [LANGO]);
    const langoIds = new Set(dbRows.rows.map(x => x.id));
    const allLango = rows.length > 0 && rows.every(x => langoIds.has(x.id));
    check('T5 lango directory contains ONLY lango employees', r.status === 200 && allLango,
      `${rows.length} rows, all tenant-scoped=${allLango}`);
  }

  // Cross-tenant PATCH must 404 (getEmployee scoped by tenant).
  {
    const atlasProfile = await pool.query(
      `SELECT id FROM employee_profiles WHERE tenant_id = $1 AND user_id = 'USR-001' LIMIT 1`, [ATLAS]);
    const atlasId = atlasProfile.rows[0]?.id;
    const r = await api(session.lango, `/api/hr/employees/${atlasId}`, {
      method: 'PATCH', body: { employmentStatus: 'on_leave' },
    });
    check('T5 cross-tenant PATCH → 404', r.status === 404, `status ${r.status}, code ${r.json?.error?.code}`);
  }

  // ---------- T6: manager cycles ----------
  {
    const p2 = await pool.query(`SELECT id FROM employee_profiles WHERE tenant_id = $1 AND user_id = 'USR-002' LIMIT 1`, [ATLAS]);
    const p1 = await pool.query(`SELECT id FROM employee_profiles WHERE tenant_id = $1 AND user_id = 'USR-001' LIMIT 1`, [ATLAS]);
    const id1 = p1.rows[0]?.id;
    const id2 = p2.rows[0]?.id;

    const setMgr = await api(session.u1, `/api/hr/employees/${id2}`, {
      method: 'PATCH', body: { managerEmployeeId: id1 },
    });
    check('T6 set manager (non-cyclic) succeeds', setMgr.status === 200, `status ${setMgr.status}`);

    const cycle = await api(session.u1, `/api/hr/employees/${id1}`, {
      method: 'PATCH', body: { managerEmployeeId: id2 },
    });
    check('T6 manager cycle rejected → 409 MANAGER_CYCLE',
      cycle.status === 409 && cycle.json?.error?.code === 'MANAGER_CYCLE',
      `status ${cycle.status}, code ${cycle.json?.error?.code}`);

    const reset = await api(session.u1, `/api/hr/employees/${id2}`, {
      method: 'PATCH', body: { managerEmployeeId: null },
    });
    check('T6 cleanup: clear manager succeeds', reset.status === 200, `status ${reset.status}`);
  }

  // ---------- T7: no-login employee ----------
  {
    const body = {
      firstName: 'Nadia',
      lastName: 'Mrani',
      email: 'nadia.mrani@ext.atlas.ma',
      phone: '+212 6 61 22 33 44',
      employmentType: 'contractor',
      employmentStatus: 'active',
      hireDate: '2026-08-01',
      departmentId: null,
      designationId: null,
      branchId: null,
      cnssNumber: 'CNSS-T7-01',
      amoNumber: 'AMO-T7-01',
      bankRib: '00778000001234567890123',
      contractType: 'vacation',
      nationalId: 'T7-CIN-0001',
      salary: '8500.00',
    };
    const r = await api(session.u1, '/api/hr/employees', { method: 'POST', body, expectStatus: 201 });
    const row = r.json?.data;
    createdId = row?.id ?? null;
    check('T7 create no-login employee → 201 with employeeId',
      r.status === 201 && !!row?.id && !!row?.employeeId, `employeeId ${row?.employeeId}`);
    check('T7 created profile has userId=null', row?.userId === null, `userId=${String(row?.userId)}`);

    const det = await api(session.u1, `/api/hr/employees/${createdId}`);
    const drow = det.json?.data;
    const sensitiveStored = drow && drow.salary === '8500.00' && drow.nationalId === 'T7-CIN-0001' && drow.cnssNumber === 'CNSS-T7-01';
    check('T7 sensitive data stored on profile (no-login) and readable by permitted caller',
      det.status === 200 && sensitiveStored,
      `salary=${drow?.salary}, nationalId=${drow?.nationalId}`);

    const unlinked = await api(session.u1, '/api/hr/employees?loginStatus=unlinked');
    const unlinkedIds = (unlinked.json?.data ?? []).map(x => x.id);
    check('T7 directory filter loginStatus=unlinked includes the new profile',
      unlinked.status === 200 && unlinkedIds.includes(createdId), `${unlinkedIds.length} unlinked`);

    const hist = await api(session.u1, `/api/hr/employees/${createdId}/history`);
    const events = hist.json?.data ?? [];
    check('T7 history records hired event',
      hist.status === 200 && events.some(e => e.eventType === 'hired'), `${events.length} events`);

    const dbRow = await pool.query(
      'SELECT user_id, national_id, salary, cnss_number FROM employee_profiles WHERE id = $1', [createdId]);
    const db = dbRow.rows[0];
    check('T7 DB evidence: profile has null user_id + national_id/salary/cnss',
      db && db.user_id === null && db.national_id === 'T7-CIN-0001' && db.salary === '8500.00' && db.cnss_number === 'CNSS-T7-01',
      db ? `user_id=${db.user_id}` : 'no row');

    // Cleanup
    await pool.query('DELETE FROM employee_profiles WHERE id = $1', [createdId]);
  }

  // ---------- Summary ----------
  const failed = results.filter(x => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('Failed:');
    failed.forEach(f => console.log(`  - ${f.label}${f.detail ? ` (${f.detail})` : ''}`));
  }
  await pool.end();
  process.exit(failed.length ? 1 : 0);
};

run().catch(async (err) => {
  console.error('FATAL', err);
  await pool.end();
  process.exit(1);
});
