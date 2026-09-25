import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE = 'http://localhost:3112';
const AUTH_ORIGIN = 'http://localhost:3111';
const OUT_DIR = path.resolve('artifacts/page-audit/done/AUD-CREDENTIALS-01__student-credentials/screenshots');

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

async function captureOne(page, url, outputPath) {
  console.log(`Recapturing: ${url} -> ${path.basename(outputPath)}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.waitForSelector('.animate-spin, [data-testid="loading"]', { state: 'detached', timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: outputPath, fullPage: false });
  console.log(`  ✓ Saved clean: ${path.basename(outputPath)}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR',
  });
  await installAuthOriginRewrite(context);
  const page = await context.newPage();

  console.log('Logging in as School Admin...');
  await page.goto(`${BASE}/fr/login`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.fill('input[type="email"], input[name="email"]', 'y.elamrani@atlas.ma');
  await page.fill('input[type="password"], input[name="password"]', 'Admin123!');
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 30000 });
  console.log('Login successful!');

  // Warm and capture the 5 routes sequentially with clean spacing
  await captureOne(page, `${BASE}/fr/dashboard/cards/templates`, path.join(OUT_DIR, '10-cards-templates-desktop-fr.png'));
  await captureOne(page, `${BASE}/fr/dashboard/cards/templates/${ids.cardTemplateId}/edit`, path.join(OUT_DIR, '11-cards-templates-edit-desktop-fr.png'));
  await captureOne(page, `${BASE}/fr/dashboard/certificates/definitions`, path.join(OUT_DIR, '16-certificates-definitions-desktop-fr.png'));
  await captureOne(page, `${BASE}/fr/dashboard/certificates/issued`, path.join(OUT_DIR, '18-certificates-issued-desktop-fr.png'));
  await captureOne(page, `${BASE}/fr/dashboard/certificates/requests`, path.join(OUT_DIR, '24-certificates-requests-desktop-fr.png'));

  console.log('All 5 recaptures clean and completed!');
  await browser.close();
}

main().catch(err => {
  console.error('Recapture error:', err);
  process.exit(1);
});
