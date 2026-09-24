import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:3112';
const AUTH_ORIGIN = 'http://localhost:3111';
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

async function probe() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR',
  });
  await installAuthOriginRewrite(context);
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`[${msg.location().url || 'page'}] ${msg.text()}`);
    }
  });
  page.on('pageerror', err => {
    errors.push(`[PAGEERROR] ${err.message}`);
  });

  console.log('1. Logging in as school admin...');
  await page.goto(`${BASE}/fr/login`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.fill('input[type="email"], input[name="email"]', 'y.elamrani@atlas.ma');
  await page.fill('input[type="password"], input[name="password"]', 'Admin123!');
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 30000 });
  console.log('  -> Logged in!');

  // PROBE 1: Cards Template Designer
  console.log('\n2. Probing Cards Template Designer...');
  const cardUrl = `${BASE}/fr/dashboard/cards/templates/${ids.cardTemplateId}/edit`;
  errors.length = 0;
  await page.goto(cardUrl, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(3000);

  // Assert designer canvas mounted
  const cardCanvas = await page.$('.pdfme-designer-root');
  console.log('  -> Card designer mounted:', !!cardCanvas);
  const cardOverlay = await page.$('nextjs-portal');
  console.log('  -> Card nextjs-portal present:', !!cardOverlay);
  console.log('  -> Card console errors:', errors);

  // Exercise a safe save without corruption
  console.log('  -> Clicking Save button in card designer...');
  const saveBtn = await page.$('button:has-text("Sauvegarder"), button:has-text("Enregistrer")');
  let cardSaved = false;
  if (saveBtn) {
    const [saveRes] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/versions') && res.request().method() === 'POST', { timeout: 10000 }).catch(() => [null]),
      saveBtn.click(),
    ]);
    if (saveRes && typeof saveRes.status === 'function') {
      console.log('  -> Card save response status:', saveRes.status());
      cardSaved = saveRes.status() === 200;
    } else {
      console.log('  -> No response intercepted or failed');
    }
  }

  // PROBE 2: Certificates Template Designer
  console.log('\n3. Probing Certificates Template Designer...');
  const certUrl = `${BASE}/fr/dashboard/certificates/templates/${ids.certTemplateId}/edit`;
  errors.length = 0;
  await page.goto(certUrl, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(3000);

  const certCanvas = await page.$('.pdfme-designer-root');
  console.log('  -> Cert designer mounted:', !!certCanvas);
  const certOverlay = await page.$('nextjs-portal');
  console.log('  -> Cert nextjs-portal present:', !!certOverlay);
  console.log('  -> Cert console errors:', errors);

  console.log('  -> Clicking Save button in cert designer...');
  const certSaveBtn = await page.$('button:has-text("Sauvegarder"), button:has-text("Enregistrer")');
  let certSaved = false;
  if (certSaveBtn) {
    const [saveRes] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/versions') && res.request().method() === 'POST', { timeout: 10000 }).catch(() => [null]),
      certSaveBtn.click(),
    ]);
    if (saveRes && typeof saveRes.status === 'function') {
      console.log('  -> Cert save response status:', saveRes.status());
      certSaved = saveRes.status() === 200;
    } else {
      console.log('  -> No response intercepted or failed');
    }
  }

  // PROBE 3: Certificate Definition Detail
  console.log('\n4. Probing Certificate Definition Detail...');
  const defUrl = `${BASE}/fr/dashboard/certificates/definitions/${ids.certDefId}`;
  errors.length = 0;
  await page.goto(defUrl, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(3000);

  const defCanvas = await page.$('.pdfme-designer-root');
  console.log('  -> Def designer mounted:', !!defCanvas);
  const defOverlay = await page.$('nextjs-portal');
  console.log('  -> Def nextjs-portal present:', !!defOverlay);
  console.log('  -> Def console errors:', errors);

  await browser.close();

  const report = {
    cardDesignerMounted: !!cardCanvas,
    cardDesignerNoPortal: !cardOverlay,
    cardSaved,
    certDesignerMounted: !!certCanvas,
    certDesignerNoPortal: !certOverlay,
    certSaved,
    defDesignerMounted: !!defCanvas,
    defDesignerNoPortal: !defOverlay,
  };

  console.log('\n--- PROBE SUMMARY ---');
  console.log(JSON.stringify(report, null, 2));
}

probe().catch(console.error);
