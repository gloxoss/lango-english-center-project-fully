// Visual audit: every settings page x (desktop FR, mobile 390 FR, desktop AR).
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const H = 'http://localhost:3111';
const OUT = process.env.OUT;
const map = JSON.parse(fs.readFileSync(process.env.MAP, 'utf8'));
const routes = map.map(r => r.route);
const variants = [
  { id: 'desktop-fr', locale: 'fr', viewport: { width: 1440, height: 900 } },
  { id: 'mobile390-fr', locale: 'fr', viewport: { width: 390, height: 844 } },
  { id: 'desktop-ar', locale: 'ar', viewport: { width: 1440, height: 900 } },
];
const KEY_RE = /\b(?:[A-Z][A-Za-z]+\.){1,3}[a-z][A-Za-z0-9_]+\b/g; // e.g. Settings.mod_documents_title
const results = [];
const browser = await chromium.launch();
for (const v of variants) {
  const ctx = await browser.newContext({ viewport: v.viewport, locale: v.locale === 'ar' ? 'ar-MA' : 'fr-FR' });
  const r = await ctx.request.post(`${H}/api/auth/sign-in/email`, { headers: { Origin: H, 'Content-Type': 'application/json' }, data: { email: 'y.elamrani@atlas.ma', password: 'Admin123!' } });
  if (r.status() !== 200) throw new Error('login failed');
  const page = await ctx.newPage();
  for (const route of routes) {
    const bad = [];
    const consoleErrors = [];
    const onResp = (res) => { if (res.url().includes('/api/') && res.status() >= 500) bad.push(`${res.status()} ${res.url().replace(H, '')}`); };
    const onCon = (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 140)); };
    page.on('response', onResp); page.on('console', onCon);
    let status = 'ERR';
    try {
      const resp = await page.goto(`${H}/${v.locale}${route}`, { waitUntil: 'networkidle', timeout: 120000 });
      status = resp?.status();
    } catch (e) { status = `ERR ${e.message.slice(0, 50)}`; }
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => {
      const main = document.querySelector('main') || document.body;
      const text = main.innerText || '';
      const skeleton = [...document.querySelectorAll('.animate-pulse,[data-skeleton]')].filter(e => e.getBoundingClientRect().height > 8).length;
      return {
        h1: (document.querySelector('main h1, h1')?.textContent || '').trim().slice(0, 80),
        text,
        skeleton,
        overflowX: document.documentElement.scrollWidth - window.innerWidth,
        overlay: !!document.querySelector('nextjs-portal') && /Unhandled|Error/.test(document.querySelector('nextjs-portal')?.shadowRoot?.textContent || ''),
        dir: document.documentElement.dir,
      };
    });
    const loading = /Chargement|Rendering\.\.\.|Loading\.\.\.|جار التحميل/.test(info.text) ? 'loading-text' : '';
    const keys = [...new Set((info.text.match(KEY_RE) || []).filter(k => !/^(e\.g|i\.e|www|api)\b/i.test(k)))].slice(0, 6);
    const comingSoon = /à venir|Fonctionnalité à venir|Coming soon|قريبا/i.test(info.text);
    const file = `${v.id}__${route.replace('/dashboard/', '').replace(/\//g, '_') || 'settings'}.png`;
    await page.screenshot({ path: `${OUT}/${file}`, fullPage: true });
    const finalUrl = page.url().replace(H, '');
    const row = { variant: v.id, route, status, finalUrl, redirected: !finalUrl.startsWith(`/${v.locale}${route}`), h1: info.h1, skeleton: info.skeleton, loading, overflowX: info.overflowX, overlay: info.overlay, keys, comingSoon, api5xx: bad, consoleErrors: consoleErrors.slice(0, 3), dir: info.dir, file };
    results.push(row);
    const flags = [row.redirected && `REDIRECT→${finalUrl}`, row.skeleton && `skeleton:${row.skeleton}`, loading, row.overflowX > 1 && `overflowX:${row.overflowX}`, row.overlay && 'OVERLAY', keys.length && `keys:${keys.join(',')}`, comingSoon && 'coming-soon', bad.length && `5xx:${bad.join(';')}`].filter(Boolean);
    console.log(`${v.id} ${status} ${route} ${flags.join(' | ')}`);
    page.off('response', onResp); page.off('console', onCon);
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(process.env.RES, JSON.stringify(results, null, 1));
