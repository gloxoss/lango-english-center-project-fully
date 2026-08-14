// Live acceptance verification for the Teacher Self-Service Portal (#19).
// Hits the running dev server (default http://localhost:3002) with real sessions.
// Run: node scripts/verify-teacher-portal.mjs
const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3002';
const ORIGIN = 'http://localhost:3000';

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

const PASSWORD = 'Admin123!';
const ATLAS_TEACHER = { id: 'USR-002', email: 'fz.idrissi@atlas.ma', name: 'Fatima Zahra Idrissi' };
const LANGO_TEACHER = { id: 'USR-LANGO-TCH-001', email: 'sara.bennis@lango.ma', name: 'Sara Bennis' };
const NON_TEACHER = { id: 'USR-001', email: 'y.elamrani@atlas.ma' }; // school_admin

const ROUTES = ['/api/teacher/me/home', '/api/teacher/me/timetable', '/api/teacher/me/classes'];

const run = async () => {
  // ---------- Item 1: unauthenticated + non-teacher are rejected ----------
  const anon = await api('', '/api/teacher/me/home');
  check('[1] unauthenticated is rejected (401/403)', anon.status === 401 || anon.status === 403, `status=${anon.status}`);

  const nt = await signIn(NON_TEACHER.email, PASSWORD);
  for (const path of ROUTES) {
    const r = await api(nt.cookie, path);
    const code = r.json?.error?.code;
    check(`[1] school_admin blocked on ${path} (403)`, r.status === 403, `status=${r.status} code=${code}`);
  }

  // ---------- Item 2: teacher home aggregate ----------
  const t = await signIn(ATLAS_TEACHER.email, PASSWORD);
  const home = (await api(t.cookie, '/api/teacher/me/home', { expectStatus: 200 })).json;
  check('[2] home: profile is the session teacher', home.data.profile?.name === ATLAS_TEACHER.name, `name=${home.data.profile?.name}`);
  check('[2] home: today is an array', Array.isArray(home.data.today), `len=${home.data.today?.length}`);
  check('[2] home: exactly 1 class assigned', home.data.widgets?.myClasses === 1, `myClasses=${home.data.widgets?.myClasses}`);
  check('[2] home: 2 students across classes', home.data.widgets?.students === 2, `students=${home.data.widgets?.students}`);
  const cls = home.data.classes?.[0];
  check('[2] home: class name is "2nde A"', cls?.name === '2nde A', `name=${cls?.name}`);
  check('[2] home: subject Mathématiques present', Array.isArray(cls?.subjects) && cls.subjects.includes('Mathématiques'), `subjects=${JSON.stringify(cls?.subjects)}`);
  check('[2] home: student count on class is 2', cls?.students === 2, `count=${cls?.students}`);

  // ---------- Item 3: weekly timetable shape ----------
  const tt = (await api(t.cookie, '/api/teacher/me/timetable', { expectStatus: 200 })).json;
  check('[3] timetable: 7 day groups', Array.isArray(tt.data.days) && tt.data.days.length === 7, `days=${tt.data.days?.length}`);
  check('[3] timetable: every group has a slots array', tt.data.days.every((d) => Array.isArray(d.slots)), '');

  // ---------- Item 4: classes with live roster ----------
  const cl = (await api(t.cookie, '/api/teacher/me/classes', { expectStatus: 200 })).json;
  check('[4] classes: 1 section', Array.isArray(cl.data.classes) && cl.data.classes.length === 1, `len=${cl.data.classes?.length}`);
  const c = cl.data.classes?.[0];
  check('[4] classes: roster has 2 student names', Array.isArray(c?.students) && c.students.length === 2, `roster=${JSON.stringify(c?.students)}`);
  check('[4] classes: subject Mathématiques present', Array.isArray(c?.subjects) && c.subjects.includes('Mathématiques'), `subjects=${JSON.stringify(c?.subjects)}`);

  // ---------- Item 5: cross-tenant isolation ----------
  const l = await signIn(LANGO_TEACHER.email, PASSWORD);
  const lHome = (await api(l.cookie, '/api/teacher/me/home', { expectStatus: 200 })).json;
  check('[5] Lango teacher: zero classes (not Atlas data)', lHome.data.widgets?.myClasses === 0 && lHome.data.classes.length === 0, `myClasses=${lHome.data.widgets?.myClasses}`);
  check('[5] Lango teacher: today empty', lHome.data.today.length === 0, `len=${lHome.data.today?.length}`);
  const lCl = (await api(l.cookie, '/api/teacher/me/classes', { expectStatus: 200 })).json;
  check('[5] Lango teacher: no leaked Atlas roster', !JSON.stringify(lCl.data).includes('2nde'), '');
  const atlasHomeStr = JSON.stringify(home.data);
  check('[5] Atlas teacher: no leaked Lango student data', !atlasHomeStr.includes('bennis') && !atlasHomeStr.includes('Sara'), '');

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
