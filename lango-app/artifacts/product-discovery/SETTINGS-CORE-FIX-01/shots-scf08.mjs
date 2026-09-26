// SCF-08-02 proof: student detail custom-fields card, live round trip + screenshots.
// Run: BASE=http://localhost:3537 node artifacts/product-discovery/SETTINGS-CORE-FIX-01/shots-scf08.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const H = process.env.BASE ?? 'http://localhost:3537';
const OUT = 'artifacts/product-discovery/SETTINGS-CORE-FIX-01/screenshots';
const STUDENT = process.env.STUDENT_ID ?? 'STU-0002';
const VARIANTS = [
  { id: 'fr', locale: 'fr', viewport: { width: 1440, height: 900 } },
  { id: 'fr-phone', locale: 'fr', viewport: { width: 390, height: 844 } },
  { id: 'ar', locale: 'ar', viewport: { width: 1440, height: 900 } },
];

const browser = await chromium.launch();
for (const v of VARIANTS) {
  const ctx = await browser.newContext({ viewport: v.viewport, locale: v.locale === 'ar' ? 'ar-MA' : 'fr-FR' });
  await ctx.request.post(`${H}/api/auth/sign-in/email`, {
    headers: { Origin: H, 'Content-Type': 'application/json' },
    data: { email: 'y.elamrani@atlas.ma', password: 'Admin123!' },
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  const api5xx = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });
  page.on('response', res => { if (res.url().includes('/api/') && res.status() >= 500) api5xx.push(`${res.status()} ${res.url().replace(H, '')}`); });

  const resp = await page.goto(`${H}/${v.locale}/dashboard/students/${STUDENT}`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(1200);

  // Live round trip (FR desktop only): set the sport field through the card.
  let savedValue = null;
  if (v.id === 'fr') {
    const row = page.locator('div').filter({ has: page.locator('label', { hasText: 'Sport pratiqué' }) }).last();
    const editButton = row.locator('button').first();
    if (await editButton.count()) {
      await editButton.click();
      const control = row.locator('select, input').first();
      const tag = await control.evaluate(el => el.tagName);
      if (tag === 'SELECT') await control.selectOption('natation');
      else await control.fill('Natation');
      await row.locator('button').first().click();
      await page.waitForTimeout(1500);
      savedValue = await row.locator('p').first().textContent();
    }
  }

  const info = await page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    const text = main.innerText || '';
    return {
      text: text.slice(0, 5000),
      hasCardTitleKey: /StudentDetail\.customFieldsTitle/.test(text),
      hasCardTitleFr: /Champs personnalisés/.test(text),
      hasSport: /Sport pratiqué/.test(text),
      dir: document.documentElement.dir,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  await page.screenshot({ path: `${OUT}/scf08-02-student-custom-fields-${v.id}.png`, fullPage: true });
  const missingMessage = consoleErrors.filter(e => e.includes('MISSING_MESSAGE') && e.includes('StudentDetail.customFields'));
  fs.writeFileSync(`${OUT}/scf08-02-student-custom-fields-${v.id}.json`, JSON.stringify({ ...info, status: resp?.status(), savedValue, missingMessage, consoleErrors: consoleErrors.slice(0, 6), api5xx }, null, 2));
  console.log(`--- scf08-02-${v.id}: status=${resp?.status()} dir=${info.dir} overflowX=${info.overflowX} cardTitleKey=${info.hasCardTitleKey} cardTitleFr=${info.hasCardTitleFr} sport=${info.hasSport} savedValue=${JSON.stringify(savedValue)} missingCustomFieldsKeys=${missingMessage.length} 5xx=${api5xx.join(';') || 'none'}`);
  await ctx.close();
}
await browser.close();
