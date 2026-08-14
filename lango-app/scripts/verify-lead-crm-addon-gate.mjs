// Lead CRM add-on disable / re-enable regression. Disables `lead-crm` for Atlas
// at the DB, asserts every CRM route is gated 403 ADDON_NOT_ACTIVATED while
// unrelated modules (incl. broadcast) stay up, then re-enables and asserts the
// module is back. Run against :3002.
// Run: node scripts/verify-lead-crm-addon-gate.mjs
import { Pool } from 'pg';

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3002';
const ORIGIN = 'http://localhost:3000';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos',
});

const ATLAS = 'ca40c88e-339c-4fea-b5c4-51d5c9cc0239';
const PASSWORD = 'Admin123!';
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
  if (!setCookies) throw new Error(`sign-in returned no cookie (${res.status})`);
  return setCookies;
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

const setAddon = async (enabled) => {
  await pool.query(
    `UPDATE addon_entitlements SET is_enabled=$1, updated_at=now() WHERE tenant_id=$2 AND addon_id='lead-crm'`,
    [enabled, ATLAS],
  );
};

const run = async () => {
  const cookie = await signIn('y.elamrani@atlas.ma', PASSWORD);
  console.log('→ signed in as Atlas admin\n');

  await setAddon(true);
  let r = await api(cookie, '/api/crm/inquiries');
  check('baseline: lead-crm enabled → GET /crm/inquiries 200', r.status === 200, `status ${r.status}`);

  await setAddon(false);
  console.log('→ lead-crm add-on DISABLED for Atlas\n');

  const gateRoutes = [
    '/api/crm/inquiries',
    '/api/crm/inquiries/00000000-0000-0000-0000-000000000000',
  ];
  let gated = 0;
  for (const path of gateRoutes) {
    r = await api(cookie, path);
    const ok = r.status === 403 && r.json?.error?.code === 'ADDON_NOT_ACTIVATED';
    if (ok) gated++;
    else check(`gated: ${path}`, ok, `status ${r.status} code ${r.json?.error?.code}`);
  }
  check(`all CRM GET routes gated 403 ADDON_NOT_ACTIVATED (${gated}/${gateRoutes.length})`, gated === gateRoutes.length, '');

  r = await api(cookie, '/api/crm/inquiries', { method: 'POST', body: {} });
  check('gated: POST /crm/inquiries → 403 ADDON_NOT_ACTIVATED', r.status === 403 && r.json?.error?.code === 'ADDON_NOT_ACTIVATED', `status ${r.status} code ${r.json?.error?.code}`);
  r = await api(cookie, '/api/crm/inquiries/merge', { method: 'POST', body: {} });
  check('gated: POST /crm/inquiries/merge → 403 ADDON_NOT_ACTIVATED', r.status === 403 && r.json?.error?.code === 'ADDON_NOT_ACTIVATED', `status ${r.status} code ${r.json?.error?.code}`);

  // unrelated modules still up (incl. the broadcast add-on, independently entitled)
  r = await api(cookie, '/api/addons/broadcast/connections');
  check('broadcast still up while lead-crm disabled → 200', r.status === 200, `status ${r.status}`);
  r = await api(cookie, '/api/students');
  check('students still up → 200', r.status === 200, `status ${r.status}`);

  await setAddon(true);
  console.log('→ lead-crm add-on RE-ENABLED for Atlas\n');

  r = await api(cookie, '/api/crm/inquiries');
  check('re-enabled: GET /crm/inquiries 200 again', r.status === 200, `status ${r.status}`);
  r = await api(cookie, '/api/crm/inquiries?pageSize=5');
  check('re-enabled: inquiries still listed (data intact)', r.status === 200 && Array.isArray(r.json?.data?.items ?? r.json?.data), `status ${r.status}`);

  const failed = results.filter((x) => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  await pool.end();
  process.exit(failed.length ? 1 : 0);
};

run().catch(async (err) => {
  console.error('FATAL', err);
  await pool.query(`UPDATE addon_entitlements SET is_enabled=true WHERE tenant_id=$1 AND addon_id='lead-crm'`, [ATLAS]).catch(() => {});
  process.exit(1);
});
