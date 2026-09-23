import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const ARTIFACTS_DIR = 'C:\\Users\\OMEN\\.gemini\\antigravity-ide\\brain\\fbc8f701-90a2-4609-9373-15e4fb1d7d39';

async function main() {
  console.log('Starting Playwright validation...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // 1. Login
  console.log('Navigating to login...');
  await page.goto('http://localhost:3111/fr/login', { waitUntil: 'networkidle' });

  // Fill credentials if on login page
  if (page.url().includes('/login')) {
    console.log('Entering credentials...');
    await page.fill('input[type="email"], input[name="email"]', 'y.elamrani@atlas.ma');
    await page.fill('input[type="password"], input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  }

  console.log('Navigating to /fr/dashboard...');
  await page.goto('http://localhost:3111/fr/dashboard', { waitUntil: 'networkidle' });
  // Wait for data to load (no skeleton)
  await page.waitForSelector('h1:has-text("Tableau de bord")', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // 2. Desktop Screenshot
  console.log('Capturing Desktop 1440px screenshot...');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'dashboard-desktop.png'), fullPage: true });

  // 3. Extract Runtime Values
  console.log('Extracting runtime values...');
  const data = await page.evaluate(() => {
    // Header & Subtitle
    const subtitleText = document.querySelector('header p')?.textContent || '';
    const headerCampusPill = document.querySelector('header .truncate')?.textContent || '';

    // Emergency button in sidebar
    const emergencyLink = document.querySelector('a[href*="/guard/emergency"]');
    const emergencyText = emergencyLink?.textContent?.trim() || '';
    const isEmergencyDanger = emergencyLink?.className?.includes('border-[#E5544B]') || false;

    // Body text for general inspection
    const bodyText = document.body.innerText;

    return {
      subtitleText,
      headerCampusPill,
      emergencyText,
      isEmergencyDanger,
    };
  });
  console.log('Runtime basic elements:', data);

  // Fetch API payload directly from page context to get exact numeric invariants
  const summaryPayload = await page.evaluate(async () => {
    const res = await fetch('/api/dashboard/summary');
    return res.json();
  });
  console.log('Summary API data:', JSON.stringify(summaryPayload.data, null, 2));

  // 4. Mobile Screenshot
  console.log('Capturing Mobile 390px screenshot...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'dashboard-mobile.png'), fullPage: true });

  // 5. Verify all 11 CTAs
  console.log('Verifying CTAs...');
  const ctas = [
    { name: 'Voir les factures', url: '/fr/dashboard/finance/invoices' },
    { name: 'Voir les présences', url: '/fr/dashboard/attendance' },
    { name: 'Consulter l\'effectif', url: '/fr/dashboard/students' },
    { name: 'Journal des encaissements', url: '/fr/dashboard/finance/payments' },
    { name: 'Relancer les impayés', url: '/fr/dashboard/finance/invoices' },
    { name: 'Voir Finance', url: '/fr/dashboard/finance' },
    { name: 'Voir présences', url: '/fr/dashboard/attendance' },
    { name: 'Voir calendrier', url: '/fr/dashboard/events' },
    { name: 'Voir tout', url: '/fr/dashboard/finance/payments' },
    { name: 'Voir annuaire', url: '/fr/dashboard/students' },
    { name: 'Voir classes', url: '/fr/dashboard/academics/classes' },
  ];

  for (const cta of ctas) {
    const res = await page.goto(`http://localhost:3111${cta.url}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const status = res?.status();
    console.log(`CTA: "${cta.name}" -> ${cta.url} returned status ${status}`);
  }

  await browser.close();
  console.log('Playwright validation complete!');
}

main().catch(err => {
  console.error('Validation error:', err);
  process.exit(1);
});
