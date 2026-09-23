// Read-only visual sweep: one login, many routes, one screenshot each plus
// automatic text checks. Never clicks (no SMS, no payments, no writes).
//
// Flags per page: redirect away from the requested route, failed API calls
// (4xx/5xx, known role-noise filtered out), console errors, horizontal scroll,
// and visible text defects — NaN, undefined, null, [object Object],
// Invalid Date, raw i18n keys (Namespace.key), error screens.
//
// Usage: node scripts/visual-sweep.mjs <role> <routes-file> [out-dir]
// Env: AUDIT_BASE (default http://localhost:3111), ACCOUNT_EMAIL, VIEWPORT=desktop|phone, LOCALE=fr|ar
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const BASE = process.env.AUDIT_BASE ?? 'http://localhost:3111';
const ACCOUNTS = {
  school_admin: 'y.elamrani@atlas.ma', teacher: 'fz.idrissi@atlas.ma', accountant: 'accountant@atlas.ma',
  receptionist: 'accueil@atlas.ma', guard: 'securite@atlas.ma', librarian: 'bibliotheque@atlas.ma',
  super_admin: 'superadmin@schoolos.ma', parent: 'parent.001@atlas.ma', student: 'etudiant.0001@atlas.ma', alumni: 'ancien.eleve@atlas.ma',
};
const [role, routesFile, outArg] = process.argv.slice(2);
const OUT = outArg ?? path.resolve('artifacts/visual-sweep');
const LOCALE = process.env.LOCALE ?? 'fr';
const phone = process.env.VIEWPORT === 'phone';
const routes = fs.readFileSync(routesFile, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });

// Requests that fail by design for non-matching roles; reported elsewhere.
const NOISE = [/\/api\/super-admin\/tenant-context/, /\/api\/guard\/emergency\/procedures/];

const TEXT_DEFECTS = [
  { name: 'NaN', re: /(^|[\s(:])NaN([\s%).,]|$)/ },
  { name: 'undefined', re: /(^|[\s(:])undefined([\s).,]|$)/ },
  { name: 'null', re: /(^|[\s(:])null([\s).,]|$)/ },
  { name: '[object Object]', re: /\[object Object\]/ },
  { name: 'Invalid Date', re: /Invalid Date/ },
  { name: 'raw i18n key', re: /\b[A-Z][A-Za-z]+\.[a-z][A-Za-z0-9]+(\.[a-z][A-Za-z0-9]+)*\b(?![.@])/ },
  { name: 'error screen', re: /(Something went wrong|Application error|Unhandled Runtime Error|Erreur interne|Internal Server Error)/i },
];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ locale: LOCALE === 'ar' ? 'ar-MA' : 'fr-FR', viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: phone, hasTouch: phone });
const page = await ctx.newPage();
// Sign in and prove the session sticks before sweeping: on a busy dev server
// the redirect can lag, and sweeping without a session would report every
// page as a redirect to /login.
// RFC 6238 TOTP, for accounts whose role forces 2FA (super_admin). The
// secret comes from TOTP_SECRET_FILE and must belong to an audit database.
function totp(base32Secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of base32Secret.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map(b => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = crypto.createHmac('sha1', key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}

async function signIn() {
  await page.goto(`${BASE}/fr/login`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  const post = (p, b) => page.evaluate(async ([p2, b2]) => {
    const r = await fetch(p2, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b2) });
    return { status: r.status, json: await r.json().catch(() => null) };
  }, [p, b]);
  const res = await post('/api/auth/sign-in/email', { email: process.env.ACCOUNT_EMAIL ?? ACCOUNTS[role], password: process.env.AUDIT_PASSWORD ?? 'Admin123!' });
  if (res.json?.twoFactorRedirect) {
    const file = process.env.TOTP_SECRET_FILE;
    if (!file || !fs.existsSync(file)) return false;
    await post('/api/auth/two-factor/verify-totp', { code: totp(fs.readFileSync(file, 'utf8').trim()) });
  }
  await page.goto(`${BASE}/fr/dashboard`, { waitUntil: 'domcontentloaded', timeout: 180000 }).catch(() => {});
  return !page.url().includes('/login');
}
// NO_LOGIN=1 sweeps public pages as an anonymous visitor.
if (!process.env.NO_LOGIN && !(await signIn()) && !(await signIn())) {
  console.error(`LOGIN FAILED for ${role}; aborting sweep (would report every page as a redirect).`);
  await browser.close();
  process.exit(2);
}

const results = [];
for (const route of routes) {
  const url = `${BASE}/${LOCALE}${route}`;
  const failures = [];
  const onResp = (r) => {
    const u = r.url();
    if (r.status() >= 400 && u.includes('/api/') && !NOISE.some(n => n.test(u))) failures.push(`${r.status()} ${u.replace(BASE, '').split('?')[0]}`);
    if (r.status() === 429) failures.push('429 rate-limited');
  };
  // "Failed to fetch" is the warm-up load's in-flight requests being aborted by
  // the measured reload, not an app failure (verified: those pages render data).
  const onConsole = (m) => { if (m.type() === 'error' && !/Failed to load resource|Failed to fetch/.test(m.text())) failures.push(`console: ${m.text().slice(0, 140)}`); };
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(800);
  page.on('response', onResp); page.on('console', onConsole);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2000 + Number(process.env.PACE_MS ?? 0));
  page.off('response', onResp); page.off('console', onConsole);

  const finalPath = page.url().replace(BASE, '').split('?')[0];
  const info = await page.evaluate(() => ({
    text: document.body.innerText.slice(0, 20000),
    hScroll: document.documentElement.scrollWidth > window.innerWidth + 2,
    nodes: document.querySelectorAll('*').length,
  })).catch(() => ({ text: '', hScroll: false, nodes: 0 }));
  const textDefects = TEXT_DEFECTS.filter(d => d.re.test(info.text)).map(d => {
    const m = info.text.match(d.re); return `${d.name}: «${(m?.[0] ?? '').trim().slice(0, 60)}»`;
  });
  const slug = route.replace(/^\/dashboard\/?/, '').replace(/\//g, '__') || 'home';
  const file = `${role}-${LOCALE}${phone ? '-phone' : ''}-${slug}.png`;
  await page.screenshot({ path: path.join(OUT, file), fullPage: !phone }).catch(() => {});
  const row = {
    route, finalPath, redirected: !finalPath.endsWith(route), hScroll: info.hScroll, nodes: info.nodes,
    failures: [...new Set(failures)].slice(0, 6), textDefects, file,
  };
  results.push(row);
  const flag = row.redirected || row.failures.length || row.textDefects.length || row.hScroll ? 'FLAG' : 'ok  ';
  console.log(`${flag} ${route}${row.redirected ? ` -> ${finalPath}` : ''}${row.failures.length ? ` | ${row.failures.join('; ')}` : ''}${row.textDefects.length ? ` | ${row.textDefects.join('; ')}` : ''}${row.hScroll ? ' | hscroll' : ''}`);
}
fs.writeFileSync(path.join(OUT, `sweep-${role}-${LOCALE}${phone ? "-phone" : ""}${process.env.SHARD ? `-${process.env.SHARD}` : ""}.json`), JSON.stringify(results, null, 2));
await browser.close();
