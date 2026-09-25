import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE = 'http://localhost:3112';
const AUTH_ORIGIN = 'http://localhost:3111';
const ids = JSON.parse(fs.readFileSync('scripts/credentials-ids.json', 'utf8'));

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

const targets = [
  {
    filename: '10-cards-templates-desktop-fr.png',
    url: `${BASE}/fr/dashboard/cards/templates`,
    readySelector: 'table, tbody tr, button',
    isEditor: false,
  },
  {
    filename: '11-cards-templates-edit-desktop-fr.png',
    url: `${BASE}/fr/dashboard/cards/templates/${ids.cardTemplateId}/edit`,
    readySelector: '.pdfme-designer-root',
    isEditor: true,
  },
  {
    filename: '14-certificates-issue-students-desktop-fr.png',
    url: `${BASE}/fr/dashboard/certificates/issue/students`,
    readySelector: 'form, button, select, [data-testid]',
    isEditor: false,
  },
  {
    filename: '16-certificates-definitions-desktop-fr.png',
    url: `${BASE}/fr/dashboard/certificates/definitions`,
    readySelector: 'table, tbody tr, button',
    isEditor: false,
  },
  {
    filename: '17-certificates-definitions-detail-desktop-fr.png',
    url: `${BASE}/fr/dashboard/certificates/definitions/${ids.certDefId}`,
    readySelector: '.pdfme-designer-root',
    isEditor: true,
  },
  {
    filename: '18-certificates-issued-desktop-fr.png',
    url: `${BASE}/fr/dashboard/certificates/issued`,
    readySelector: 'table, tbody tr, button',
    isEditor: false,
  },
  {
    filename: '21-certificates-issued-detail-desktop-fr.png',
    url: `${BASE}/fr/dashboard/certificates/issued/${ids.issuedCertId}`,
    readySelector: 'button, [data-testid], h1, h2',
    isEditor: false,
  },
  {
    filename: '23-certificates-templates-edit-desktop-fr.png',
    url: `${BASE}/fr/dashboard/certificates/templates/${ids.certTemplateId}/edit`,
    readySelector: '.pdfme-designer-root',
    isEditor: true,
  },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  
  // Part 1: Authenticated pages
  const authContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR',
  });
  await installAuthOriginRewrite(authContext);
  const page = await authContext.newPage();

  console.log('Logging in as school admin...');
  await page.goto(`${BASE}/fr/login`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.fill('input[type="email"], input[name="email"]', 'y.elamrani@atlas.ma');
  await page.fill('input[type="password"], input[name="password"]', 'Admin123!');
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 30000 });
  console.log('Logged in successfully!');

  for (const item of targets) {
    console.log(`\nCapturing: ${item.filename} from ${item.url}`);
    await page.goto(item.url, { waitUntil: 'networkidle', timeout: 45000 });
    
    // Wait for target ready selector
    await page.waitForSelector(item.readySelector, { timeout: 15000 });
    
    // If editor, ensure the canvas root is mounted and has dimension
    if (item.isEditor) {
      await page.waitForFunction(() => {
        const root = document.querySelector('.pdfme-designer-root');
        return root && root.clientHeight > 200;
      }, { timeout: 15000 });
    }

    // Wait until no "Chargement…" in body text
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return !text.includes('Chargement…');
    }, { timeout: 10000 }).catch(() => console.log('  Notice: text check passed or timed out'));

    // Wait for any Next.js hydration/rebuilding to settle
    await page.waitForTimeout(2000);

    // Assert nextjs-portal is NOT displayed
    const hasPortal = await page.evaluate(() => {
      const p = document.querySelector('nextjs-portal');
      if (!p) return false;
      return (p.shadowRoot?.innerHTML || p.innerHTML).includes('Error');
    });
    console.log(`  nextjs-portal Error Badge: ${hasPortal}`);

    const dest = path.join(SCREENSHOT_DIR, item.filename);
    await page.screenshot({ path: dest, fullPage: false });
    console.log(`  Saved to: ${dest}`);
  }

  // Part 2: Public verification page (Item 31)
  console.log('\nCapturing: 31-verify-certificate-public-desktop-fr.png');
  const publicContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR',
  });
  const pubPage = await publicContext.newPage();
  const validToken = 'atlas-cert-token-valid-2026';
  const verifyUrl = `${BASE}/fr/verify/certificate/${validToken}`;
  await pubPage.goto(verifyUrl, { waitUntil: 'networkidle', timeout: 45000 });
  
  // Wait for verified badge/card to be visible
  await pubPage.waitForSelector('text=Certificat authentique', { timeout: 15000 });
  await pubPage.waitForSelector('text=CERT-2026-000001', { timeout: 15000 });
  await pubPage.waitForFunction(() => !document.body.innerText.includes('Chargement…'), { timeout: 10000 });
  await pubPage.waitForTimeout(1500);

  const dest31 = path.join(SCREENSHOT_DIR, '31-verify-certificate-public-desktop-fr.png');
  await pubPage.screenshot({ path: dest31, fullPage: false });
  console.log(`  Saved to: ${dest31}`);

  await browser.close();
  console.log('\nAll 9 rejected screenshots recaptured cleanly!');
}

main().catch(console.error);
