// Broadcast Messaging add-on disable / re-enable regression. Disables
// `broadcast-messaging` for Atlas at the DB, asserts every broadcast route is
// gated 403 ADDON_NOT_ACTIVATED while unrelated modules (incl. lead-crm) stay
// up, then re-enables and asserts the module + data are back. Run on :3002.
// Run: node scripts/verify-broadcast-addon-gate.mjs
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
    `UPDATE addon_entitlements SET is_enabled=$1, updated_at=now() WHERE tenant_id=$2 AND addon_id='broadcast-messaging'`,
    [enabled, ATLAS],
  );
};

const run = async () => {
  const cookie = await signIn('y.elamrani@atlas.ma', PASSWORD);
  console.log('→ signed in as Atlas admin\n');

  await setAddon(true);
  let r = await api(cookie, '/api/addons/broadcast/connections');
  check('baseline: broadcast enabled → /connections 200', r.status === 200, `status ${r.status}`);

  await setAddon(false);
  console.log('→ broadcast-messaging add-on DISABLED for Atlas\n');

  const gateRoutes = [
    '/api/addons/broadcast/connections',
    '/api/addons/broadcast/segments',
    '/api/addons/broadcast/templates',
    '/api/addons/broadcast/campaigns',
    '/api/addons/broadcast/automations',
    '/api/addons/broadcast/consents',
    '/api/addons/broadcast/suppressions',
  ];
  let gated = 0;
  for (const path of gateRoutes) {
    r = await api(cookie, path);
    const ok = r.status === 403 && r.json?.error?.code === 'ADDON_NOT_ACTIVATED';
    if (ok) gated++;
    else check(`gated: ${path}`, ok, `status ${r.status} code ${r.json?.error?.code}`);
  }
  check(`all broadcast GET routes gated 403 ADDON_NOT_ACTIVATED (${gated}/${gateRoutes.length})`, gated === gateRoutes.length, '');

  r = await api(cookie, '/api/addons/broadcast/connections', { method: 'POST', body: {} });
  check('gated: POST /connections → 403 ADDON_NOT_ACTIVATED', r.status === 403 && r.json?.error?.code === 'ADDON_NOT_ACTIVATED', `status ${r.status} code ${r.json?.error?.code}`);
  r = await api(cookie, '/api/addons/broadcast/campaigns', { method: 'POST', body: {} });
  check('gated: POST /campaigns → 403 ADDON_NOT_ACTIVATED', r.status === 403 && r.json?.error?.code === 'ADDON_NOT_ACTIVATED', `status ${r.status} code ${r.json?.error?.code}`);

  // unrelated modules still up (incl. lead-crm, independently entitled)
  r = await api(cookie, '/api/crm/inquiries');
  check('lead-crm still up while broadcast disabled → 200', r.status === 200, `status ${r.status}`);
  r = await api(cookie, '/api/students');
  check('students still up → 200', r.status === 200, `status ${r.status}`);

  await setAddon(true);
  console.log('→ broadcast-messaging add-on RE-ENABLED for Atlas\n');

  r = await api(cookie, '/api/addons/broadcast/connections');
  check('re-enabled: /connections 200 again', r.status === 200, `status ${r.status}`);
  r = await api(cookie, '/api/addons/broadcast/templates');
  check('re-enabled: templates still listed (data intact)', r.status === 200 && Array.isArray(r.json?.data), `status ${r.status} count ${Array.isArray(r.json?.data) ? r.json.data.length : 'n/a'}`);

  const failed = results.filter((x) => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  await pool.end();
  process.exit(failed.length ? 1 : 0);
};

run().catch(async (err) => {
  console.error('FATAL', err);
  await pool.query(`UPDATE addon_entitlements SET is_enabled=true WHERE tenant_id=$1 AND addon_id='broadcast-messaging'`, [ATLAS]).catch(() => {});
  process.exit(1);
});
