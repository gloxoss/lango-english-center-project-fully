// Verify /api/dashboard/summary across branch scopes with a real session.
const BASE = 'http://localhost:3455';

const browser = await (await import('playwright')).chromium.launch({ headless: true });
const ctx = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/fr/login`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.evaluate(async () => {
  const r = await fetch('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'y.elamrani@atlas.ma', password: 'Admin123!' }),
  });
  if (!r.ok) throw new Error('login failed ' + r.status);
});

for (const label of ['all', 'siege', 'maarif']) {
  const params = new URLSearchParams({ locale: 'fr' });
  if (label === 'siege') params.set('branchId', 'a5d6ddc6-db50-4872-8c8f-271ba6693bc5');
  if (label === 'maarif') params.set('branchId', '85a226a2-dc24-463a-898c-47bbde0aaf8d');
  const data = await page.evaluate(async (qs) => {
    const r = await fetch('/api/dashboard/summary?' + qs);
    const j = await r.json();
    if (!j.success) return { status: r.status, error: j.error?.message ?? JSON.stringify(j).slice(0, 200) };
    return {
      students: j.data.dailyPulse.activeStudents.count,
      overdue: j.data.dailyPulse.periodOverdue.amount,
      collectedMonth: j.data.dailyPulse.periodCollected.amount,
      prevMonth: j.data.dailyPulse.periodCollected.previousMonthCollected,
      assiduityStatus: j.data.actionCenter.unjustifiedAbsences.status,
      missingClasses: j.data.actionCenter.attendance.missingAttendanceClasses,
      admissionsToReview: j.data.admissions.toReview,
      interviewsToday: j.data.admissions.interviewsToday,
      absenteeismTotal: j.data.watchlist.totalWatchlistCount,
      branchScope: j.data.institution.branchScope,
      dayStates: j.data.attendanceTrend.days.map(d => d.completionState).join(','),
      paymentsDates: j.data.recentPayments.slice(0, 2).map(p => p.paymentDate),
    };
  }, params.toString());
  console.log(`=== ${label} ===`);
  console.log(JSON.stringify(data, null, 1));
}

// notifications API
const notif = await page.evaluate(async () => {
  const r = await fetch('/api/dashboard/notifications');
  const j = await r.json();
  if (!j.success) return { status: r.status };
  return { unread: j.data.unreadCount, action: j.data.groups.action.map(a => a.title), updates: j.data.groups.updates.length, system: j.data.groups.system.map(s => s.title) };
});
console.log('=== notifications ===');
console.log(JSON.stringify(notif, null, 1));

// search API grouped + branch scoped
const search = await page.evaluate(async () => {
  const r = await fetch('/api/portal/search?q=yousse&branchId=85a226a2-dc24-463a-898c-47bbde0aaf8d');
  const j = await r.json();
  return j.data?.students?.map(s => `${s.name} [${s.className}] total=${s.total}`);
});
console.log('=== search yousse @Maarif ===');
console.log(JSON.stringify(search));
const searchAll = await page.evaluate(async () => {
  const r = await fetch('/api/portal/search?q=yousse');
  const j = await r.json();
  return j.data?.students?.map(s => `${s.name} [${s.className}] total=${s.total}`);
});
console.log('=== search yousse @all ===');
console.log(JSON.stringify(searchAll));

await browser.close();
console.log('VERIFY DONE');
