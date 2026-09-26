// SCF-09-01 proof: /settings hub completeness + card cleanup, FR/390/AR.
// Run: BASE=http://localhost:3537 node artifacts/product-discovery/SETTINGS-CORE-FIX-01/shots-scf09.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const H = process.env.BASE ?? 'http://localhost:3537';
const OUT = 'artifacts/product-discovery/SETTINGS-CORE-FIX-01/screenshots';
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

  const resp = await page.goto(`${H}/${v.locale}/dashboard/settings`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    const text = main.innerText || '';
    const providerAnchor = [...document.querySelectorAll('a')].find(a => (a.textContent || '').includes('Connexions & Fournisseurs'));
    const missing = [...new Set((text.match(/\bSettings\.[A-Za-z0-9_]+\b/g) || []))];
    return {
      text: text.slice(0, 9000),
      providerHref: providerAnchor?.getAttribute('href') ?? null,
      missingKeys: missing,
      dir: document.documentElement.dir,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      hasTranslationsCard: /Traductions & Champs/.test(text),
      hasJobsCard: /Tâches Planifiées & Audit/.test(text),
      hasNumberingCard: /Séries de numérotation/.test(text),
    };
  });
  await page.screenshot({ path: `${OUT}/scf09-01-settings-${v.id}.png`, fullPage: true });
  const missingMessage = consoleErrors.filter(e => e.includes('MISSING_MESSAGE'));
  fs.writeFileSync(`${OUT}/scf09-01-settings-${v.id}.json`, JSON.stringify({ ...info, status: resp?.status(), consoleErrors: consoleErrors.slice(0, 6), missingMessage, api5xx }, null, 2));
  console.log(`--- scf09-01-${v.id}: status=${resp?.status()} dir=${info.dir} overflowX=${info.overflowX} providerHref=${info.providerHref} translationsCard=${info.hasTranslationsCard} jobsCard=${info.hasJobsCard} numberingCard=${info.hasNumberingCard} missingKeys=${info.missingKeys.join(',') || 'none'} MISSING_MESSAGE=${missingMessage.length} 5xx=${api5xx.join(';') || 'none'}`);
  await ctx.close();
}
await browser.close();
