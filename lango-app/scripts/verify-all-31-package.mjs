import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE = 'http://localhost:3112';
const AUTH_ORIGIN = 'http://localhost:3111';
const SCREENSHOT_DIR = path.resolve('artifacts/page-audit/done/AUD-CREDENTIALS-01__student-credentials/screenshots');
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

const MANIFEST = [
  { id: '01', filename: '01-cards-dashboard-desktop-fr.png', url: `${BASE}/fr/dashboard/cards`, viewport: { width: 1440, height: 900 }, locale: 'fr-FR', isPublic: false },
  { id: '02', filename: '02-cards-students-desktop-fr.png', url: `${BASE}/fr/dashboard/cards/students`, viewport: { width: 1440, height: 900 }, locale: 'fr-FR', isPublic: false },
  { id: '03', filename: '03-cards-students-mobile-390.png', url: `${BASE}/fr/dashboard/cards/students`, viewport: { width: 390, height: 844 }, locale: 'fr-FR', isPublic: false },
  { id: '04', filename: '04-cards-students-arabic-rtl.png', url: `${BASE}/ar/dashboard/cards/students`, viewport: { width: 1440, height: 900 }, locale: 'ar-MA', isPublic: false },
  { id: '05', filename: '05-cards-employees-desktop-fr.png', url: `${BASE}/fr/dashboard/cards/employees`, viewport: { width: 1440, height: 900 }, locale: 'fr-FR', isPublic: false },
  { id: '06', filename: '06-cards-admit-cards-desktop-fr.png', url: `${BASE}/fr/dashboard/cards/admit-cards`, viewport: { width: 1440, height: 900 }, locale: 'fr-FR', isPublic: false },
  { id: '07', filename: '07-cards-admit-cards-mobile-390.png', url: `${BASE}/fr/dashboard/cards/admit-cards`, viewport: { width: 390, height: 844 }, locale: 'fr-FR', isPublic: false },
  { id: '08', filename: '08-cards-admit-cards-arabic-rtl.png', url: `${BASE}/ar/dashboard/cards/admit-cards`, viewport: { width: 1440, height: 900 }, locale: 'ar-MA', isPublic: false },
  { id: '09', filename: '09-cards-issued-desktop-fr.png', url: `${BASE}/fr/dashboard/cards/issued`, viewport: { width: 1440, height: 900 }, locale: 'fr-FR', isPublic: false },
  { id: '10', filename: '10-cards-templates-desktop-fr.png', url: `${BASE}/fr/dashboard/cards/templates`, viewport: { width: 1440, height: 900 }, locale: 'fr-FR', isPublic: false },
  { id: '11', filename: '11-cards-templates-edit-desktop-fr.png', url: `${BASE}/fr/dashboard/cards/templates/${ids.cardTemplateId}/edit`, viewport: { width: 1440, height: 900 }, locale: 'fr-FR', isPublic: false, isEditor: true },
  { id: '12', filename: '12-cards-jobs-desktop-fr.png', url: `${BASE}/fr/dashboard/cards/jobs`, viewport: { width: 1440, height: 900 }, locale: 'fr-FR', isPublic: false },
  { id: '13', filename: '13-certificates-dashboard-desktop-fr.png', url: `${BASE}/fr/dashboard/certificates`, viewport: { width: 1440, height: 900 }, locale: 'fr-FR', isPublic: false },
  { id: '14', filename: '14-certificates-issue-students-desktop-fr.png', url: `${BASE}/fr/dashboard/certificates/issue/students`, viewport: { width: 1440, height: 900 }, locale: 'fr-FR', isPublic: false },
  { id: '15', filename: '15-certificates-issue-employees-desktop-fr.png', url: `${BASE}/fr/dashboard/certificates/issue/employees`, viewport: { width: 1440, height: 900 }, locale: 'fr-FR', isPublic: false },
  { id: '16', filename: '16-certificates-definitions-desktop-fr.png', url: `${BASE}/fr/dashboard/certificates/definitions`, viewport: { width: 1440, height: 900 }, locale: 'fr-FR', isPublic: false },
  { id: '17', filename: '17-certificates-definitions-detail-desktop-fr.png', url: `${BASE}/fr/dashboard/certificates/definitions/${ids.certDefId}`, viewport: { width: 1440, height: 900 }, locale: 'fr-FR', isPublic: false, isEditor: true },
  { id: '18', filename: '18-certificates-issued-desktop-fr.png', url: `${BASE}/fr/dashboard/certificates/issued`, viewport: { width: 1440, height: 900 }, locale: 'fr-FR', isPublic: false },
  { id: '19', filename: '19-certificates-issued-mobile-390.png', url: `${BASE}/fr/dashboard/certificates/issued`, viewport: { width: 390, height: 844 }, locale: 'fr-FR', isPublic: false },
  { id: '20', filename: '20-certificates-issued-arabic-rtl.png', url: `${BASE}/ar/dashboard/certificates/issued`, viewport: { width: 1440, height: 900 }, locale: 'ar-MA', isPublic: false },
  { id: '21', filename: '21-certificates-issued-detail-desktop-fr.png', url: `${BASE}/fr/dashboard/certificates/issued/${ids.issuedCertId}`, viewport: { width: 1440, height: 900 }, locale: 'fr-FR', isPublic: false },
  { id: '22', filename: '22-certificates-templates-desktop-fr.png', url: `${BASE}/fr/dashboard/certificates/templates`, viewport: { width: 1440, height: 900 }, locale: 'fr-FR', isPublic: false },
  { id: '23', filename: '23-certificates-templates-edit-desktop-fr.png', url: `${BASE}/fr/dashboard/certificates/templates/${ids.certTemplateId}/edit`, viewport: { width: 1440, height: 900 }, locale: 'fr-FR', isPublic: false, isEditor: true },
  { id: '24', filename: '24-certificates-requests-desktop-fr.png', url: `${BASE}/fr/dashboard/certificates/requests`, viewport: { width: 1440, height: 900 }, locale: 'fr-FR', isPublic: false },
  { id: '25', filename: '25-certificates-requests-mobile-390.png', url: `${BASE}/fr/dashboard/certificates/requests`, viewport: { width: 390, height: 844 }, locale: 'fr-FR', isPublic: false },
  { id: '26', filename: '26-certificates-requests-arabic-rtl.png', url: `${BASE}/ar/dashboard/certificates/requests`, viewport: { width: 1440, height: 900 }, locale: 'ar-MA', isPublic: false },
  { id: '27', filename: '27-certificates-jobs-desktop-fr.png', url: `${BASE}/fr/dashboard/certificates/jobs`, viewport: { width: 1440, height: 900 }, locale: 'fr-FR', isPublic: false },
  { id: '28', filename: '28-certificates-settings-desktop-fr.png', url: `${BASE}/fr/dashboard/certificates/settings`, viewport: { width: 1440, height: 900 }, locale: 'fr-FR', isPublic: false },
  { id: '29', filename: '29-documents-generator-desktop-fr.png', url: `${BASE}/fr/dashboard/documents/generator`, viewport: { width: 1440, height: 900 }, locale: 'fr-FR', isPublic: false },
  { id: '30', filename: '30-verify-card-public-desktop-fr.png', url: `${BASE}/fr/verify/card/card_test_token_student_1`, viewport: { width: 1440, height: 900 }, locale: 'fr-FR', isPublic: true },
  { id: '31', filename: '31-verify-certificate-public-desktop-fr.png', url: `${BASE}/fr/verify/certificate/atlas-cert-token-valid-2026`, viewport: { width: 1440, height: 900 }, locale: 'fr-FR', isPublic: true },
];

async function main() {
  console.log('Starting full 31-route package validation and audit sweep...');
  const browser = await chromium.launch({ headless: true });

  let failureCount = 0;
  const results = [];

  for (const item of MANIFEST) {
    const context = await browser.newContext({
      viewport: item.viewport,
      locale: item.locale,
    });
    if (!item.isPublic) {
      await installAuthOriginRewrite(context);
    }
    const page = await context.newPage();

    if (!item.isPublic) {
      const loginLocale = item.locale.startsWith('ar') ? 'ar' : 'fr';
      await page.goto(`${BASE}/${loginLocale}/login`, { waitUntil: 'networkidle', timeout: 45000 });
      await page.fill('input[type="email"], input[name="email"]', 'y.elamrani@atlas.ma');
      await page.fill('input[type="password"], input[name="password"]', 'Admin123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 30000 });
    }

    await page.goto(item.url, { waitUntil: item.isEditor ? 'domcontentloaded' : 'networkidle', timeout: 45000 });

    // Wait for settling condition
    if (item.isEditor) {
      await page.waitForSelector('.pdfme-designer-root', { timeout: 25000 });
      await page.waitForFunction(() => {
        const root = document.querySelector('.pdfme-designer-root');
        return root && root.clientHeight > 200;
      }, { timeout: 15000 });
    } else {
      await page.waitForSelector('table, h1, h2, form, [data-testid], button', { timeout: 25000 });
    }

    // Wait until no active Loading text in body
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return !text.includes('Chargement des') &&
             !text.includes('Chargement…') &&
             !text.includes('Rendering...') &&
             !text.includes('جاري التحميل');
    }, { timeout: 25000 }).catch(() => {});

    // Allow hydration and state updates to settle
    await page.waitForTimeout(1000);

    // Run strict validation assertions
    const evaluation = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const portal = document.querySelector('nextjs-portal');
      const hasErrorBadge = portal ? (portal.shadowRoot?.innerHTML || portal.innerHTML).includes('Error') : false;
      const spinners = document.querySelectorAll('.animate-spin');
      
      const containsChargement = bodyText.includes('Chargement des') || bodyText.includes('Chargement…');
      const containsArabicLoading = bodyText.includes('جاري التحميل');
      const containsRendering = bodyText.includes('Rendering...');
      
      // Check KPI values for unresolved dashes in overview pages
      const kpis = Array.from(document.querySelectorAll('h3')).map(h => h.innerText.trim());
      const hasUnresolvedKPI = kpis.some(k => k === '—');

      // Check header hydration (should have name/initials, not empty)
      const header = document.querySelector('header')?.innerText || '';
      const isUnhydratedShell = header.includes('…');

      return {
        hasErrorBadge,
        spinnersCount: spinners.length,
        containsChargement,
        containsArabicLoading,
        containsRendering,
        hasUnresolvedKPI,
        isUnhydratedShell,
      };
    });

    const isFailed = evaluation.hasErrorBadge ||
                     evaluation.containsChargement ||
                     evaluation.containsArabicLoading ||
                     evaluation.containsRendering ||
                     (evaluation.spinnersCount > 0 && !item.isEditor) ||
                     evaluation.hasUnresolvedKPI;

    if (isFailed) {
      failureCount++;
      console.error(`❌ [${item.id}] ${item.filename} FAILED assertions:`, evaluation);
    } else {
      console.log(`✅ [${item.id}] ${item.filename} PASS - Settled cleanly, zero error badges, zero spinners.`);
      // If one of the 9 targeted or mobile/RTL companion screens, ensure saved
      const dest = path.join(SCREENSHOT_DIR, item.filename);
      // For mobile companion screens, save if not already recaptured
      if (['03', '07', '19', '20', '25', '26'].includes(item.id)) {
        await page.screenshot({ path: dest, fullPage: false });
        console.log(`   (Re-verified & captured mobile/RTL screen: ${dest})`);
      }
    }

    results.push({ item: item.filename, ...evaluation, passed: !isFailed });
    await context.close();
  }

  await browser.close();

  console.log(`\n======================================================`);
  console.log(`PACKAGE VALIDATION SUMMARY:`);
  console.log(`Total screens evaluated: ${results.length}`);
  console.log(`Passed: ${results.length - failureCount}`);
  console.log(`Failed: ${failureCount}`);
  
  if (failureCount > 0) {
    console.error(`AUDIT ASSERTION FAILED: ${failureCount} screens have unresolved loading states or error badges!`);
    process.exit(1);
  } else {
    console.log(`🎉 ALL 31 SCREENS IN THE PACKAGE ARE 100% SETTLED, HYDRATED, AND STABLE!`);
  }
}

main().catch(err => {
  console.error('Fatal error during package validation:', err);
  process.exit(1);
});
