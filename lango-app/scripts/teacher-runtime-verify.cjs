const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE = 'http://localhost:3211';
const OUT = path.join(__dirname, '..', '..', 'schoolos-teacher-screenshots');
fs.mkdirSync(OUT, { recursive: true });

async function signIn(page) {
  await page.goto(`${BASE}/fr/login`, { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const result = await page.evaluate(async () => {
    const res = await fetch('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'y.elamrani@atlas.ma', password: 'Admin123!' }),
    });
    return res.status;
  });
  if (result !== 200) throw new Error(`sign-in failed with ${result}`);
}

async function main() {
  const browser = await chromium.launch();

  // ---------- Desktop 1440 ----------
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const page = await desktop.newPage();
  const apiStatuses = [];
  page.on('response', res => {
    if (res.url().includes('/api/teachers')) apiStatuses.push(`${res.status()} ${res.request().method()} ${new URL(res.url()).pathname}${new URL(res.url()).search}`);
  });
  await signIn(page);
  await page.goto(`${BASE}/fr/dashboard/teachers/manage`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Fatima Zahra Idrissi', { timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, 'A-desktop-1440.png'), fullPage: false });
  console.log('API CALLS', JSON.stringify(apiStatuses, null, 1));

  const invariants = await page.evaluate(async () => {
    const listRes = await fetch('/api/teachers?pageSize=100');
    const list = await listRes.json();
    const detailRes = await fetch('/api/teachers?id=USR-002');
    const detail = await detailRes.json();
    const optionsRes = await fetch('/api/teachers/options');
    const options = await optionsRes.json();
    const first = list.data[0];
    return {
      listStatus: listRes.status,
      total: list.total,
      page: list.page,
      pageSize: list.pageSize,
      totalPages: list.totalPages,
      summary: list.summary,
      firstItemKeys: Object.keys(first),
      listHasSensitiveFields: ['salary', 'nationalId', 'dateOfBirth', 'address', 'sensitiveHr'].some(key => key in first),
      firstItem: {
        id: first.id,
        name: first.name,
        status: first.status,
        subjects: first.subjects.map(s => s.name),
        classes: first.classes.map(c => c.label),
        weeklyScheduledHours: first.weeklyScheduledHours,
        dossier: first.dossier,
        canHardDelete: first.canHardDelete,
      },
      detail: {
        id: detail.data.id,
        branch: detail.data.branchName,
        status: detail.data.status,
        subjects: detail.data.subjects.map(s => s.name),
        classes: detail.data.classAssignments.filter(c => c.isCurrent).map(c => c.label),
        weeklyScheduledHours: detail.data.weeklyScheduledHours,
        sensitiveRedacted: detail.data.sensitiveRedacted,
        hasSensitiveHr: detail.data.sensitiveHr !== null,
        canHardDelete: detail.data.canHardDelete,
        dependencies: detail.data.dependencies,
        documents: detail.data.documents,
      },
      filterOptionsCounts: {
        subjects: options.data.subjects.length,
        classes: options.data.classes.length,
        branches: options.data.branches.length,
      },
    };
  });
  console.log('INVARIANTS', JSON.stringify(invariants, null, 2));

  // ---------- Mobile 390 ----------
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', isMobile: true, hasTouch: true });
  const mobilePage = await mobile.newPage();
  await signIn(mobilePage);
  await mobilePage.goto(`${BASE}/fr/dashboard/teachers/manage`, { waitUntil: 'domcontentloaded' });
  const mobileCard = mobilePage.locator('button', { hasText: 'Fatima Zahra Idrissi' }).first();
  await mobileCard.waitFor({ state: 'visible', timeout: 90000 });
  await mobilePage.waitForTimeout(2000);
  await mobilePage.screenshot({ path: path.join(OUT, 'B-mobile-list-390.png'), fullPage: false });

  await mobileCard.click();
  await mobilePage.waitForSelector('text=Profil rapide', { timeout: 30000 });
  await mobilePage.waitForTimeout(5000);
  await mobilePage.screenshot({ path: path.join(OUT, 'C-mobile-inspector-390.png'), fullPage: false });

  // ---------- Arabic RTL ----------
  await mobilePage.goto(`${BASE}/ar/dashboard/teachers/manage`, { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForTimeout(5000);
  const dir = await mobilePage.evaluate(() => document.documentElement.getAttribute('dir') ?? document.body.getAttribute('dir') ?? '');
  const arHasTeacher = await mobilePage.evaluate(() => document.body.innerText.includes('فاطمة') || document.body.innerText.includes('إدريسي') || document.body.innerText.includes('Idrissi'));
  console.log('AR DIR =', dir, '| teacher visible =', arHasTeacher, '| URL =', mobilePage.url());
  await mobilePage.screenshot({ path: path.join(OUT, 'D-mobile-ar-rtl-390.png'), fullPage: false });

  await browser.close();
  console.log('SCREENSHOTS ->', OUT);
}

main().catch(error => {
  console.error('E2E FAILED', error);
  process.exit(1);
});
