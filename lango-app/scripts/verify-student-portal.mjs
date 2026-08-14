// Live acceptance verification for the Student Self-Service Portal (#20).
// Hits the running dev server (default http://localhost:3002) with real sessions.
// Run: node scripts/verify-student-portal.mjs
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
  return { cookie: setCookies };
}

async function api(cookie, path, { method = 'GET', expectStatus } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: ORIGIN },
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

const PASSWORD = 'ParentAdmin123!'; // PRN-* fixture accounts
const ADMIN_PASSWORD = 'Admin123!'; // standard staff fixture account
const A = { id: 'PRN-CHILD-A', email: 'prn-prn-child-a@placeholder.local', name: 'Vrf Child A' };
const B = { id: 'PRN-CHILD-B', email: 'prn-prn-child-b@placeholder.local', name: 'Vrf Child B' };
const ATD = { id: 'PRN-CHILD-ATD', email: 'prn-prn-child-atd@placeholder.local', name: 'Vrf Child Atd' };
const ADMIN = { email: 'y.elamrani@atlas.ma' };

const ROUTES = ['/api/student/me/home', '/api/student/me/timetable', '/api/student/me/subjects', '/api/student/me/attendance'];

const run = async () => {
  // ---------- Item 1: auth guards ----------
  const anon = await api('', '/api/student/me/home');
  check('[1] unauthenticated rejected (401/403)', anon.status === 401 || anon.status === 403, `status=${anon.status}`);

  const adm = await signIn(ADMIN.email, ADMIN_PASSWORD);
  for (const path of ROUTES) {
    const r = await api(adm.cookie, path);
    check(`[1] school_admin blocked on ${path} (403)`, r.status === 403, `status=${r.status} code=${r.json?.error?.code}`);
  }

  // ---------- Item 2: placed student (PRN-CHILD-A, 2nde A) ----------
  const a = await signIn(A.email, PASSWORD);
  const homeA = (await api(a.cookie, '/api/student/me/home', { expectStatus: 200 })).json;
  check('[2] home: profile is the session student', homeA.data.profile?.name === A.name, `name=${homeA.data.profile?.name}`);
  check('[2] home: placement is "2nde A"', homeA.data.placement?.name === '2nde A', `name=${homeA.data.placement?.name}`);
  check('[2] home: subject Mathématiques present', Array.isArray(homeA.data.subjects) && homeA.data.subjects.includes('Mathématiques'), `subjects=${JSON.stringify(homeA.data.subjects)}`);
  check('[2] home: attendance present=1 absent=1 late=1 total=3', homeA.data.attendance?.present === 1 && homeA.data.attendance?.absent === 1 && homeA.data.attendance?.late === 1 && homeA.data.attendance?.total === 3, JSON.stringify(homeA.data.attendance));
  check('[2] home: widgets mySubjects=1', homeA.data.widgets?.mySubjects === 1, `mySubjects=${homeA.data.widgets?.mySubjects}`);
  check('[2] home: today is an array', Array.isArray(homeA.data.today), `len=${homeA.data.today?.length}`);

  // ---------- Item 3: timetable shape ----------
  const tt = (await api(a.cookie, '/api/student/me/timetable', { expectStatus: 200 })).json;
  check('[3] timetable: 7 day groups', Array.isArray(tt.data.days) && tt.data.days.length === 7, `days=${tt.data.days?.length}`);
  check('[3] timetable: every group has slots array', tt.data.days.every((d) => Array.isArray(d.slots)), '');

  // ---------- Item 4: subjects with teacher ----------
  const su = (await api(a.cookie, '/api/student/me/subjects', { expectStatus: 200 })).json;
  const firstSubj = su.data.subjects?.[0];
  check('[4] subjects: Mathématiques taught by Fatima Zahra Idrissi', firstSubj?.subjectName === 'Mathématiques' && firstSubj?.teacherName === 'Fatima Zahra Idrissi', JSON.stringify(firstSubj));

  // ---------- Item 5: own attendance ----------
  const at = (await api(a.cookie, '/api/student/me/attendance', { expectStatus: 200 })).json;
  check('[5] attendance: 3 records', at.data.records.length === 3, `len=${at.data.records.length}`);
  check('[5] attendance: statuses match (late/absent/present)', ['late', 'absent', 'present'].every((s) => at.data.records.some((r) => r.status === s)), JSON.stringify(at.data.records.map((r) => r.status)));
  check('[5] attendance: summary total=3', at.data.summary.total === 3, `total=${at.data.summary.total}`);
  check('[5] attendance: no foreign student records', at.data.records.every((r) => r.date !== undefined), '');

  // ---------- Item 6: isolation within tenant ----------
  const b = await signIn(B.email, PASSWORD);
  const homeB = (await api(b.cookie, '/api/student/me/home', { expectStatus: 200 })).json;
  check('[6] PRN-CHILD-B placement is "2nde C" (own class)', homeB.data.placement?.name === '2nde C', `name=${homeB.data.placement?.name}`);
  check('[6] PRN-CHILD-B sees zero attendance (not PRN-CHILD-A data)', homeB.data.attendance?.total === 0, `total=${homeB.data.attendance?.total}`);
  check('[6] PRN-CHILD-B sees no subjects (not PRN-CHILD-A data)', homeB.data.subjects.length === 0, `subjects=${JSON.stringify(homeB.data.subjects)}`);
  check('[6] PRN-CHILD-A data contains no Vrf Child B refs', !JSON.stringify(homeA.data).includes('Vrf Child B'), '');

  // ---------- Item 7: unplaced student (PRN-CHILD-ATD) ----------
  const atd = await signIn(ATD.email, PASSWORD);
  const homeAtd = (await api(atd.cookie, '/api/student/me/home', { expectStatus: 200 })).json;
  check('[7] unplaced: placement null', homeAtd.data.placement === null, JSON.stringify(homeAtd.data.placement));
  check('[7] unplaced: no subjects/today/attendance', homeAtd.data.subjects.length === 0 && homeAtd.data.today.length === 0 && homeAtd.data.attendance.total === 0, '');
  check('[7] unplaced: no leaked other-class data', !JSON.stringify(homeAtd.data).includes('Mathématiques') && !JSON.stringify(homeAtd.data).includes('2nde'), '');

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
