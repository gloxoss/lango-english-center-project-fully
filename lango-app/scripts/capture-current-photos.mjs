import { chromium } from 'playwright';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:\\Users\\OMEN\\.gemini\\antigravity-ide\\brain\\ead20cd7-a5ed-4d1a-98cf-1b248648e7e7';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const page = await context.newPage();

  console.log('Logging in...');
  await page.goto('http://localhost:3222/fr/login', { waitUntil: 'networkidle' });
  if (page.url().includes('/login')) {
    await page.fill('input[type="email"], input[name="email"]', 'y.elamrani@atlas.ma');
    await page.fill('input[type="password"], input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]', { force: true });
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  }

  console.log('Navigating to Photos gallery...');
  await page.goto('http://localhost:3222/fr/dashboard/students/photos', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const screenshotPath = path.join(ARTIFACTS_DIR, 'current-photos-gallery-before.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log('Saved screenshot to', screenshotPath);

  // Extract DOM info about each card
  const cards = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    // Find student cards
    return buttons.map(b => ({
      text: b.innerText,
      hasImg: !!b.querySelector('img'),
      imgSrc: b.querySelector('img')?.getAttribute('src') || null,
    })).filter(c => c.text.includes('Élève') || c.text.includes('Photo') || c.imgSrc);
  });
  console.log('Cards found:', JSON.stringify(cards, null, 2));

  await browser.close();
}

main().catch(console.error);
