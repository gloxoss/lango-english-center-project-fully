// Live acceptance verification — Guard & Security Portal (DB-dependent rows of
// §14). Hits the running dev server with fixture users; the two-tenant rows
// (T5) need a second school with matching ids passed via env.
//
// Fixture setup (run once; automated via `node scripts/create-guard-fixtures.mjs`, or via SQL / admin UI):
//   * gate G1 (both, active), shift S1, device D1
//   * guard user g1 assigned to G1/S1 (today), guard user g2 assigned to G1/S1
//   * student stu1 with a linked guardian, and one active pickup authorization
//   * one approved visitor invitation for today (for the pass/check-in flow)
//
// Env overrides (defaults match a dev Atlas seed):
//   VERIFY_BASE=http://localhost:3002  DATABASE_URL=...  GUARD_EMAIL=...  GUARD_PASS=...
//   GUARD2_EMAIL=...  ADMIN_EMAIL=...  ADMIN_PASS=...  STUDENT_ID=...  AUTH_ID=...  GATE_ID=...
//
// Run: node scripts/verify-guard-security.mjs
import { Pool } from 'pg';

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3002';
const ORIGIN = 'http://localhost:3000';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos',
});

const GATE_ID = process.env.GATE_ID ?? null;
const STUDENT_ID = process.env.STUDENT_ID ?? null;
const AUTH_ID = process.env.AUTH_ID ?? null;

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
  if (!setCookies) throw new Error(`sign-in for ${email} failed (${res.status})`);
  return { cookie: setCookies };
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
  return { status: res.status, json, text };
}

async function main() {
  if (!GATE_ID || !STUDENT_ID || !AUTH_ID) {
    // Skipping must not look like a pass: exit 2 signals "suite not executed".
    console.error('SKIPPED SUITE  live rows need GATE_ID / STUDENT_ID / AUTH_ID env (fixture data not configured).');
    console.error('              Static rows (T14/T15/T16/T18) are covered by scripts/verify-guard-adversarial.mjs.');
    await pool.end();
    process.exit(2);
  }

  const guard = await signIn(process.env.GUARD_EMAIL ?? 'guard1@atlas.ma', process.env.GUARD_PASS ?? 'Admin123!');
  const admin = await signIn(process.env.ADMIN_EMAIL ?? 'admin@atlas.ma', process.env.ADMIN_PASS ?? 'Admin123!');

  // T17 — handoff object is disabled and never queries addons.
  {
    const { status, json } = await api(guard.cookie, '/api/guard/me/expected');
    const ho = json?.data?.handoffs;
    check(
      'T17 me/expected returns handoffs disabled',
      status === 200 && ho?.hostel?.enabled === false && ho?.transport?.enabled === false,
      `status=${status}`,
    );
  }

  // T15 — broad search rejected.
  {
    const { status, json } = await api(guard.cookie, '/api/guard/students/search?q=ab');
    check('T15 short search rejected', status === 422 && json?.error?.code === 'SEARCH_TOO_SHORT', `status=${status}`);
  }

  // T18 — guard role blast radius.
  {
    for (const path of ['/api/students', '/api/teachers', '/api/hr/employees']) {
      const { status } = await api(guard.cookie, path);
      check(`T18 guard blocked from ${path}`, status === 403, `status=${status}`);
    }
  }

  // T9 — replayed release (same key) then fresh key on consumed authorization.
  if (AUTH_ID) {
    const body = { studentId: STUDENT_ID, authorizationId: AUTH_ID, method: 'manual', gateId: GATE_ID, idempotencyKey: 'k-replay-1' };
    const first = await api(guard.cookie, '/api/guard/pickups/release', { method: 'POST', body, expectStatus: 201 });
    const second = await api(guard.cookie, '/api/guard/pickups/release', { method: 'POST', body });
    const fresh = await api(guard.cookie, '/api/guard/pickups/release', {
      method: 'POST', body: { ...body, idempotencyKey: 'k-fresh' },
    });
    const count = (await pool.query('SELECT count(*)::int AS n FROM guard_release_events WHERE authorization_id = $1', [AUTH_ID])).rows[0];
    check('T9 one release, replay+fresh fail', first.status === 201 && second.status >= 400 && fresh.status >= 400 && count.n === 1,
      `201=${first.status} replay=${second.status} fresh=${fresh.status} rows=${count.n}`);
  }

  // T20 — emergency acknowledgement idempotency (one row per guard).
  {
    try {
      const act = await api(admin.cookie, '/api/guard/emergency/activate', { method: 'POST', body: { reason: 'verify' }, expectStatus: 201 });
      const id = act.json?.data?.id;
      await api(guard.cookie, `/api/guard/emergency/${id}/acknowledge`, { method: 'POST', body: {}, expectStatus: 200 });
      await api(guard.cookie, `/api/guard/emergency/${id}/acknowledge`, { method: 'POST', body: {} });
      const rows = (await pool.query(
        'SELECT count(*)::int AS n FROM guard_emergency_acknowledgements WHERE activation_id = $1 AND acknowledged_by_id = $2',
        [id, process.env.GUARD_USER_ID ?? null],
      )).rows[0];
      check('T20 ack idempotent per guard', rows.n === 1, `rows=${rows.n}`);
      await api(admin.cookie, `/api/guard/emergency/${id}/end`, { method: 'POST', body: { reason: 'verify done' } });
    } catch (e) {
      check('T20 ack idempotent per guard', false, String(e.message ?? e));
    }
  }

  // T19 — incident attachment: valid PNG accepted, invalid type rejected.
  {
    try {
      const inc = await api(guard.cookie, '/api/guard/incidents', {
        method: 'POST',
        body: { category: 'securite', severity: 'medium', description: 'verify harness', location: 'portail' },
        expectStatus: 201,
      });
      const id = inc.json?.data?.id;
      const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63fcffcfff3f000505fe04f0a4cb870000000049454e44ae426082', 'hex');
      const form = new FormData();
      form.append('file', new File([png], 'scan.png', { type: 'image/png' }));
      const up = await fetch(`${BASE}/api/guard/incidents/${id}/attachments`, { method: 'POST', headers: { Cookie: guard.cookie }, body: form });
      const badForm = new FormData();
      badForm.append('file', new File([Buffer.from('hello')], 'note.txt', { type: 'text/plain' }));
      const bad = await fetch(`${BASE}/api/guard/incidents/${id}/attachments`, { method: 'POST', headers: { Cookie: guard.cookie }, body: badForm });
      check('T19 valid attachment accepted, invalid rejected', up.status === 201 && bad.status === 422,
        `png=${up.status} txt=${bad.status}`);
    } catch (e) {
      check('T19 incident attachment', false, String(e.message ?? e));
    }
  }

  await pool.end();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
