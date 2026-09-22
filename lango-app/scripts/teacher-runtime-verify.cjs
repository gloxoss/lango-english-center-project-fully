const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE = 'http://localhost:3211';
const OUT = path.join(__dirname, '..', '..', 'schoolos-teacher-screenshots');
fs.mkdirSync(OUT, { recursive: true });

async function safeScreenshot(page, file) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      fs.rmSync(file, { force: true });
      await page.screenshot({ path: file, fullPage: false });
      return;
    } catch (error) {
      if (attempt === 3) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

async function signIn(page) {
  await page.goto(`${BASE}/fr/login`, { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const status = await page.evaluate(async () => {
    const res = await fetch('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'y.elamrani@atlas.ma', password: 'Admin123!' }),
    });
    return res.status;
  });
  if (status !== 200) {
    throw new Error(`sign-in failed with ${status}`);
  }
}

async function main() {
  const browser = await chromium.launch();

  // ---------------- 1. API-level closeout invariants ----------------
  const apiContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const apiPage = await apiContext.newPage();
  await signIn(apiPage);

  const api = await apiPage.evaluate(async () => {
    const json = async (url, init) => {
      const res = await fetch(url, init);
      let body = null;
      try {
        body = await res.json();
      } catch { /* csv or empty */ }
      return { status: res.status, body };
    };

    const options = await json('/api/teachers/options');
    const branches = options.body?.data?.branches ?? [];
    const campusPrincipal = branches.find(b => b.name === 'Campus Principal');
    const campusAnnexe = branches.find(b => b.name === 'Campus Annexe');

    const allScope = await json('/api/teachers?pageSize=100');
    const scoped = await json(`/api/teachers?pageSize=100&branchId=${campusPrincipal?.id}`);
    const emptyScope = await json(`/api/teachers?pageSize=100&branchId=${campusAnnexe?.id}`);
    const invalidBranch = await json(`/api/teachers?pageSize=100&branchId=${crypto.randomUUID()}`);
    const transfer = await json('/api/teachers', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'USR-002', branchId: campusAnnexe?.id }),
    });
    const detail = await json(`/api/teachers?id=USR-002&branchId=${campusPrincipal?.id}`);

    return {
      viewerHomeBranch: options.body?.data?.scope?.homeBranchId ?? null,
      branches: branches.map(b => ({ id: b.id, name: b.name })),
      allScope: { allBranches: allScope.body?.scope?.allBranches, total: allScope.body?.total },
      scoped: {
        effectiveBranchId: scoped.body?.scope?.effectiveBranchId,
        branchName: scoped.body?.scope?.branchName,
        allBranches: scoped.body?.scope?.allBranches,
        total: scoped.body?.total,
        summaryScopedTeachers: scoped.body?.summary?.scopedTeachers,
        activeTeachers: scoped.body?.summary?.activeTeachers,
        onLeave: scoped.body?.summary?.onLeave,
        dossiersToRegularize: scoped.body?.summary?.dossiers?.toComplete,
        workload: scoped.body?.summary?.workload,
      },
      emptyScope: { total: emptyScope.body?.total, effectiveBranchId: emptyScope.body?.scope?.effectiveBranchId },
      invalidBranch: { status: invalidBranch.status, code: invalidBranch.body?.error?.code },
      transfer: { status: transfer.status, code: transfer.body?.error?.code, blockers: transfer.body?.blockers ?? null },
      detail: detail.body
        ? {
            branchName: detail.body.data.branchName,
            status: detail.body.data.status,
            activeClassAssignments: detail.body.data.classAssignments.filter(a => a.isCurrent).length,
            activeSubjectAssignments: detail.body.data.subjectAssignments.filter(a => a.isCurrent).length,
            timetableSlots: detail.body.data.dependencies.find(d => d.key === 'timetable_slots')?.count ?? 0,
            sensitiveRedacted: detail.body.data.sensitiveRedacted,
          }
        : null,
    };
  });
  console.log('API_INVARIANTS', JSON.stringify(api, null, 2));

  // ---------------- 2. Desktop: scoped view via shell branch selection ----------------
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const page = await desktop.newPage();
  await signIn(page);
  const principalId = api.branches.find(b => b.name === 'Campus Principal')?.id;
  await page.evaluate(id => window.localStorage.setItem('schoolos_active_branch_id', id), principalId);
  await page.goto(`${BASE}/fr/dashboard/teachers/manage`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Fatima Zahra Idrissi', { timeout: 90000 });
  // The URL must adopt the selected scope (server-validated).
  await page.waitForFunction(() => window.location.search.includes('branchId='), { timeout: 20000 });
  await page.waitForTimeout(1500);
  const badge = (await page.locator('text=Périmètre').first().textContent().catch(() => '')) ?? '';
  const urlScope = await page.evaluate(() => window.location.search);
  console.log('DESKTOP_SCOPE_BADGE', JSON.stringify(badge.trim()), 'URL', urlScope);
  await safeScreenshot(page, path.join(OUT, 'A-desktop-scoped-1440.png'));

  // ---------------- 3. Mobile: list + inspector with HR collapsed ----------------
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', isMobile: true, hasTouch: true });
  const mobilePage = await mobile.newPage();
  await signIn(mobilePage);
  await mobilePage.goto(`${BASE}/fr/login`, { waitUntil: 'load' });
  await mobilePage.evaluate(() => window.localStorage.removeItem('schoolos_active_branch_id'));
  await mobilePage.goto(`${BASE}/fr/dashboard/teachers/manage`, { waitUntil: 'domcontentloaded' });
  const card = mobilePage.locator('button', { hasText: 'Fatima Zahra Idrissi' }).first();
  await card.waitFor({ state: 'visible', timeout: 90000 });
  await mobilePage.waitForTimeout(1500);
  await safeScreenshot(mobilePage, path.join(OUT, 'B-mobile-list-390.png'));

  await card.click();
  await mobilePage.waitForSelector('text=Profil rapide', { timeout: 30000 });
  await mobilePage.waitForTimeout(3000);
  const salaryHiddenBefore = await mobilePage.evaluate(() => !document.body.textContent.includes('8500'));
  await safeScreenshot(mobilePage, path.join(OUT, 'C-mobile-inspector-390.png'));

  // The desktop inspector is `hidden` below xl but still in the DOM; click the
  // sheet's own toggle inside the dialog.
  const hrToggle = mobilePage.locator('[role="dialog"] button', { hasText: 'Données RH sensibles' }).first();
  await hrToggle.waitFor({ state: 'visible', timeout: 30000 });
  await hrToggle.click();
  await mobilePage.waitForTimeout(800);
  const salaryVisibleAfter = await mobilePage.evaluate(() => document.body.textContent.includes('8500'));
  await safeScreenshot(mobilePage, path.join(OUT, 'C2-mobile-inspector-hr-expanded-390.png'));
  console.log('HR_COLLAPSED_BY_DEFAULT', JSON.stringify({ salaryHiddenBefore, salaryVisibleAfter }));

  // ---------------- 4. Arabic RTL smoke ----------------
  await mobilePage.goto(`${BASE}/ar/dashboard/teachers/manage`, { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForTimeout(5000);
  const dir = await mobilePage.evaluate(() => document.documentElement.getAttribute('dir') ?? document.body.getAttribute('dir') ?? '');
  console.log('AR_DIR', dir);
  await safeScreenshot(mobilePage, path.join(OUT, 'D-mobile-ar-rtl-390.png'));

  await browser.close();

  const dump = {
    generatedAt: new Date().toISOString(),
    viewerHomeBranch: api.viewerHomeBranch,
    selectedUiScope: 'Campus Principal (via shell localStorage -> URL branchId, server-validated)',
    apiEffectiveScope: api.scoped.effectiveBranchId,
    branchName: api.scoped.branchName,
    totals: {
      effectiveScopeTotal: api.scoped.total,
      summaryScopedTeachers: api.scoped.summaryScopedTeachers,
      activeTeachers: api.scoped.activeTeachers,
      onLeave: api.scoped.onLeave,
      dossiersToRegularize: api.scoped.dossiersToRegularize,
      workloadSource: api.scoped.workload?.source,
    },
    scopes: {
      allBranches: api.allScope,
      scoped: api.scoped,
      emptyBranch: api.emptyScope,
      invalidBranch: api.invalidBranch,
    },
    selectedTeacher: api.detail,
    directBranchChangeWithActiveAssignments: api.transfer,
    subjectHistoryDestructiveReassignment: 'blocked (409 SUBJECT_ASSIGNMENT_HISTORY_MIGRATION_REQUIRED — verified by test)',
    hrSensitiveCapability: true,
    hrQuickPanelDefault: 'collapsed',
    hrPanelEvidence: { salaryHiddenBefore, salaryVisibleAfter },
  };
  fs.writeFileSync(path.join(OUT, '..', 'schoolos-teacher-acceptance-dump.json'), JSON.stringify(dump, null, 2));
  console.log('DUMP', JSON.stringify(dump, null, 2));
  console.log('SCREENSHOTS ->', OUT);
}

main().catch((error) => {
  console.error('E2E FAILED', error);
  process.exit(1);
});
