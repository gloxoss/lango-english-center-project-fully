import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE = 'http://localhost:3112';
const AUTH_ORIGIN = 'http://localhost:3111';
const SCREENSHOT_DIR = path.resolve('artifacts/page-audit/done/AUD-CREDENTIALS-01__student-credentials/screenshots');

async function installAuthOriginRewrite(context) {
  await context.route('**/api/auth/sign-in/**', async (route) => {
    const req = route.request();
    const headers = { ...req.headers() };
    headers.origin = AUTH_ORIGIN;
    const resp = await route.fetch({ headers, postData: req.postDataBuffer() });
    await route.fulfill({ response: resp });
  });
}

const TARGETS = [
  {
    filename: '01-cards-dashboard-desktop-fr.png',
    url: `${BASE}/fr/dashboard/cards`,
    locale: 'fr-FR',
    viewport: { width: 1440, height: 900 },
    settleCheck: async (page) => {
      // Wait for overview API response and KPI values to resolve
      await page.waitForFunction(() => {
        const kpiH3s = Array.from(document.querySelectorAll('h3'));
        const hasDash = kpiH3s.some(h => h.innerText.trim() === '—');
        const hasSpinner = Boolean(document.querySelector('.animate-spin'));
        const bodyText = document.body.innerText;
        return !hasDash && !hasSpinner && !bodyText.includes('Chargement');
      }, { timeout: 30000 });
    }
  },
  {
    filename: '02-cards-students-desktop-fr.png',
    url: `${BASE}/fr/dashboard/cards/students`,
    locale: 'fr-FR',
    viewport: { width: 1440, height: 900 },
    settleCheck: async (page) => {
      // Wait until students table is populated or empty state rendered
      await page.waitForFunction(() => {
        const bodyText = document.body.innerText;
        const hasLoading = bodyText.includes('Chargement des élèves') || bodyText.includes('Chargement…');
        const hasTableData = document.querySelector('tbody tr');
        return !hasLoading && Boolean(hasTableData);
      }, { timeout: 30000 });
    }
  },
  {
    filename: '04-cards-students-arabic-rtl.png',
    url: `${BASE}/ar/dashboard/cards/students`,
    locale: 'ar-MA',
    viewport: { width: 1440, height: 900 },
    settleCheck: async (page) => {
      await page.waitForFunction(() => {
        const bodyText = document.body.innerText;
        const hasLoading = bodyText.includes('جاري التحميل') || bodyText.includes('Chargement');
        const hasTableData = document.querySelector('tbody tr');
        return !hasLoading && Boolean(hasTableData);
      }, { timeout: 30000 });
    }
  },
  {
    filename: '05-cards-employees-desktop-fr.png',
    url: `${BASE}/fr/dashboard/cards/employees`,
    locale: 'fr-FR',
    viewport: { width: 1440, height: 900 },
    settleCheck: async (page) => {
      await page.waitForFunction(() => {
        const bodyText = document.body.innerText;
        const hasLoading = bodyText.includes('Chargement des employés') || bodyText.includes('Chargement');
        const hasTableData = document.querySelector('tbody tr');
        return !hasLoading && Boolean(hasTableData);
      }, { timeout: 30000 });
    }
  },
  {
    filename: '06-cards-admit-cards-desktop-fr.png',
    url: `${BASE}/fr/dashboard/cards/admit-cards`,
    locale: 'fr-FR',
    viewport: { width: 1440, height: 900 },
    settleCheck: async (page) => {
      await page.waitForFunction(() => {
        const bodyText = document.body.innerText;
        const hasLoading = bodyText.includes("Chargement des places d'examen") || bodyText.includes('Chargement');
        const hasTableData = document.querySelector('tbody tr');
        return !hasLoading && Boolean(hasTableData);
      }, { timeout: 30000 });
    }
  },
  {
    filename: '08-cards-admit-cards-arabic-rtl.png',
    url: `${BASE}/ar/dashboard/cards/admit-cards`,
    locale: 'ar-MA',
    viewport: { width: 1440, height: 900 },
    settleCheck: async (page) => {
      await page.waitForFunction(() => {
        const bodyText = document.body.innerText;
        const hasLoading = bodyText.includes('جاري التحميل') || bodyText.includes('Chargement');
        const hasTableData = document.querySelector('tbody tr');
        return !hasLoading && Boolean(hasTableData);
      }, { timeout: 30000 });
    }
  },
  {
    filename: '12-cards-jobs-desktop-fr.png',
    url: `${BASE}/fr/dashboard/cards/jobs`,
    locale: 'fr-FR',
    viewport: { width: 1440, height: 900 },
    settleCheck: async (page) => {
      await page.waitForFunction(() => {
        const bodyText = document.body.innerText;
        const hasLoading = bodyText.includes('Chargement des tâches') || bodyText.includes('Chargement');
        const hasTableData = document.querySelector('tbody tr');
        return !hasLoading && Boolean(hasTableData);
      }, { timeout: 30000 });
    }
  },
  {
    filename: '13-certificates-dashboard-desktop-fr.png',
    url: `${BASE}/fr/dashboard/certificates`,
    locale: 'fr-FR',
    viewport: { width: 1440, height: 900 },
    settleCheck: async (page) => {
      await page.waitForFunction(() => {
        const kpiH3s = Array.from(document.querySelectorAll('h3'));
        const hasDash = kpiH3s.some(h => h.innerText.trim() === '—');
        const hasSpinner = Boolean(document.querySelector('.animate-spin'));
        const bodyText = document.body.innerText;
        return !hasDash && !hasSpinner && !bodyText.includes('Chargement');
      }, { timeout: 30000 });
    }
  },
  {
    filename: '15-certificates-issue-employees-desktop-fr.png',
    url: `${BASE}/fr/dashboard/certificates/issue/employees`,
    locale: 'fr-FR',
    viewport: { width: 1440, height: 900 },
    settleCheck: async (page) => {
      await page.waitForFunction(() => {
        const bodyText = document.body.innerText;
        const hasLoading = bodyText.includes('Chargement…') || bodyText.includes('Chargement');
        const hasTableData = document.querySelector('tbody tr');
        return !hasLoading && Boolean(hasTableData);
      }, { timeout: 30000 });
    }
  },
];

async function main() {
  const browser = await chromium.launch({ headless: true });

  for (const item of TARGETS) {
    console.log(`\n======================================================`);
    console.log(`Capturing settled state for: ${item.filename}`);
    console.log(`URL: ${item.url}`);
    
    const context = await browser.newContext({
      viewport: item.viewport,
      locale: item.locale,
    });
    await installAuthOriginRewrite(context);
    const page = await context.newPage();

    // Login as school admin
    const loginLocale = item.locale.startsWith('ar') ? 'ar' : 'fr';
    await page.goto(`${BASE}/${loginLocale}/login`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.fill('input[type="email"], input[name="email"]', 'y.elamrani@atlas.ma');
    await page.fill('input[type="password"], input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 30000 });

    // Navigate to target route
    await page.goto(item.url, { waitUntil: 'networkidle', timeout: 45000 });

    // Wait for authenticated header to be hydrated (user initials or name present)
    await page.waitForFunction(() => {
      const headerText = document.querySelector('header')?.innerText || '';
      return headerText.includes('Yassine') || headerText.includes('YE') || headerText.includes('ياسين');
    }, { timeout: 20000 }).catch(() => console.log('  Notice: header check timed out, continuing'));

    // Execute route-specific settled check
    console.log('  Waiting for route settled condition...');
    await item.settleCheck(page);
    console.log('  Settled condition satisfied!');

    // Universal assertion: no "Chargement", no "جاري التحميل", no "Rendering...", no error portal
    const bodyText = await page.evaluate(() => document.body.innerText);
    const forbiddenPatterns = ['Chargement des élèves', 'Chargement des places', 'Chargement des employés', 'Chargement des tâches', 'Rendering...'];
    for (const pat of forbiddenPatterns) {
      if (bodyText.includes(pat)) {
        throw new Error(`Route ${item.filename} still contains forbidden pattern: "${pat}"!`);
      }
    }

    const hasPortal = await page.evaluate(() => {
      const p = document.querySelector('nextjs-portal');
      if (!p) return false;
      return (p.shadowRoot?.innerHTML || p.innerHTML).includes('Error');
    });
    if (hasPortal) {
      throw new Error(`Route ${item.filename} has nextjs-portal Error Badge!`);
    }
    console.log(`  nextjs-portal Error Badge: false`);

    // Settle for 1000ms and screenshot
    await page.waitForTimeout(1000);
    const dest = path.join(SCREENSHOT_DIR, item.filename);
    await page.screenshot({ path: dest, fullPage: false });
    console.log(`  Successfully saved settled screenshot to: ${dest}`);

    await context.close();
  }

  await browser.close();
  console.log('\n======================================================');
  console.log('ALL 9 ADDITIONAL LOADING-STATE SCREENSHOTS RECAPTURED CLEANLY!');
}

main().catch(err => {
  console.error('\nFATAL ERROR DURING RECAPTURE:', err);
  process.exit(1);
});
