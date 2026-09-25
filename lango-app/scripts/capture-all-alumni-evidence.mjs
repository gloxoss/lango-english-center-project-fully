import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../src/libs/DB';
import { user, sessionYears, account, studentPlacements } from '../src/models/Schema';
import { and, eq } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { transitionStudentToAlumni } from '../src/libs/services/alumni-transition';

const BASE = 'http://localhost:3111';
const ARTIFACTS_DIR = 'C:/Users/OMEN/.gemini/antigravity-ide/brain/f8123e8b-6b92-42cb-8818-54295578edb6';
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

async function run() {
  console.log('Starting Playwright capture for Alumni Visual Evidence (A - H)...');
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR',
  });
  const page = await context.newPage();

  console.log('1. Signing in as school_admin (y.elamrani@atlas.ma)...');
  await page.goto(`${BASE}/fr/login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('input[type="email"]').fill('y.elamrani@atlas.ma');
  await page.locator('input[type="password"]').fill('Admin123!');
  await page.locator('input[type="password"]').press('Enter');
  await page.waitForURL(u => !String(u).includes('/login'), { timeout: 60000 });
  console.log('Signed in as school_admin successfully.');

  // ----------------------------------------------------
  // EVIDENCE E: Empty State (prior to graduate transition)
  // ----------------------------------------------------
  console.log('Capturing Evidence E (Empty State)...');
  await page.goto(`${BASE}/fr/dashboard/students/alumni`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'alumni_evidence_e_empty_state.png'),
    fullPage: false,
  });

  // ----------------------------------------------------
  // EVIDENCE G: Mobile 390
  // ----------------------------------------------------
  console.log('Capturing Evidence G (Mobile 390)...');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'fr-FR',
    storageState: await context.storageState(),
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${BASE}/fr/dashboard/students/alumni`, { waitUntil: 'networkidle', timeout: 90000 });
  await mobilePage.waitForTimeout(2000);
  await mobilePage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'alumni_evidence_g_mobile_390.png'),
    fullPage: false,
  });
  await mobileContext.close();

  // ----------------------------------------------------
  // EVIDENCE H: Arabic RTL
  // ----------------------------------------------------
  console.log('Capturing Evidence H (Arabic RTL)...');
  await page.goto(`${BASE}/ar/dashboard/students/alumni`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'alumni_evidence_h_arabic_rtl.png'),
    fullPage: false,
  });

  // ----------------------------------------------------
  // EVIDENCE F: Permission / Role Guard (Staff accessing /alumni)
  // ----------------------------------------------------
  console.log('Capturing Evidence F (Role Guard / Redirect)...');
  await page.goto(`${BASE}/fr/alumni`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2000);
  // School admin visiting /alumni is redirected to /dashboard by AlumniPortalLayout
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'alumni_evidence_f_role_guard.png'),
    fullPage: false,
  });

  // ----------------------------------------------------
  // Transition an active student to alumni in Atlas tenant
  // ----------------------------------------------------
  console.log('Finding an active student in Atlas tenant to graduate...');
  const [adminUser] = await db.select().from(user).where(eq(user.email, 'y.elamrani@atlas.ma')).limit(1);
  const atlasTenantId = adminUser.tenantId;

  // Find a student in Atlas
  const atlasStudents = await db.select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(and(eq(user.tenantId, atlasTenantId), eq(user.role, 'student'), eq(user.userStatus, 'active')))
    .limit(3);

  const studentToGraduate = atlasStudents[0];
  console.log(`Graduating student: ${studentToGraduate.name} (${studentToGraduate.id})`);

  // Canonical transition
  const transResult = await db.transaction(async (tx) => {
    return transitionStudentToAlumni(tx, atlasTenantId, studentToGraduate.id, adminUser.id);
  });
  console.log('Student graduated successfully. Setting password for self-service test...');

  // Set known password so we can log in as alumnus
  const hashedPw = await hashPassword('AlumniPass123!');
  await db.delete(account).where(and(eq(account.userId, studentToGraduate.id), eq(account.providerId, 'credential')));
  await db.insert(account).values({
    id: path.basename(studentToGraduate.id),
    accountId: studentToGraduate.id,
    providerId: 'credential',
    userId: studentToGraduate.id,
    password: hashedPw,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // ----------------------------------------------------
  // EVIDENCE A: Alumni Directory Populated
  // ----------------------------------------------------
  console.log('Capturing Evidence A (Alumni Directory Populated)...');
  await page.goto(`${BASE}/fr/dashboard/students/alumni`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'alumni_evidence_a_directory_populated.png'),
    fullPage: false,
  });

  // ----------------------------------------------------
  // EVIDENCE B: Alumni Detail / History
  // ----------------------------------------------------
  console.log(`Capturing Evidence B (Alumni Detail / History for ${studentToGraduate.id})...`);
  await page.goto(`${BASE}/fr/dashboard/students/${studentToGraduate.id}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'alumni_evidence_b_alumni_detail_history.png'),
    fullPage: false,
  });

  // ----------------------------------------------------
  // EVIDENCE C: Archived Academic Placement
  // ----------------------------------------------------
  console.log('Capturing Evidence C (Archived Academic Placement)...');
  // Scroll down to placement history section if present
  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'alumni_evidence_c_archived_placement.png'),
    fullPage: false,
  });

  // ----------------------------------------------------
  // EVIDENCE D: Alumni Self-Service Portal (/alumni)
  // ----------------------------------------------------
  console.log('Signing in as the newly graduated Alumnus...');
  const alumnusContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR',
  });
  const alumnusPage = await alumnusContext.newPage();
  await alumnusPage.goto(`${BASE}/fr/login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await alumnusPage.locator('input[type="email"]').fill(studentToGraduate.email);
  await alumnusPage.locator('input[type="password"]').fill('AlumniPass123!');
  await alumnusPage.locator('input[type="password"]').press('Enter');
  await alumnusPage.waitForURL(u => !String(u).includes('/login'), { timeout: 60000 });
  console.log('Signed in as alumnus. Navigating to /fr/alumni...');

  await alumnusPage.goto(`${BASE}/fr/alumni`, { waitUntil: 'networkidle', timeout: 90000 });
  await alumnusPage.waitForTimeout(2500);
  console.log('Capturing Evidence D (Alumni Self-Service)...');
  await alumnusPage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'alumni_evidence_d_self_service.png'),
    fullPage: false,
  });

  await alumnusContext.close();
  await context.close();
  await browser.close();
  console.log('All Alumni visual evidence (A - H) captured successfully!');
}

run().catch((err) => {
  console.error('Error capturing alumni evidence:', err);
  process.exit(1);
});
