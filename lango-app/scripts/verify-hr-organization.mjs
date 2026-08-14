// Live acceptance verification for Phase 2 (departments & designations).
// Hits the running dev server with real sessions and verifies real DB rows.
// Run: node scripts/verify-hr-organization.mjs
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
  return { cookie: setCookies, body };
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

const PASSWORD = 'Admin123!';
const ATLAS = 'ca40c88e-339c-4fea-b5c4-51d5c9cc0239';
const LANGO = 'f62f31eb-1fc8-4102-9145-a5ce0bca989b';

const run = async () => {
  const admin = await signIn('y.elamrani@atlas.ma', PASSWORD); // Atlas school_admin
  const langoAdmin = await signIn('admin@lango.ma', PASSWORD); // Lango school_admin
  console.log('→ signed in as Atlas admin and Lango admin');

  // Idempotent cleanup of previous run leftovers
  await pool.query(`DELETE FROM departments WHERE tenant_id=$1 AND name IN ('Direction Pédagogique','PED Test')`, [ATLAS]);
  await pool.query(`DELETE FROM designations WHERE tenant_id=$1 AND title='Coordinateur Pédagogique'`, [ATLAS]);

  // 1. GET empty list
  let r = await api(admin.cookie, '/api/hr/departments?status=active');
  check('GET departments returns 200', r.status === 200, `status ${r.status}`);
  check('GET departments starts empty', Array.isArray(r.json?.data) && r.json.data.length === 0, `count ${r.json?.data?.length}`);

  // 2. POST create department
  r = await api(admin.cookie, '/api/hr/departments', {
    method: 'POST',
    body: { name: 'Direction Pédagogique', code: 'PED', description: 'test live' },
  });
  check('POST department returns 201', r.status === 201, `status ${r.status}`);
  const deptId = r.json?.data?.id;
  check('POST department returns id', Boolean(deptId), deptId ?? '');

  // 3. duplicate name → 409
  r = await api(admin.cookie, '/api/hr/departments', {
    method: 'POST',
    body: { name: 'Direction Pédagogique' },
  });
  check('duplicate dept name → 409', r.status === 409, `status ${r.status}`);

  // 4. PATCH
  r = await api(admin.cookie, `/api/hr/departments/${deptId}`, {
    method: 'PATCH',
    body: { description: 'mis à jour' },
  });
  check('PATCH department → 200', r.status === 200 && r.json?.data?.description === 'mis à jour', `status ${r.status}`);

  // 5. IN_USE guard: assign a backfilled employee, DELETE should 409
  await pool.query(
    `UPDATE employee_profiles SET department_id=$1
     WHERE tenant_id=$2 AND id = (SELECT id FROM employee_profiles WHERE tenant_id=$2 AND department_id IS NULL LIMIT 1)`,
    [deptId, ATLAS],
  );
  r = await api(admin.cookie, `/api/hr/departments/${deptId}`, { method: 'DELETE' });
  check('archive dept with assigned employee → 409 IN_USE', r.status === 409 && r.json?.error?.code === 'IN_USE', `status ${r.status} code ${r.json?.error?.code}`);
  await pool.query(`UPDATE employee_profiles SET department_id=NULL WHERE tenant_id=$1 AND department_id=$2`, [ATLAS, deptId]);

  // 6. DELETE archive (now empty) → 200
  r = await api(admin.cookie, `/api/hr/departments/${deptId}`, { method: 'DELETE' });
  check('archive empty dept → 200', r.status === 200, `status ${r.status}`);

  // 7. cross-tenant isolation: Lango admin PATCH Atlas dept → 404
  r = await api(langoAdmin.cookie, `/api/hr/departments/${deptId}`, { method: 'PATCH', body: { name: 'pirate' } });
  check('cross-tenant PATCH → 404', r.status === 404, `status ${r.status}`);

  // 8. designations: create + duplicate + archive
  r = await api(admin.cookie, '/api/hr/designations', {
    method: 'POST',
    body: { title: 'Coordinateur Pédagogique', code: 'COORD', departmentId: null },
  });
  check('POST designation returns 201', r.status === 201, `status ${r.status}`);
  const desId = r.json?.data?.id;
  r = await api(admin.cookie, '/api/hr/designations', { method: 'POST', body: { title: 'Coordinateur Pédagogique' } });
  check('duplicate designation → 409', r.status === 409, `status ${r.status}`);
  r = await api(admin.cookie, `/api/hr/designations/${desId}`, { method: 'DELETE' });
  check('archive designation → 200', r.status === 200, `status ${r.status}`);

  // 9. DB evidence: rows cleaned up (only archived remain)
  const { rows: dbRows } = await pool.query(`SELECT id, name, status FROM departments WHERE tenant_id=$1`, [ATLAS]);
  const { rows: dbDes } = await pool.query(`SELECT id, title, status FROM designations WHERE tenant_id=$1`, [ATLAS]);
  check('DB: dept row archived', dbRows.length === 1 && dbRows[0].status === 'archived', JSON.stringify(dbRows));
  check('DB: designation row archived', dbDes.length === 1 && dbDes[0].status === 'archived', JSON.stringify(dbDes));

  // 10. tenant isolation DB check: Lango has no departments/designations
  const { rows: langoDept } = await pool.query(`SELECT COUNT(*)::int AS c FROM departments WHERE tenant_id=$1`, [LANGO]);
  check('DB: Lango has no departments', langoDept[0].c === 0, `count ${langoDept[0].c}`);

  const failed = results.filter(x => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  await pool.end();
  process.exit(failed.length ? 1 : 0);
};

run().catch((err) => { console.error('FATAL', err); process.exit(1); });
