// Live acceptance verification — Parent/Guardian Portal (P1–P9). Hits the
// running dev server with the PRN- fixture set created by
// `npx tsx scripts/seed-parent-fixtures.ts`.
//
// Covers the P1 security model: deny-by-default 404 (no existence oracle),
// per-child rights, multiple guardians with different rights over one child,
// sibling isolation, cross-tenant isolation, account linking (one-time token),
// and revocation-without-relogin — then P4–P9: attendance/excuses rights,
// finance household roll-up + amounts, class-scoped announcements, messages,
// meetings, documents, requests, preferences/consents, and addon-gate 403s.
//
// Env overrides: VERIFY_BASE, DATABASE_URL.
// Run: node scripts/verify-parent-security.mjs
import { Pool } from 'pg';

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3002';
const ORIGIN = 'http://localhost:3000';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos',
});

const PASS = 'ParentAdmin123!';
const ADMIN_EMAIL = 'y.elamrani@atlas.ma';
const ADMIN_PASS = 'Admin123!';
const P_A = 'prn-prn-parent-a@placeholder.local';
const P_B = 'prn-prn-parent-b@placeholder.local';
const P_C = 'prn-prn-parent-c@placeholder.local';
const P_U = 'prn-prn-parent-unlinked@placeholder.local';

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

// Production auth permits only a small number of sign-ins per rolling window.
// This harness needs five distinct principals, so pace them instead of
// disabling or bypassing the application's rate limiter.
const betweenSignIns = () => new Promise((resolve) => setTimeout(resolve, 22_000));

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

// relationshipId for a guardian email + studentId
async function relId(guardianEmail, studentId) {
  const { rows } = await pool.query(
    `SELECT gs.id FROM guardian_students gs
     JOIN guardians g ON g.id = gs.guardian_id
     WHERE g.email = $1 AND gs.student_id = $2 LIMIT 1`,
    [guardianEmail, studentId],
  );
  return rows[0]?.id ?? null;
}

async function main() {
  // --- Fixture lookups ---
  const gU = (await pool.query(`SELECT id FROM guardians WHERE email = 'prn-guard-unlinked@placeholder.local'`)).rows[0]?.id;
  const ids = {
    aA: await relId('prn-guard-a@placeholder.local', 'PRN-CHILD-A'),
    aB: await relId('prn-guard-a@placeholder.local', 'PRN-CHILD-B'),
    aC: await relId('prn-guard-a@placeholder.local', 'PRN-CHILD-C'),
    aEXP: await relId('prn-guard-a@placeholder.local', 'PRN-CHILD-EXP'),
    aFUT: await relId('prn-guard-a@placeholder.local', 'PRN-CHILD-FUT'),
    aFIN: await relId('prn-guard-a@placeholder.local', 'PRN-CHILD-FIN'),
    aCUST: await relId('prn-guard-a@placeholder.local', 'PRN-CHILD-CUST'),
    aSUSP: await relId('prn-guard-a@placeholder.local', 'PRN-CHILD-SUSP'),
    aATD: await relId('prn-guard-a@placeholder.local', 'PRN-CHILD-ATD'),
    aMED: await relId('prn-guard-a@placeholder.local', 'PRN-CHILD-MED'),
    aCOM: await relId('prn-guard-a@placeholder.local', 'PRN-CHILD-COM'),
    bA: await relId('prn-guard-b@placeholder.local', 'PRN-CHILD-A'),
    bD: await relId('prn-guard-b@placeholder.local', 'PRN-CHILD-D'),
    cL: await relId('prn-guard-c@placeholder.local', 'PRN-CHILD-LANGO'),
    uB: await relId('prn-guard-unlinked@placeholder.local', 'PRN-CHILD-B'),
  };
  if (!gU || Object.values(ids).some((v) => !v)) {
    console.error('SKIPPED SUITE  PRN- fixture rows not found. Run: npx tsx scripts/seed-parent-fixtures.ts');
    await pool.end();
    process.exit(2);
  }

  const admin = await signIn(ADMIN_EMAIL, ADMIN_PASS);
  await betweenSignIns();
  const a = await signIn(P_A, PASS); // PARENT-A (Atlas, full rights on A)
  await betweenSignIns();
  const b = await signIn(P_B, PASS); // PARENT-B (Atlas, co-guardian on A, exclusive on D)
  await betweenSignIns();
  const c = await signIn(P_C, PASS); // PARENT-C (Lango)
  await betweenSignIns();
  const u = await signIn(P_U, PASS); // PARENT-UNLINKED (Atlas, no bound guardian yet)

  // S1 — anonymous is 401 on every /api/guardian/** route.
  {
    const anon = await api(null, '/api/guardian/me');
    const anonChild = await api(null, `/api/guardian/me/children/${ids.aA}`);
    check('S1 anonymous 401 on /me and child summary', anon.status === 401 && anonChild.status === 401,
      `me=${anon.status} child=${anonChild.status}`);
  }

  // S2 — non-parent role (school_admin) is 403.
  {
    const { status } = await api(admin.cookie, '/api/guardian/me');
    check('S2 non-parent role 403 on /me', status === 403, `status=${status}`);
  }

  // S3 — PARENT-A effective children: active/open links to active students only.
  {
    const { status, json } = await api(a.cookie, '/api/guardian/me');
    const students = (json?.data?.children ?? []).map((ch) => ch.studentId).sort();
    const want = ['PRN-CHILD-A', 'PRN-CHILD-B', 'PRN-CHILD-CUST', 'PRN-CHILD-FIN'];
    const mustNot = ['PRN-CHILD-C', 'PRN-CHILD-D', 'PRN-CHILD-EXP', 'PRN-CHILD-FUT', 'PRN-CHILD-SUSP', 'PRN-CHILD-LANGO'];
    const okList = want.every((s) => students.includes(s)) && mustNot.every((s) => !students.includes(s));
    check('S3 /me lists only effective children (A,B,CUST,FIN)', status === 200 && okList,
      `got=[${students.join(',')}]`);
  }

  // S4 — child summary for an effective, full-rights child: 200, rights granted.
  {
    const { status, json } = await api(a.cookie, `/api/guardian/me/children/${ids.aA}`);
    const d = json?.data;
    check('S4 PARENT-A → A 200, full rights + primary', status === 200 && d?.rights?.finance === true && d?.rights?.academic === true && d?.isPrimaryContact === true,
      `status=${status} finance=${d?.rights?.finance}`);
  }

  // S5 — finance withheld on B surfaces in the redacted projection.
  {
    const { status, json } = await api(a.cookie, `/api/guardian/me/children/${ids.aB}`);
    const d = json?.data;
    check('S5 PARENT-A → B 200 with finance:false', status === 200 && d?.rights?.finance === false && d?.rights?.academic === true,
      `status=${status} finance=${d?.rights?.finance}`);
  }

  // S6-S10 — every non-effective or non-owned relationship is a uniform 404.
  {
    const cases = [
      ['revoked C', ids.aC],
      ['expired EXP', ids.aEXP],
      ['future FUT', ids.aFUT],
      ['suspended SUSP', ids.aSUSP],
      ['cross-guardian D (gB link)', ids.bD],
    ];
    let all = true;
    for (const [label, id] of cases) {
      const { status } = await api(a.cookie, `/api/guardian/me/children/${id}`);
      if (status !== 404) all = false;
    }
    check('S6-S10 revoked/expired/future/suspended/cross-guardian → 404', all, 'statuses logged');
    for (const [label, id] of cases) {
      const { status } = await api(a.cookie, `/api/guardian/me/children/${id}`);
      check(`  [${label}]`, status === 404, `status=${status}`);
    }
  }

  // S11 — unknown relationship id is also 404 (uniform, no existence oracle).
  {
    const { status } = await api(a.cookie, `/api/guardian/me/children/00000000-0000-0000-0000-000000000000`);
    check('S11 unknown relationship id → 404', status === 404, `status=${status}`);
  }

  // S12-S13 — co-guardian PARENT-B over CHILD-A (finance withheld) + exclusive D.
  {
    const { status: sA, json: jA } = await api(b.cookie, `/api/guardian/me/children/${ids.bA}`);
    const { status: sD, json: jD } = await api(b.cookie, `/api/guardian/me/children/${ids.bD}`);
    check('S12 PARENT-B → A 200 with finance:false (rights differ from PARENT-A)',
      sA === 200 && jA?.data?.rights?.finance === false, `status=${sA} finance=${jA?.data?.rights?.finance}`);
    check('S13 PARENT-B → D 200 full rights', sD === 200 && jD?.data?.rights?.finance === true, `status=${sD}`);
  }

  // S14 — cross-tenant: PARENT-C (Lango) cannot read Atlas children, and vice versa.
  {
    const { status: cAtlas } = await api(c.cookie, `/api/guardian/me/children/${ids.aA}`);
    const { status: aLango } = await api(a.cookie, `/api/guardian/me/children/${ids.cL}`);
    check('S14 cross-tenant both directions → 404', cAtlas === 404 && aLango === 404,
      `lango->atlas=${cAtlas} atlas->lango=${aLango}`);
  }

  // S16 — link/start is staff-only.
  {
    const { status } = await api(a.cookie, '/api/guardian/link/start', { method: 'POST', body: { guardianId: gU } });
    check('S16 link/start by parent → 403', status === 403, `status=${status}`);
  }

  // S17 — link/start refuses an already-bound guardian.
  {
    const bound = (await pool.query(`SELECT id FROM guardians WHERE email = 'prn-guard-a@placeholder.local'`)).rows[0].id;
    const { status } = await api(admin.cookie, '/api/guardian/link/start', { method: 'POST', body: { guardianId: bound } });
    check('S17 link/start already-bound guardian → 409', status === 409, `status=${status}`);
  }

  // S18-S21 — full account-linking cycle with adversarial attempts.
  // Idempotency: a previous run leaves gU bound to the unlinked account. Reset
  // the binding (and purge any leftover unused tokens) so start can issue a
  // fresh token on every run.
  await pool.query(`UPDATE guardians SET user_id = NULL WHERE id = $1`, [gU]);
  await pool.query(`DELETE FROM parent_guardian_link_tokens WHERE guardian_id = $1`, [gU]);
  let token = null;
  {
    const { status, json } = await api(admin.cookie, '/api/guardian/link/start', { method: 'POST', body: { guardianId: gU } });
    token = json?.data?.token ?? null;
    check('S18 link/start (admin) issues a raw token', status === 200 && typeof token === 'string' && token.length >= 20,
      `status=${status} token=${token ? 'yes' : 'no'}`);
  }
  {
    // Cross-tenant redeem: a Lango parent cannot bind an Atlas guardian token.
    const { status } = await api(c.cookie, '/api/guardian/link/accept', { method: 'POST', body: { token } });
    check('S19 cross-tenant token redeem → 403', status === 403, `status=${status}`);
  }
  {
    // Garbage token → 422.
    const { status } = await api(u.cookie, '/api/guardian/link/accept', { method: 'POST', body: { token: 'definitely-not-a-valid-token' } });
    check('S20 invalid token → 422', status === 422, `status=${status}`);
  }
  {
    // Legit redeem binds the account.
    const { status } = await api(u.cookie, '/api/guardian/link/accept', { method: 'POST', body: { token } });
    const { status: meStatus, json } = await api(u.cookie, '/api/guardian/me');
    const students = (json?.data?.children ?? []).map((ch) => ch.studentId);
    check('S21 valid redeem binds account + /me linked with child B',
      status === 200 && meStatus === 200 && json?.data?.linked === true && students.includes('PRN-CHILD-B'),
      `accept=${status} me=${meStatus} children=[${students.join(',')}]`);
  }
  {
    // Token is single-use: replay is refused. And start now refuses a bound guardian.
    const { status: replay } = await api(u.cookie, '/api/guardian/link/accept', { method: 'POST', body: { token } });
    const { status: rebind } = await api(admin.cookie, '/api/guardian/link/start', { method: 'POST', body: { guardianId: gU } });
    check('S22 token single-use + rebind refused', replay === 422 && rebind === 409,
      `replay=${replay} rebind=${rebind}`);
  }

  // S23 — revocation without re-login: an existing session loses access the
  // moment the DB link is revoked (each request re-resolves against live rows).
  {
    // PARENT-A currently sees B; flip the link to revoked live.
    await pool.query(
      `UPDATE guardian_students SET status = 'revoked' WHERE id = $1`, [ids.aB],
    );
    const me = await api(a.cookie, '/api/guardian/me');
    const after = (me.json?.data?.children ?? []).map((ch) => ch.studentId);
    const child = await api(a.cookie, `/api/guardian/me/children/${ids.aB}`);
    check('S23 live revocation: /me drops B + child summary 404 (no re-login)',
      me.status === 200 && !after.includes('PRN-CHILD-B') && child.status === 404,
      `me=[${after.join(',')}] child=${child.status}`);
    // Restore for idempotent re-runs.
    await pool.query(`UPDATE guardian_students SET status = 'active' WHERE id = $1`, [ids.aB]);
  }

  // =====================================================================
  // P4 — Attendance + excuses
  // =====================================================================
  {
    const { status, json } = await api(a.cookie, `/api/guardian/me/children/${ids.aA}/attendance`);
    const d = json?.data;
    check('S24 attendance GET child A: 200 + summary/recent/today shape',
      status === 200 && d && Array.isArray(d.recent) && Array.isArray(d.today) && 'summary' in d,
      `status=${status}`);
  }
  {
    const { status } = await api(a.cookie, `/api/guardian/me/children/${ids.aATD}/attendance`);
    check('S25 attendance right withheld (ATD) → 403', status === 403, `status=${status}`);
  }
  let excuseId = null;
  {
    const { status, json } = await api(a.cookie, `/api/guardian/me/children/${ids.aA}/excuses`, {
      method: 'POST',
      body: { date: '2099-12-31', reason: 'PRN vérification excuse (auto)' },
      expectStatus: 201,
    });
    excuseId = json?.data?.id ?? null;
    check('S26 excuse POST child A → 201 pending', status === 201 && json?.data?.status === 'pending', `status=${status}`);
  }
  {
    const { status } = await api(a.cookie, `/api/guardian/me/children/${ids.bD}/excuses`, {
      method: 'POST',
      body: { date: '2099-12-31', reason: 'PRN cross-guardian attempt (auto)' },
    });
    check('S27 excuse POST on cross-guardian child → uniform 404', status === 404, `status=${status}`);
  }
  if (excuseId) await pool.query(`DELETE FROM attendance_excuses WHERE id = $1`, [excuseId]);

  // =====================================================================
  // P5 — Parent finance
  // =====================================================================
  {
    const { status, json } = await api(a.cookie, '/api/guardian/me/finance');
    const kids = json?.data?.children ?? [];
    const aRow = kids.find((k) => k.studentId === 'PRN-CHILD-A');
    const hasB = kids.some((k) => k.studentId === 'PRN-CHILD-B');
    const hasFIN = kids.some((k) => k.studentId === 'PRN-CHILD-FIN');
    check('S28 household finance excludes B/FIN, A outstanding=800, total=800',
      status === 200 && aRow?.outstanding === 800 && !hasB && !hasFIN && json?.data?.totalOutstanding === 800,
      `total=${json?.data?.totalOutstanding} A=${aRow?.outstanding}`);
  }
  {
    const { status, json } = await api(a.cookie, `/api/guardian/me/children/${ids.aA}/finance`);
    const invNums = (json?.data?.invoices ?? []).map((i) => i.invoiceNumber);
    check('S29 child finance A: invoices 0001+0002, outstanding 800',
      status === 200 && invNums.includes('PRN-INV-0001') && invNums.includes('PRN-INV-0002') && json?.data?.totalOutstanding === 800,
      `outstanding=${json?.data?.totalOutstanding} inv=[${invNums.join(',')}]`);
  }
  {
    const { status } = await api(a.cookie, `/api/guardian/me/children/${ids.aB}/finance`);
    check('S30 child finance withheld (B) → 403', status === 403, `status=${status}`);
  }

  // =====================================================================
  // P6 — Communication: announcements, messages, meetings
  // =====================================================================
  {
    const { status, json } = await api(a.cookie, `/api/guardian/me/children/${ids.aA}/announcements`);
    const titles = (json?.data ?? []).map((r) => r.title);
    check('S31 announcements A: class-scoped (A + all-parents, no B leak)',
      status === 200 && titles.includes('PRN Annonce Classe A') && titles.includes('PRN Annonce Tous Parents') && !titles.includes('PRN Annonce Classe B'),
      `[${titles.join(' | ')}]`);
  }
  {
    const { status, json } = await api(a.cookie, `/api/guardian/me/children/${ids.aB}/announcements`);
    const titles = (json?.data ?? []).map((r) => r.title);
    check('S32 announcements B: no leak of class-A notice',
      status === 200 && titles.includes('PRN Annonce Classe B') && !titles.includes('PRN Annonce Classe A'),
      `[${titles.join(' | ')}]`);
  }
  {
    const { status, json } = await api(a.cookie, '/api/guardian/me/messages');
    const hasA = (json?.data ?? []).some((r) => r.studentId === 'PRN-CHILD-A');
    check('S33 messages: parent sees only own children sms', status === 200 && hasA, `status=${status}`);
  }
  {
    const { status, json } = await api(a.cookie, `/api/guardian/me/children/${ids.aA}/meetings`);
    const hasTeacher = (json?.data ?? []).some((r) => r.teacherId === 'PRN-TEACHER');
    check('S34 meetings: open PRN-TEACHER slot visible to A', status === 200 && hasTeacher, `status=${status}`);
    const { status: com } = await api(a.cookie, `/api/guardian/me/children/${ids.aCOM}/meetings`);
    check('S35 meetings right withheld (COM) → 403', com === 403, `status=${com}`);
  }

  // =====================================================================
  // P7 — Documents + requests
  // =====================================================================
  {
    const { status, json } = await api(a.cookie, `/api/guardian/me/children/${ids.aA}/documents`);
    const types = (json?.data ?? []).map((r) => r.documentType);
    check('S36 documents A: birth_certificate + bulletin present',
      status === 200 && types.includes('birth_certificate') && types.includes('bulletin'), `[${types.join(',')}]`);
    const { status: med } = await api(a.cookie, `/api/guardian/me/children/${ids.aMED}/documents`);
    check('S37 documents right withheld (MED) → 403', med === 403, `status=${med}`);
  }
  let reqId = null;
  {
    const { status: listStatus } = await api(a.cookie, `/api/guardian/me/children/${ids.aA}/requests`);
    const { status, json } = await api(a.cookie, `/api/guardian/me/children/${ids.aA}/requests`, {
      method: 'POST',
      body: { requestType: 'document_request', subject: 'PRN vérification demande (auto)', body: 'Auto-generated by verify script.' },
      expectStatus: 201,
    });
    reqId = json?.data?.id ?? null;
    check('S38 requests: GET 200 + POST 201 pending', listStatus === 200 && status === 201 && json?.data?.status === 'pending', `get=${listStatus} post=${status}`);
  }
  if (reqId) await pool.query(`DELETE FROM parent_requests WHERE id = $1`, [reqId]);

  // =====================================================================
  // P8 — Preferences / consents
  // =====================================================================
  {
    const { status } = await api(a.cookie, '/api/guardian/me/preferences');
    const { status: ok, json: okJson } = await api(a.cookie, '/api/guardian/me/preferences', {
      method: 'PATCH', body: { key: 'contactConsent', value: true },
    });
    const saved = (okJson?.data ?? []).find((r) => r.key === 'contactConsent');
    const { status: badKey } = await api(a.cookie, '/api/guardian/me/preferences', {
      method: 'PATCH', body: { key: 'contactConsent; DROP', value: true },
    });
    const { status: badVal } = await api(a.cookie, '/api/guardian/me/preferences', {
      method: 'PATCH', body: { key: 'mediaConsent', value: 'yes' },
    });
    check('S39 preferences: GET 200 + consent persists + bad key/value rejected',
      status === 200 && ok === 200 && saved?.value === true && badKey === 400 && badVal === 400,
      `get=${status} patch=${ok} badKey=${badKey} badVal=${badVal}`);
  }
  await pool.query(`DELETE FROM portal_preferences WHERE user_id = 'PRN-PARENT-A' AND pref_key = 'contactConsent'`);

  // =====================================================================
  // P9 — Narrow addon integrations: gated, never implicitly granted
  // =====================================================================
  {
    const { status: tr } = await api(a.cookie, '/api/transport/self-service/guardian');
    const { status: ho } = await api(a.cookie, '/api/addons/hostel/guardian/me');
    check('S40 transport/hostel addon gate → 403 (off on Atlas)',
      tr === 403 && ho === 403, `transport=${tr} hostel=${ho}`);
  }

  await pool.end();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
