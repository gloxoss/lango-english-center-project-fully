// GRC-05 redo: the full grade flow through the app's own APIs only (no DB writes).
// teacher enters a grade -> hidden from student and linked parent (draft) ->
// publish -> visible to both -> appears in class results. Screenshots via Playwright.
// Run: node artifacts/product-enhancements/GRADES-CANONICAL-01/e2e-real.mjs (dev server on :3111)
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const H = 'http://localhost:3111';
const OUT = 'artifacts/product-enhancements/GRADES-CANONICAL-01/screenshots-real';
fs.mkdirSync(OUT, { recursive: true });
const STUDENT_ID = 'STU-0001';
// Français, taught by prof.08 in STU-0001's section on the same campus. (prof.05, Maths,
// is refused by the campus lock: 48 of 129 dev assignments cross campuses.)
const CLASS_SUBJECT_ID = 'c293a97f-2bb3-40d5-a362-e38267be0340';
const log = [];
const step = (name, data) => { log.push({ step: name, ...data }); console.log(name, JSON.stringify(data)); };

async function login(email) {
  const r = await fetch(`${H}/api/auth/sign-in/email`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: H }, body: JSON.stringify({ email, password: 'Admin123!' }) });
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status}`);
  return r.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
}
async function call(cookie, method, path, body) {
  const r = await fetch(H + path, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json', Origin: H }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, json: j };
}
const title = `E2E Contrôle ${new Date().toISOString().slice(0, 16)}`;
const hasGrade = rows => JSON.stringify(rows ?? '').includes(title);

const admin = await login('y.elamrani@atlas.ma');
const teacher = await login('prof.08@atlas.ma');
const student = await login('etudiant.0001@atlas.ma');
const parent = await login('parent.001@atlas.ma');

// 1. Admin creates the épreuve with its class subject (API fixed in this pass)
const def = await call(admin, 'POST', '/api/academics/assessment-definitions', { title, type: 'quiz', classSubjectId: CLASS_SUBJECT_ID });
step('1 admin creates épreuve', { status: def.status, id: def.json?.data?.id, classSubjectId: def.json?.data?.classSubjectId });
const defId = def.json.data.id;

// 2. Teacher enters a grade through grade entry
const roster = await call(teacher, 'GET', `/api/academics/grade-entry?assessmentDefinitionId=${defId}`);
const inRoster = JSON.stringify(roster.json ?? '').includes(STUDENT_ID);
step('2a teacher opens grade sheet', { status: roster.status, studentInRoster: inRoster });
const save = await call(teacher, 'POST', '/api/academics/grade-entry', { assessmentDefinitionId: defId, marks: [{ studentId: STUDENT_ID, rawScore: 15, status: 'graded' }] });
step('2b teacher saves 15/20', { status: save.status, error: save.json?.error?.code });

// 3. Link a real parent (skipped when already linked by a previous run)
const already = await call(parent, 'GET', '/api/guardian/me/children');
if (!JSON.stringify(already.json ?? '').includes(STUDENT_ID)) { // guardian + link + token + accept, all via APIs
const g = await call(admin, 'POST', '/api/students/parents', { firstName: 'Parent', lastName: 'E2E', email: 'parent.001@atlas.ma', relation: 'mother', linkStudentId: STUDENT_ID });
const guardianId = g.json?.data?.id ?? g.json?.data?.guardian?.id;
step('3a admin creates guardian linked to student', { status: g.status, guardianId, error: g.json?.error?.code });
const tok = await call(admin, 'POST', '/api/guardian/link/start', { guardianId });
step('3b admin issues link token', { status: tok.status });
const acc = await call(parent, 'POST', '/api/guardian/link/accept', { token: tok.json?.data?.token });
step('3c parent accepts token', { status: acc.status, error: acc.json?.error?.code });
}
const kids = await call(parent, 'GET', '/api/guardian/me/children');
const rel = (kids.json?.data ?? []).find(k => JSON.stringify(k).includes(STUDENT_ID));
const relId = rel?.relationshipId ?? rel?.id;
step('3d parent sees child', { status: kids.status, relationshipId: relId });

// 4. Before publishing: hidden from student and parent
const s1 = await call(student, 'GET', '/api/student/me/results');
const p1 = relId ? await call(parent, 'GET', `/api/guardian/me/children/${relId}/results`) : { status: 'n/a', json: null };
step('4 before publish', { studentSees: hasGrade(s1.json), parentStatus: p1.status, parentSees: hasGrade(p1.json) });

// 5. Teacher publishes
const pub = await call(teacher, 'POST', `/api/academics/assessment-definitions/${defId}/publish`);
step('5 teacher publishes', { status: pub.status, count: pub.json?.data?.count, error: pub.json?.error?.code });

// 6. After publishing: visible to both, and in class results
const s2 = await call(student, 'GET', '/api/student/me/results');
const p2 = relId ? await call(parent, 'GET', `/api/guardian/me/children/${relId}/results`) : { status: 'n/a', json: null };
const cr = await call(admin, 'GET', `/api/academics/class-results?classSubjectId=${CLASS_SUBJECT_ID}`);
step('6 after publish', { studentSees: hasGrade(s2.json), parentSees: hasGrade(p2.json), classResultsStatus: cr.status, classResultsHasStudent: JSON.stringify(cr.json ?? '').includes(STUDENT_ID) });

// Screenshots of what people actually see
const browser = await chromium.launch();
for (const [who, email, path] of [['student', 'etudiant.0001@atlas.ma', '/fr/dashboard/student'], ['parent', 'parent.001@atlas.ma', '/fr/dashboard/parent']]) {
  for (const [variant, viewport, loc] of [['desktop-fr', { width: 1440, height: 900 }, 'fr'], ['mobile390-fr', { width: 390, height: 844 }, 'fr'], ['desktop-ar', { width: 1440, height: 900 }, 'ar']]) {
    const ctx = await browser.newContext({ viewport });
    await ctx.request.post(`${H}/api/auth/sign-in/email`, { headers: { Origin: H, 'Content-Type': 'application/json' }, data: { email, password: 'Admin123!' } });
    const page = await ctx.newPage();
    await page.goto(`${H}${path.replace('/fr/', `/${loc}/`)}`, { waitUntil: 'networkidle', timeout: 120000 });
    if (who === 'student') {
      await page.getByRole('button', { name: /^Notes$|^الدرجات$|^النقط$/ }).first().click().catch(() => {});
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${who}-${variant}.png`, fullPage: true });
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(`${OUT}/../e2e-real-results.json`, JSON.stringify(log, null, 2));
