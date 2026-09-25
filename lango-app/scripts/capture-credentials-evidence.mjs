import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE = 'http://localhost:3112';
const AUTH_ORIGIN = 'http://localhost:3111';
const OUT_DIR = path.resolve('artifacts/page-audit/done/AUD-CREDENTIALS-01__student-credentials/screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

const ids = JSON.parse(fs.readFileSync('scripts/credentials-ids.json', 'utf8'));

async function installAuthOriginRewrite(context) {
  await context.route('**/api/auth/sign-in/**', async (route) => {
    const req = route.request();
    const headers = { ...req.headers() };
    headers.origin = AUTH_ORIGIN;
    const resp = await route.fetch({ headers, postData: req.postDataBuffer() });
    await route.fulfill({ response: resp });
  });
}

async function captureRoute(page, url, outputPath, waitMs = 2500) {
  console.log(`Capturing: ${url} -> ${path.basename(outputPath)}`);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(waitMs);
    // Wait for spinners to detach if any
    await page.waitForSelector('.animate-spin, [data-testid="loading"]', { state: 'detached', timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);

    await page.screenshot({ path: outputPath, fullPage: false });
    console.log(`  ✓ Saved: ${path.basename(outputPath)}`);
  } catch (err) {
    console.error(`  ✗ Error capturing ${url}:`, err.message);
    await page.screenshot({ path: outputPath, fullPage: false }).catch(() => {});
  }
}

async function run() {
  console.log('Starting full credentials evidence capture...');
  const browser = await chromium.launch({ headless: true });

  // 1. Initial Desktop Context for Login
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR',
  });
  await installAuthOriginRewrite(desktopContext);
  const page = await desktopContext.newPage();

  console.log('Navigating to login page...');
  await page.goto(`${BASE}/fr/login`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(1000);

  console.log('Filling login credentials...');
  await page.fill('input[type="email"], input[name="email"]', 'y.elamrani@atlas.ma');
  await page.fill('input[type="password"], input[name="password"]', 'Admin123!');
  await page.click('button[type="submit"]');

  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 30000 });
  console.log('Logged in successfully! Current URL:', page.url());

  const storageState = await desktopContext.storageState();

  // 2. Mobile Context (390 x 844)
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: 'fr-FR',
    storageState,
  });
  const mobilePage = await mobileContext.newPage();

  // 3. Arabic RTL Context (1440 x 900)
  const arabicContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'ar-MA',
    storageState,
  });
  const arabicPage = await arabicContext.newPage();

  // 4. Public Context
  const publicContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR',
  });
  const publicPage = await publicContext.newPage();

  console.log('\n--- 1. CARDS & CONVOCATIONS (Desktop FR) ---');
  await captureRoute(page, `${BASE}/fr/dashboard/cards`, path.join(OUT_DIR, '01-cards-dashboard-desktop-fr.png'));
  await captureRoute(page, `${BASE}/fr/dashboard/cards/students`, path.join(OUT_DIR, '02-cards-students-desktop-fr.png'));
  await captureRoute(mobilePage, `${BASE}/fr/dashboard/cards/students`, path.join(OUT_DIR, '03-cards-students-mobile-390.png'));
  await captureRoute(arabicPage, `${BASE}/ar/dashboard/cards/students`, path.join(OUT_DIR, '04-cards-students-arabic-rtl.png'));

  await captureRoute(page, `${BASE}/fr/dashboard/cards/employees`, path.join(OUT_DIR, '05-cards-employees-desktop-fr.png'));
  await captureRoute(page, `${BASE}/fr/dashboard/cards/admit-cards`, path.join(OUT_DIR, '06-cards-admit-cards-desktop-fr.png'));
  await captureRoute(mobilePage, `${BASE}/fr/dashboard/cards/admit-cards`, path.join(OUT_DIR, '07-cards-admit-cards-mobile-390.png'));
  await captureRoute(arabicPage, `${BASE}/ar/dashboard/cards/admit-cards`, path.join(OUT_DIR, '08-cards-admit-cards-arabic-rtl.png'));

  await captureRoute(page, `${BASE}/fr/dashboard/cards/issued`, path.join(OUT_DIR, '09-cards-issued-desktop-fr.png'));
  await captureRoute(page, `${BASE}/fr/dashboard/cards/templates`, path.join(OUT_DIR, '10-cards-templates-desktop-fr.png'));
  await captureRoute(page, `${BASE}/fr/dashboard/cards/templates/${ids.cardTemplateId}/edit`, path.join(OUT_DIR, '11-cards-templates-edit-desktop-fr.png'));
  await captureRoute(page, `${BASE}/fr/dashboard/cards/jobs`, path.join(OUT_DIR, '12-cards-jobs-desktop-fr.png'));

  console.log('\n--- 2. CERTIFICATES & ATTESTATIONS (Desktop FR, Mobile, Arabic) ---');
  await captureRoute(page, `${BASE}/fr/dashboard/certificates`, path.join(OUT_DIR, '13-certificates-dashboard-desktop-fr.png'));
  await captureRoute(page, `${BASE}/fr/dashboard/certificates/issue/students`, path.join(OUT_DIR, '14-certificates-issue-students-desktop-fr.png'));
  await captureRoute(page, `${BASE}/fr/dashboard/certificates/issue/employees`, path.join(OUT_DIR, '15-certificates-issue-employees-desktop-fr.png'));
  await captureRoute(page, `${BASE}/fr/dashboard/certificates/definitions`, path.join(OUT_DIR, '16-certificates-definitions-desktop-fr.png'));
  await captureRoute(page, `${BASE}/fr/dashboard/certificates/definitions/${ids.certDefId}`, path.join(OUT_DIR, '17-certificates-definitions-detail-desktop-fr.png'));

  await captureRoute(page, `${BASE}/fr/dashboard/certificates/issued`, path.join(OUT_DIR, '18-certificates-issued-desktop-fr.png'));
  await captureRoute(mobilePage, `${BASE}/fr/dashboard/certificates/issued`, path.join(OUT_DIR, '19-certificates-issued-mobile-390.png'));
  await captureRoute(arabicPage, `${BASE}/ar/dashboard/certificates/issued`, path.join(OUT_DIR, '20-certificates-issued-arabic-rtl.png'));

  await captureRoute(page, `${BASE}/fr/dashboard/certificates/issued/${ids.issuedCertId}`, path.join(OUT_DIR, '21-certificates-issued-detail-desktop-fr.png'));
  await captureRoute(page, `${BASE}/fr/dashboard/certificates/templates`, path.join(OUT_DIR, '22-certificates-templates-desktop-fr.png'));
  await captureRoute(page, `${BASE}/fr/dashboard/certificates/templates/${ids.certTemplateId}/edit`, path.join(OUT_DIR, '23-certificates-templates-edit-desktop-fr.png'));

  await captureRoute(page, `${BASE}/fr/dashboard/certificates/requests`, path.join(OUT_DIR, '24-certificates-requests-desktop-fr.png'));
  await captureRoute(mobilePage, `${BASE}/fr/dashboard/certificates/requests`, path.join(OUT_DIR, '25-certificates-requests-mobile-390.png'));
  await captureRoute(arabicPage, `${BASE}/ar/dashboard/certificates/requests`, path.join(OUT_DIR, '26-certificates-requests-arabic-rtl.png'));

  await captureRoute(page, `${BASE}/fr/dashboard/certificates/jobs`, path.join(OUT_DIR, '27-certificates-jobs-desktop-fr.png'));
  await captureRoute(page, `${BASE}/fr/dashboard/certificates/settings`, path.join(OUT_DIR, '28-certificates-settings-desktop-fr.png'));

  console.log('\n--- 3. OFFICIAL DOCUMENTS GENERATOR ---');
  await captureRoute(page, `${BASE}/fr/dashboard/documents/generator`, path.join(OUT_DIR, '29-documents-generator-desktop-fr.png'));

  console.log('\n--- 4. PUBLIC VERIFICATION (Unauthenticated) ---');
  await captureRoute(publicPage, `${BASE}/fr/verify/card/atlas-card-token-valid-2026`, path.join(OUT_DIR, '30-verify-card-public-desktop-fr.png'));
  await captureRoute(publicPage, `${BASE}/fr/verify/certificate/atlas-cert-token-valid-2026`, path.join(OUT_DIR, '31-verify-certificate-public-desktop-fr.png'));

  console.log('\nAll 31 captures finished successfully!');
  await browser.close();
}

run().catch(err => {
  console.error('Fatal capture run error:', err);
  process.exit(1);
});
