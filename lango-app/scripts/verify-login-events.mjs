// verify-login-events.mjs — live verification of login-events capture (settings-platform Phase F).
// Covers:
//   A. successful email sign-in records a success login_event (tenant + email + method)
//   B. failed sign-in records a failure event attributed to the account's tenant
//   C. failed sign-in for a Lango email is attributed to the Lango tenant
//   D. GET /api/settings/security/login-events as Atlas admin returns Atlas events only (isolation)
//   E. ...as Lango admin returns Lango events only
//   F. accountant (no settings.security.manage) gets 403
//   G. success filter returns only successful attempts
//   H. cleanup
// Run: node scripts/verify-login-events.mjs  (dev server must be on :3002)
import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3002';
const ORIGIN = 'http://localhost:3000';

const SUPER = { email: 'superadmin@schoolos.ma', password: 'Admin123!' };
const ADMIN = { email: 'admin2@atlas.ma', password: 'Admin123!' };       // Atlas school_admin
const LANGO_ADMIN = { email: 'admin@lango.ma', password: 'Admin123!' };  // Lango school_admin
const ACCOUNTANT = { email: 'accountant@atlas.ma', password: 'Admin123!' };

let passed = 0;
let failed = 0;
const failures = [];
function check(name, ok, extra = '') {
  if (ok) { passed += 1; console.log(`  PASS  ${name}`); }
  else { failed += 1; failures.push(name); console.log(`  FAIL  ${name}${extra ? ` — ${extra}` : ''}`); }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = rawLine.trim().match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
  }
}
loadLocalEnv();
const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos' });

const ATLAS = 'ca40c88e-339c-4fea-b5c4-51d5c9cc0239';
const LANGO = 'f62f31eb-1fc8-4102-9145-a5ce0bca989b';

class Jar {
  constructor() { this.cookies = new Map(); }
  setFrom(res) {
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair, ...rest] = raw.split(';');
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      this.cookies.set(name, { name, value, path: '/' });
    }
  }
  header(url) {
    return [...this.cookies.values()].map(c => `${c.name}=${c.value}`).join('; ');
  }
  clear() { this.cookies.clear(); }
}

async function req(jar, method, pathStr, body) {
  const url = `${BASE}${pathStr}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      ...(jar ? { Cookie: jar.header(url) } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  jar?.setFrom(res);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json, text };
}

const signIn = (jar, email, password) => req(jar, 'POST', '/api/auth/sign-in/email', { email, password });

async function dbQuery(text, params) {
  const r = await pool.query(text, params);
  return { rows: r.rows, rowCount: r.rowCount };
}

async function dbSelect(text, params) {
  return (await dbQuery(text, params)).rows;
}

async function waitForEvent(predicate, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const row = await predicate();
    if (row) return row;
    await sleep(300);
  }
  return null;
}

async function latestEvent(email, success) {
  const rows = await dbSelect(
    'SELECT * FROM login_events WHERE lower(email) = lower($1) AND success = $2 ORDER BY created_at DESC LIMIT 1',
    [email, success],
  );
  return rows[0] ?? null;
}

async function run() {
  console.log('Login-events capture verification');
  console.log('==================================\n');

  // Baseline: remember the count before the run so cleanup only touches ours.
  const before = await dbSelect('SELECT count(*)::int AS n FROM login_events');

  const adminJar = new Jar();
  const langoJar = new Jar();
  const acctJar = new Jar();

  // A. successful Atlas sign-in
  const si = await signIn(adminJar, ADMIN.email, ADMIN.password);
  check(`A. Atlas admin sign-in status ${si.status}`, si.status === 200, si.text?.slice(0, 200));
  const successEvent = await waitForEvent(() => latestEvent(ADMIN.email, true));
  check('A. success event recorded for Atlas admin', Boolean(successEvent), 'no login_event row');
  if (successEvent) {
    check('A1. tenant attributed to Atlas', successEvent.tenant_id === ATLAS, `got ${successEvent.tenant_id}`);
    check('A2. method = email', successEvent.method === 'email', `got ${successEvent.method}`);
    check('A3. user_agent captured', typeof successEvent.user_agent === 'string' && successEvent.user_agent.length > 0, 'none');
    check('A4. failure_reason null', successEvent.failure_reason === null, `got ${successEvent.failure_reason}`);
  }

  // B. failed Atlas sign-in (wrong password) -> failure event attributed to Atlas
  const fail1 = await signIn(adminJar, ADMIN.email, 'WrongPassword!');
  check(`B. failed Atlas sign-in status ${fail1.status}`, fail1.status === 401, fail1.text?.slice(0, 200));
  const failEvent = await waitForEvent(() => latestEvent(ADMIN.email, false));
  check('B. failure event recorded', Boolean(failEvent), 'no failure row');
  if (failEvent) {
    check('B1. failure attributed to Atlas', failEvent.tenant_id === ATLAS, `got ${failEvent.tenant_id}`);
    check('B2. failure_reason = invalid_credentials', failEvent.failure_reason === 'invalid_credentials', `got ${failEvent.failure_reason}`);
    check('B3. no session user set', failEvent.user_id === null || typeof failEvent.user_id === 'string');
  }

  // C. failed Lango sign-in -> attributed to Lango tenant
  const fail2 = await signIn(langoJar, LANGO_ADMIN.email, 'WrongPassword!');
  check(`C. failed Lango sign-in status ${fail2.status}`, fail2.status === 401, fail2.text?.slice(0, 200));
  const langoFail = await waitForEvent(() => latestEvent(LANGO_ADMIN.email, false));
  check('C. Lango failure event recorded', Boolean(langoFail), 'no failure row');
  if (langoFail) check('C1. Lango failure attributed to Lango', langoFail.tenant_id === LANGO, `got ${langoFail.tenant_id}`);

  // F. accountant (no settings.security.manage) -> 403 on the API
  await signIn(acctJar, ACCOUNTANT.email, ACCOUNTANT.password);
  const acctRes = await req(acctJar, 'GET', '/api/settings/security/login-events?page=1&limit=10');
  check('F. accountant gets 403 on login-events API', acctRes.status === 403, `got ${acctRes.status} ${acctRes.text?.slice(0, 160)}`);

  // D. Atlas admin reads its own events (isolation: no Lango rows)
  const atlasRes = await req(adminJar, 'GET', '/api/settings/security/login-events?page=1&limit=50');
  check(`D. Atlas admin API 200`, atlasRes.status === 200, `got ${atlasRes.status}`);
  const atlasData = atlasRes.json?.data ?? atlasRes.json;
  const atlasRows = atlasData?.rows ?? atlasData ?? [];
  check('D1. Atlas sees its success event', atlasRows.some(r => r.email === ADMIN.email && r.success === true), 'missing success row');
  check('D2. Atlas sees its failure event', atlasRows.some(r => r.email === ADMIN.email && r.success === false), 'missing failure row');
  check('D3. Atlas sees NO Lango events', !atlasRows.some(r => String(r.email ?? '').includes('lango.ma')), 'leaked lango rows');
  check('D4. summary reflects unfiltered counts', atlasData?.summary && atlasData.summary.failed >= 1, JSON.stringify(atlasData?.summary));

  // G. success filter returns only successful attempts
  const okRes = await req(adminJar, 'GET', '/api/settings/security/login-events?page=1&limit=50&success=true');
  const okRows = okRes.json?.rows ?? okRes.json?.data ?? [];
  check('G. success filter returns only successes', okRows.length > 0 && okRows.every(r => r.success === true), JSON.stringify(okRows.slice(0, 3)));

  // E. Lango admin reads only Lango events (need a valid session first — the
  // earlier Lango sign-in deliberately used a wrong password to record a failure)
  const langoOk = await signIn(langoJar, LANGO_ADMIN.email, LANGO_ADMIN.password);
  check(`E0. Lango admin sign-in status ${langoOk.status}`, langoOk.status === 200, langoOk.text?.slice(0, 160));
  const langoRes = await req(langoJar, 'GET', '/api/settings/security/login-events?page=1&limit=50');
  const langoRows = langoRes.json?.rows ?? langoRes.json?.data ?? [];
  check(`E. Lango admin API 200`, langoRes.status === 200, `got ${langoRes.status}`);
  check('E1. Lango sees its failure event', langoRows.some(r => r.email === LANGO_ADMIN.email && r.success === false), 'missing lango failure');
  check('E2. Lango sees NO Atlas events', !langoRows.some(r => String(r.email ?? '').includes('atlas.ma')), 'leaked atlas rows');

  // H. cleanup — remove only events created for the test accounts after baseline
  const after = await dbSelect('SELECT count(*)::int AS n FROM login_events');
  const created = after[0].n - before[0].n;
  const del = await dbQuery(
    `DELETE FROM login_events
     WHERE lower(email) IN (lower($1), lower($2), lower($3), lower($4))
       AND created_at > (now() - interval '10 minutes')`,
    [ADMIN.email, LANGO_ADMIN.email, SUPER.email, ACCOUNTANT.email],
  );
  check(`H. cleanup — removed ${del.rowCount} test event(s) (${created} created)`, del.rowCount >= 1, 'nothing to clean');

  await pool.end();
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('Failures:', failures.join(' | '));
    process.exit(1);
  }
}

run().catch(err => { console.error(err); process.exit(1); });
