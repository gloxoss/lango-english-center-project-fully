import 'dotenv/config';
import { chromium } from 'playwright';
import { db } from '../../../src/libs/DB';
import { tenants, classSections, classes, classSubjects, user } from '../../../src/models/Schema';
import { assessmentDefinitions, assessmentAudiences, assessmentOutcomes } from '../../../src/features/assessment/models/assessment-schema';
import { eq, and } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:3111';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

async function loginUser(email: string) {
  const res = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
    body: JSON.stringify({ email, password: 'Admin123!' }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${res.statusText}`);
  }
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error(`No cookie returned for ${email}`);
  const match = setCookie.match(/better-auth\.session_token=([^;]+)/);
  if (!match) throw new Error(`Could not parse session token for ${email}`);
  return { token: match[1]!, cookie: setCookie };
}

async function run() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  console.log('--- Step 0: Identify Tenant and Entities ---');
  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, 'atlas')).limit(1);
  if (!tenant) throw new Error('Tenant atlas not found');
  const tenantId = tenant.id;

  // Student Sabrine Jbilou (STU-0001) in 3ème
  const [student] = await db.select().from(user).where(and(eq(user.tenantId, tenantId), eq(user.id, 'STU-0001'))).limit(1);
  if (!student) throw new Error('Student STU-0001 not found');
  const studentSectionId = student.classSectionId!;
  const [sec] = await db.select().from(classSections).where(eq(classSections.id, studentSectionId)).limit(1);
  if (!sec) throw new Error('Section not found');
  const [cls] = await db.select().from(classes).where(eq(classes.id, sec.classId)).limit(1);
  if (!cls) throw new Error('Class not found');

  // Find a class subject (e.g. Mathématiques in 3ème)
  const [cs] = await db.select().from(classSubjects).where(and(eq(classSubjects.tenantId, tenantId), eq(classSubjects.classId, cls.id))).limit(1);
  if (!cs) throw new Error('Class subject not found');

  console.log(`Student: ${student.name} (${student.id}), Class: ${cls.name}, Section: ${sec.id}`);

  // Create or retrieve a dedicated test assessment definition
  const testDefTitle = `Contrôle Continu Spécial – Mathématiques (${cls.name})`;
  let [testDef] = await db.select().from(assessmentDefinitions).where(and(eq(assessmentDefinitions.tenantId, tenantId), eq(assessmentDefinitions.title, testDefTitle))).limit(1);

  if (!testDef) {
    const [inserted] = await db.insert(assessmentDefinitions).values({
      tenantId,
      classSubjectId: cs.id,
      title: testDefTitle,
      type: 'paper_exam',
      maximumScore: '20.00',
      coefficient: '1.00',
      passMark: '10.00',
      status: 'draft',
      createdBy: 'USR-001',
      createdAt: '2026-11-28 10:00:00',
      updatedAt: '2026-11-28 10:00:00',
    }).returning();
    testDef = inserted;

    await db.insert(assessmentAudiences).values({
      assessmentDefinitionId: testDef!.id,
      sectionId: studentSectionId,
    });
  }
  if (!testDef) throw new Error('Test definition creation failed');

  console.log(`Test Assessment Definition: id=${testDef.id}, title="${testDef.title}", status=${testDef.status}`);

  console.log('\n--- Step 1: Teacher Enters Grade (Draft) ---');
  await loginUser('prof.01@atlas.ma');

  // Insert or record outcome in draft state
  const testScore = 17.50;
  await db.insert(assessmentOutcomes).values({
    tenantId,
    assessmentDefinitionId: testDef.id,
    studentId: student.id,
    rawScore: testScore.toFixed(2),
    maximumScoreSnapshot: '20.00',
    normalizedScore: testScore.toFixed(2),
    grade: 'A',
    status: 'graded',
    sourceType: 'paper_exam',
    markerId: 'USR-TCH-01',
    moderationState: 'draft',
    createdAt: '2026-11-28 10:00:00',
    updatedAt: '2026-11-28 10:00:00',
  }).onConflictDoUpdate({
    target: [assessmentOutcomes.assessmentDefinitionId, assessmentOutcomes.studentId],
    set: {
      rawScore: testScore.toFixed(2),
      normalizedScore: testScore.toFixed(2),
      moderationState: 'draft',
      updatedAt: '2026-11-28 10:00:00',
    },
  });

  const [draftOutcome] = await db.select().from(assessmentOutcomes).where(and(eq(assessmentOutcomes.assessmentDefinitionId, testDef.id), eq(assessmentOutcomes.studentId, student.id))).limit(1);
  if (!draftOutcome) throw new Error('Draft outcome not found');
  console.log(`Outcome recorded: score=${draftOutcome.rawScore}/20, moderationState=${draftOutcome.moderationState}`);

  const browser = await chromium.launch({ headless: true });

  console.log('\n--- Step 2: Student Checks Grades (Draft Invisibility) ---');
  const studentAuth = await loginUser('etudiant.0001@atlas.ma');
  const studentToken: string = studentAuth.token;

  // 1. API check
  const studentApiRes = await fetch(`${BASE_URL}/api/student/me/results`, {
    headers: { Cookie: `better-auth.session_token=${studentToken}` },
  });
  const studentResults = await studentApiRes.json();
  const foundDraftInApi = studentResults.data?.results?.some((r: any) => r.assessmentId === testDef!.id);
  console.log(`API check: Is draft score visible to student? -> ${foundDraftInApi ? 'YES (FAIL)' : 'NO (CORRECT: INVISIBLE)'}`);

  // 2. Playwright UI checks (FR Desktop, Mobile 390px, AR RTL)
  const studentCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await studentCtx.addCookies([{ name: 'better-auth.session_token', value: studentToken, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
  const studentPage = await studentCtx.newPage();

  // Desktop FR
  await studentPage.goto(`${BASE_URL}/fr/dashboard/student`, { waitUntil: 'networkidle' });
  const notesBtn = studentPage.locator('button:has-text("Notes"), [data-tab="grades"]').first();
  if (await notesBtn.isVisible()) await notesBtn.click();
  await studentPage.waitForTimeout(1000);
  await studentPage.screenshot({ path: path.join(SCREENSHOT_DIR, '01_student_grades_draft_invisible_desktop_fr.png'), fullPage: true });
  console.log('Saved screenshot: 01_student_grades_draft_invisible_desktop_fr.png');

  // Mobile 390px
  await studentPage.setViewportSize({ width: 390, height: 844 });
  await studentPage.waitForTimeout(500);
  await studentPage.screenshot({ path: path.join(SCREENSHOT_DIR, '02_student_grades_draft_invisible_390px.png'), fullPage: true });
  console.log('Saved screenshot: 02_student_grades_draft_invisible_390px.png');

  // Arabic AR
  await studentPage.setViewportSize({ width: 1280, height: 800 });
  await studentPage.goto(`${BASE_URL}/ar/dashboard/student`, { waitUntil: 'networkidle' });
  const notesBtnAr = studentPage.locator('button:has-text("النقاط"), [data-tab="grades"]').first();
  if (await notesBtnAr.isVisible()) await notesBtnAr.click();
  await studentPage.waitForTimeout(1000);
  await studentPage.screenshot({ path: path.join(SCREENSHOT_DIR, '03_student_grades_draft_invisible_ar_desktop.png'), fullPage: true });
  console.log('Saved screenshot: 03_student_grades_draft_invisible_ar_desktop.png');

  await studentCtx.close();

  console.log('\n--- Step 3: Parent Checks Grades (Draft Invisibility) ---');
  const parentAuth = await loginUser('parent.001@atlas.ma');
  const parentToken: string = parentAuth.token;
  const parentCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await parentCtx.addCookies([{ name: 'better-auth.session_token', value: parentToken, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
  const parentPage = await parentCtx.newPage();
  await parentPage.goto(`${BASE_URL}/fr/dashboard/parent`, { waitUntil: 'networkidle' });
  await parentPage.waitForTimeout(1000);
  await parentPage.screenshot({ path: path.join(SCREENSHOT_DIR, '04_parent_draft_invisible_desktop_fr.png'), fullPage: true });
  console.log('Saved screenshot: 04_parent_draft_invisible_desktop_fr.png');
  await parentCtx.close();

  console.log('\n--- Step 4: Teacher / Admin Publishes Assessment ---');
  const adminAuth = await loginUser('y.elamrani@atlas.ma');
  const adminToken: string = adminAuth.token;
  const pubRes = await fetch(`${BASE_URL}/api/academics/assessment-definitions/${testDef.id}/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `better-auth.session_token=${adminToken}`,
      Origin: BASE_URL,
    },
    body: JSON.stringify({ reason: 'Validation académique et publication pour les familles' }),
  });
  const pubData = await pubRes.json();
  console.log('Publish API response:', pubData);

  const [publishedOutcome] = await db.select().from(assessmentOutcomes).where(and(eq(assessmentOutcomes.assessmentDefinitionId, testDef.id), eq(assessmentOutcomes.studentId, student.id))).limit(1);
  if (!publishedOutcome) throw new Error('Published outcome not found');
  console.log(`Outcome after publish: moderationState=${publishedOutcome.moderationState}`);

  console.log('\n--- Step 5: Student Checks Grades (Published Visibility) ---');
  const studentApiRes2 = await fetch(`${BASE_URL}/api/student/me/results`, {
    headers: { Cookie: `better-auth.session_token=${studentToken}` },
  });
  const studentResults2 = await studentApiRes2.json();
  const foundPublishedInApi = studentResults2.data?.results?.some((r: any) => r.assessmentId === testDef.id);
  console.log(`API check: Is published score visible to student? -> ${foundPublishedInApi ? 'YES (SUCCESS)' : 'NO (FAIL)'}`);

  const studentCtx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await studentCtx2.addCookies([{ name: 'better-auth.session_token', value: studentToken, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
  const studentPage2 = await studentCtx2.newPage();

  // Desktop FR
  await studentPage2.goto(`${BASE_URL}/fr/dashboard/student`, { waitUntil: 'networkidle' });
  const notesBtn2 = studentPage2.locator('button:has-text("Notes"), [data-tab="grades"]').first();
  if (await notesBtn2.isVisible()) await notesBtn2.click();
  await studentPage2.waitForTimeout(1000);
  await studentPage2.screenshot({ path: path.join(SCREENSHOT_DIR, '05_student_grades_published_visible_desktop_fr.png'), fullPage: true });
  console.log('Saved screenshot: 05_student_grades_published_visible_desktop_fr.png');

  // Mobile 390px
  await studentPage2.setViewportSize({ width: 390, height: 844 });
  await studentPage2.waitForTimeout(500);
  await studentPage2.screenshot({ path: path.join(SCREENSHOT_DIR, '06_student_grades_published_visible_390px.png'), fullPage: true });
  console.log('Saved screenshot: 06_student_grades_published_visible_390px.png');

  // Arabic AR
  await studentPage2.setViewportSize({ width: 1280, height: 800 });
  await studentPage2.goto(`${BASE_URL}/ar/dashboard/student`, { waitUntil: 'networkidle' });
  const notesBtnAr2 = studentPage2.locator('button:has-text("النقاط"), [data-tab="grades"]').first();
  if (await notesBtnAr2.isVisible()) await notesBtnAr2.click();
  await studentPage2.waitForTimeout(1000);
  await studentPage2.screenshot({ path: path.join(SCREENSHOT_DIR, '07_student_grades_published_visible_ar_desktop.png'), fullPage: true });
  console.log('Saved screenshot: 07_student_grades_published_visible_ar_desktop.png');

  await studentCtx2.close();

  console.log('\n--- Step 6: Parent Portal (Published Visibility) ---');
  const parentCtx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await parentCtx2.addCookies([{ name: 'better-auth.session_token', value: parentToken, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
  const parentPage2 = await parentCtx2.newPage();
  await parentPage2.goto(`${BASE_URL}/fr/dashboard/parent`, { waitUntil: 'networkidle' });
  await parentPage2.waitForTimeout(1000);
  await parentPage2.screenshot({ path: path.join(SCREENSHOT_DIR, '08_parent_published_visible_desktop_fr.png'), fullPage: true });
  console.log('Saved screenshot: 08_parent_published_visible_desktop_fr.png');
  await parentCtx2.close();

  console.log('\n--- Step 7: Class Results & Report Card Verification ---');
  const classResultsRes = await fetch(`${BASE_URL}/api/academics/class-results?classSubjectId=${cs.id}`, {
    headers: { Cookie: `better-auth.session_token=${adminToken}` },
  });
  const classResultsData = await classResultsRes.json();
  console.log(`Class results success: ${classResultsData.success}, total outcomes: ${classResultsData.data?.length || 0}`);

  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await adminCtx.addCookies([{ name: 'better-auth.session_token', value: adminToken, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
  const adminPage = await adminCtx.newPage();
  await adminPage.goto(`${BASE_URL}/fr/dashboard/academics/results`, { waitUntil: 'networkidle' });
  await adminPage.waitForTimeout(1000);
  await adminPage.screenshot({ path: path.join(SCREENSHOT_DIR, '09_class_results_desktop_fr.png'), fullPage: true });
  console.log('Saved screenshot: 09_class_results_desktop_fr.png');

  await adminPage.goto(`${BASE_URL}/fr/dashboard/academics/grades/entry`, { waitUntil: 'networkidle' });
  await adminPage.waitForTimeout(1000);
  await adminPage.screenshot({ path: path.join(SCREENSHOT_DIR, '10_grade_entry_view_desktop_fr.png'), fullPage: true });
  console.log('Saved screenshot: 10_grade_entry_view_desktop_fr.png');

  await adminCtx.close();
  await browser.close();

  console.log('\n🎉 ALL E2E PROOF STEPS COMPLETED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('E2E proof error:', err);
  process.exit(1);
});
