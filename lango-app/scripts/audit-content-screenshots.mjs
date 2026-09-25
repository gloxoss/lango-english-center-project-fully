import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3115';
const OUT_DIR = path.resolve('artifacts/page-audit/done/AUD-CONTENT-01__attachments-book/screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function assertNoLoadingText(page, name) {
  const loadingCount = await page.locator('text=Chargement...').count();
  const loadingArabic = await page.locator('text=جاري التحميل...').count();
  if (loadingCount > 0 || loadingArabic > 0) {
    throw new Error(`Screenshot [${name}] contains unresolved loading state!`);
  }

  const isRendering = await page.evaluate(() => {
    const portals = Array.from(document.querySelectorAll('nextjs-portal'));
    for (const p of portals) {
      const text = p.shadowRoot ? p.shadowRoot.textContent : p.textContent;
      if (/rendering/i.test(text || '')) {
        return true;
      }
    }
    const bodyText = document.body ? document.body.innerText : '';
    return /rendering\s*\.\.\./i.test(bodyText);
  });

  if (isRendering) {
    throw new Error(`Screenshot [${name}] still contains active Next.js Rendering... indicator!`);
  }
}

async function waitForSettle(page, name) {
  // 1. Wait for loading indicators to detach
  await page.waitForSelector('text=Chargement...', { state: 'detached', timeout: 20000 }).catch(() => {});
  await page.waitForSelector('text=جاري التحميل...', { state: 'detached', timeout: 20000 }).catch(() => {});

  // 2. Wait for Next.js "Rendering..." dev indicator to finish
  await page.waitForFunction(() => {
    const portals = Array.from(document.querySelectorAll('nextjs-portal'));
    for (const p of portals) {
      const text = p.shadowRoot ? p.shadowRoot.textContent : p.textContent;
      if (/rendering/i.test(text || '')) {
        return false;
      }
    }
    const bodyText = document.body ? document.body.innerText : '';
    if (/rendering\s*\.\.\./i.test(bodyText)) {
      return false;
    }
    return true;
  }, { timeout: 30000 }).catch(() => {});

  // 3. Grace period for render badge to collapse completely
  await page.waitForTimeout(4000);

  // 4. Assert clean settled state
  await assertNoLoadingText(page, name);
}

async function login(browser, viewport, locale = 'fr') {
  const ctx = await browser.newContext({
    viewport,
    locale: locale === 'ar' ? 'ar-MA' : 'fr-FR',
  });
  const page = await ctx.newPage();
  console.log(`Logging in on ${BASE}/fr/login...`);
  page.on('console', m => console.log(`[Browser Console ${m.type()}]:`, m.text()));
  page.on('pageerror', err => console.log('[Browser Error]:', err.message));
  page.on('response', r => {
    if (r.url().includes('/api/auth')) {
      console.log(`[Auth Response]: ${r.status()} ${r.url()}`);
    }
  });

  await page.goto(`${BASE}/fr/login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"]').fill('y.elamrani@atlas.ma');
  await page.locator('input[type="password"]').fill('Admin123!');
  console.log('Filled credentials, clicking submit button...');
  await page.locator('button[type="submit"]').click();
  
  // Wait up to 10s for either URL change or error on screen
  try {
    await page.waitForURL(u => !String(u).includes('/login'), { timeout: 45000 });
    console.log('Login successful, URL:', page.url());
  } catch (err) {
    const errorText = await page.locator('.text-red-500, .bg-red-50, [role="alert"]').allInnerTexts();
    console.error('Login did not navigate! Error on page:', errorText);
    throw err;
  }
  return { ctx, page };
}

async function main() {
  console.log('================================================================');
  console.log('   AUD-CONTENT-01 VISUAL EVIDENCE CAPTURE (PORT 3115)          ');
  console.log('================================================================\n');

  const browser = await chromium.launch({ headless: true });

  try {
    const { page } = await login(browser, { width: 1440, height: 900 }, 'fr');

    // -------------------------------------------------------------------------
    // PAGE 1: /dashboard/content/library
    // -------------------------------------------------------------------------
    console.log('\n--- Capturing /dashboard/content/library ---');
    
    // 1. Desktop FR
    console.log('Navigating to Desktop FR library...');
    await page.goto(`${BASE}/fr/dashboard/content/library`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('table tbody tr', { timeout: 30000 });
    await waitForSettle(page, 'content_library_desktop_fr');
    await page.screenshot({
      path: path.join(OUT_DIR, 'content_library_desktop_fr.png'),
      fullPage: false,
    });
    console.log('Captured content_library_desktop_fr.png');

    // 2. Modal: Nouvelle Ressource
    console.log('Opening Create Asset modal...');
    await page.locator('button:has-text("Nouvelle Ressource")').click();
    await page.waitForSelector('text=Nouvelle Ressource Pédagogique', { timeout: 15000 });
    await waitForSettle(page, 'content_library_create_modal');
    await page.screenshot({
      path: path.join(OUT_DIR, 'content_library_create_modal.png'),
      fullPage: false,
    });
    console.log('Captured content_library_create_modal.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // 3. Modal: Inspect/Details
    console.log('Opening Inspect Asset modal...');
    const inspectBtn = page.locator('table tbody tr button[title="Détails"]').first();
    await inspectBtn.click();
    await page.waitForSelector('text=Versions', { timeout: 15000 });
    await waitForSettle(page, 'content_library_inspect_modal');
    await page.screenshot({
      path: path.join(OUT_DIR, 'content_library_inspect_modal.png'),
      fullPage: false,
    });
    console.log('Captured content_library_inspect_modal.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // 4. Mobile 390 Library (viewport resize)
    console.log('Resizing to Mobile 390 viewport...');
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForSettle(page, 'content_library_mobile_390');
    await page.screenshot({
      path: path.join(OUT_DIR, 'content_library_mobile_390.png'),
      fullPage: false,
    });
    console.log('Captured content_library_mobile_390.png');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(1000);

    // 5. Arabic RTL Library
    console.log('Navigating to Arabic RTL library...');
    await page.goto(`${BASE}/ar/dashboard/content/library`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('table tbody tr', { timeout: 30000 });
    await waitForSettle(page, 'content_library_arabic_rtl');
    await page.screenshot({
      path: path.join(OUT_DIR, 'content_library_arabic_rtl.png'),
      fullPage: false,
    });
    console.log('Captured content_library_arabic_rtl.png');

    // -------------------------------------------------------------------------
    // PAGE 2: /dashboard/content/types
    // -------------------------------------------------------------------------
    console.log('\n--- Capturing /dashboard/content/types ---');

    // 6. Desktop FR Types
    console.log('Navigating to Desktop FR types...');
    await page.goto(`${BASE}/fr/dashboard/content/types`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('table tbody tr', { timeout: 30000 });
    await waitForSettle(page, 'content_types_desktop_fr');
    await page.screenshot({
      path: path.join(OUT_DIR, 'content_types_desktop_fr.png'),
      fullPage: false,
    });
    console.log('Captured content_types_desktop_fr.png');

    // 7. Types Archivés Tab
    console.log('Switching to Types archivés tab...');
    await page.locator('button:has-text("Types archivés")').click();
    await page.waitForSelector('table tbody tr', { timeout: 15000 }).catch(() => {});
    await waitForSettle(page, 'content_types_archived_tab');
    await page.screenshot({
      path: path.join(OUT_DIR, 'content_types_archived_tab.png'),
      fullPage: false,
    });
    console.log('Captured content_types_archived_tab.png');
    await page.locator('button:has-text("Types actifs")').click();
    await page.waitForTimeout(1000);

    // 8. Mobile 390 Types (viewport resize)
    console.log('Resizing to Mobile 390 viewport...');
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForSettle(page, 'content_types_mobile_390');
    await page.screenshot({
      path: path.join(OUT_DIR, 'content_types_mobile_390.png'),
      fullPage: false,
    });
    console.log('Captured content_types_mobile_390.png');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(1000);

    // 9. Arabic RTL Types
    console.log('Navigating to Arabic RTL types...');
    await page.goto(`${BASE}/ar/dashboard/content/types`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('table tbody tr', { timeout: 30000 });
    await waitForSettle(page, 'content_types_arabic_rtl');
    await page.screenshot({
      path: path.join(OUT_DIR, 'content_types_arabic_rtl.png'),
      fullPage: false,
    });
    console.log('Captured content_types_arabic_rtl.png');

    console.log('\nAll 9 visual evidence screenshots captured successfully!');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Visual capture failed:', err);
  process.exit(1);
});
