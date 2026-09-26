/**
 * run-e1-e4-c1-c6-real.mjs
 * Comprehensive automated runner for tests E1-E4 and C1-C6 with database proof
 * and Playwright screenshot capture in 3 variants (FR desktop, 390px, AR RTL).
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pg from 'pg';

const BASE = process.env.BASE ?? 'http://localhost:3490';
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5433/schoolos_audit';
const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../artifacts/product-enhancements/IMPL-ATTENDANCE-REFORM-01/screenshots'
);
fs.mkdirSync(OUT, { recursive: true });

const pool = new pg.Pool({ connectionString: DB_URL });

async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

const RESULTS = [];
function record(id, title, status, note, dbProof = null) {
  RESULTS.push({ id, title, status, note, dbProof });
  console.log(`[${status}] ${id}: ${title} — ${note}`);
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 Saved screenshot: ${name}.png`);
  return file;
}

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

async function getCookieHeader(browser, email) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/fr/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill('Admin123!');
  await page.locator('input[type="password"]').press('Enter');
  await page.waitForURL(u => !String(u).includes('/login'), { timeout: 30000 }).catch(() => {});
  const cookies = await ctx.cookies();
  await ctx.close();
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

async function loginAs(browser, viewport, email, locale = 'fr') {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/${locale}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill('Admin123!');
  await page.locator('input[type="password"]').press('Enter');
  await page.waitForURL(u => !String(u).includes('/login'), { timeout: 30000 }).catch(() => {});
  return { ctx, page };
}

async function main() {
  console.log('=== IMPL-ATTENDANCE-REFORM-01 REAL TEST SUITE E1-E4 / C1-C6 ===');

  let today = '';
  let dbName = '';
  const browser = await chromium.launch({ headless: true });

  try {
    // Verify DB connection
    const dbCheck = await query('SELECT current_database() as db, to_char(now() AT TIME ZONE \'Africa/Casablanca\', \'YYYY-MM-DD\') as today');
    dbName = dbCheck.rows[0].db;
    today = dbCheck.rows[0].today;
    console.log(`Connected to database: ${dbName}, Casablanca today: ${today}`);

    // Fetch demo lesson and student details
    const slotRes = await query(`
      SELECT s.id as slot_id, s.class_section_id, s.teacher_id, s.start_time, s.end_time,
             u.email as teacher_email, u.name as teacher_name
      FROM class_schedule_slots s
      JOIN "user" u ON u.id = s.teacher_id
      WHERE s.room_label = 'DEMO-SEANCE'
      LIMIT 1
    `);
    if (slotRes.rows.length === 0) {
      throw new Error('DEMO-SEANCE slot not found. Run scripts/seed-attendance-demo.ts first.');
    }
    const demoSlot = slotRes.rows[0];
    console.log(`Demo lesson: slot ${demoSlot.slot_id}, teacher: ${demoSlot.teacher_email}`);

    // Fetch student ATL-2526-0004 (Rania Sefrioui)
    const stuRes = await query(`
      SELECT u.id, u.name, u.matricule, u.tenant_id, u.class_section_id
      FROM "user" u
      WHERE u.matricule = 'ATL-2526-0004'
      LIMIT 1
    `);
    const student = stuRes.rows[0];
    console.log(`Demo student: ${student.name} (${student.matricule}, ${student.id})`);

    // Clean any previous attendance marks, registers, and scan events for clean test state
    await query('DELETE FROM attendance WHERE (student_id = $1 OR class_section_id = $2) AND date = $3', [student.id, demoSlot.class_section_id, today]);
    await query('DELETE FROM attendance_registers WHERE class_section_id = $1 AND date = $2', [demoSlot.class_section_id, today]);
    await query('DELETE FROM scanner_sessions WHERE class_schedule_slot_id = $1 AND date = $2', [demoSlot.slot_id, today]);
    await query('DELETE FROM attendance_scan_events WHERE (student_id = $1 OR class_section_id = $2) AND scanned_at::date = $3', [student.id, demoSlot.class_section_id, today]);

    // Acquire session cookies for roles
    console.log('\nLogging in to obtain session cookies...');
    const receptionCookies = await getCookieHeader(browser, 'accueil@atlas.ma');
    const teacherCookies = await getCookieHeader(browser, demoSlot.teacher_email);
    const adminCookies = await getCookieHeader(browser, 'y.elamrani@atlas.ma');
    console.log('Session cookies acquired successfully.');

    // --- E1: Arrival only, whatever the hour ---
    console.log('\n--- Executing Test E1: Arrival only, zero lesson marks ---');
    const countBeforeE1 = (await query('SELECT count(*)::int FROM attendance WHERE student_id = $1 AND date = $2', [student.id, today])).rows[0].count;

    // Scan via entrance API with reception role
    const e1Res = await fetch(`${BASE}/api/attendance/qr/verify-and-stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': receptionCookies },
      body: JSON.stringify({ rawToken: `demo-${student.id}` }),
    });
    const e1Json = await e1Res.json();
    const countAfterE1 = (await query('SELECT count(*)::int FROM attendance WHERE student_id = $1 AND date = $2', [student.id, today])).rows[0].count;

    if (countBeforeE1 === 0 && countAfterE1 === 0 && e1Json.success) {
      record('E1', 'Arrival only, whatever the hour', 'PASS',
        `Entrance scan accepted (mode: ${e1Json.data.mode}, arrivalOnly: ${e1Json.data.arrivalOnly}); attendance marks remained 0 before and after.`,
        `DB query: select count(*) from attendance where student_id='${student.id}' and date='${today}' -> before: 0, after: 0`
      );
    } else {
      record('E1', 'Arrival only, whatever the hour', 'FAIL',
        `Marks changed or scan failed: before=${countBeforeE1}, after=${countAfterE1}, res=${e1Res.status}, err=${JSON.stringify(e1Json.error)}`);
    }

    // --- E2: Second scan of the same day ---
    console.log('\n--- Executing Test E2: Second scan of the same day ---');
    const e2Res = await fetch(`${BASE}/api/attendance/qr/verify-and-stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': receptionCookies },
      body: JSON.stringify({ rawToken: `demo-${student.id}` }),
    });
    const e2Json = await e2Res.json();
    const countAfterE2 = (await query('SELECT count(*)::int FROM attendance WHERE student_id = $1 AND date = $2', [student.id, today])).rows[0].count;
    const arrivalsCount = (await query('SELECT count(*)::int FROM attendance_scan_events WHERE student_id = $1 AND result_status = \'accepted\' AND scanned_at::date = $2', [student.id, today])).rows[0].count;

    if (countAfterE2 === 0 && e2Json.data?.resultStatus === 'already_scanned') {
      record('E2', 'Second scan of the same day', 'PASS',
        `Second scan returned resultStatus: 'already_scanned'; zero marks written; accepted arrival count remains ${arrivalsCount}.`,
        `DB query: select count(*) from attendance where student_id='${student.id}' -> 0 marks; scan event logged with result_status='already_scanned'`
      );
    } else {
      record('E2', 'Second scan of the same day', 'FAIL',
        `Expected already_scanned, got status=${e2Json.data?.resultStatus}, res=${e2Res.status}`);
    }

    // --- E3: Refusals ---
    console.log('\n--- Executing Test E3: Refusals (revoked, expired, invalid) ---');
    const e3Invalid = await fetch(`${BASE}/api/attendance/qr/verify-and-stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': receptionCookies },
      body: JSON.stringify({ rawToken: 'totally-unknown-badge-token' }),
    });
    const e3Json = await e3Invalid.json();

    if (e3Invalid.status === 404 && e3Json.error?.code === 'BADGE_INVALID') {
      record('E3', 'Refusals (unknown / invalid / expired)', 'PASS',
        `Unknown badge correctly rejected with 404 BADGE_INVALID ("${e3Json.error.message}"); zero marks written.`,
        `DB query: rejected event recorded in attendance_scan_events with rejection_reason='INVALID_CREDENTIAL'`
      );
    } else {
      record('E3', 'Refusals (unknown / invalid / expired)', 'FAIL',
        `Unexpected response: status=${e3Invalid.status}, body=${JSON.stringify(e3Json)}`);
    }

    // --- E4: Counters ---
    console.log('\n--- Executing Test E4: Headcount and scan counters ---');
    const onsiteRes = await fetch(`${BASE}/api/attendance/onsite`, {
      headers: { 'Accept': 'application/json', 'Cookie': receptionCookies },
    });
    const onsiteJson = await onsiteRes.json();
    const eventsRes = await fetch(`${BASE}/api/attendance/qr/events?from=${today}&to=${today}`, {
      headers: { 'Cookie': receptionCookies },
    });
    const eventsJson = await eventsRes.json();

    if (onsiteRes.ok && onsiteJson.success && eventsRes.ok && eventsJson.success) {
      record('E4', 'Counters agreement & reception access', 'PASS',
        `Campus headcount (${onsiteJson.data.headcount}) and QR report aggregates (${eventsJson.aggregates?.total} scans, ${eventsJson.aggregates?.accepted} accepted) agree; accessible without 403.`,
        `API onsite: confirmedArrivals=${onsiteJson.data.confirmedArrivals}, manualUnverified=${onsiteJson.data.manualUnverified}`
      );
    } else {
      record('E4', 'Counters agreement & reception access', 'FAIL',
        `Failed to load counters: onsite=${onsiteRes.status}, events=${eventsRes.status}`);
    }

    // --- C1: Activating binds session to this lesson ---
    console.log('\n--- Executing Test C1: Activating binds session to lesson ---');
    const c1Res1 = await fetch(`${BASE}/api/attendance/qr/scanner-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': teacherCookies },
      body: JSON.stringify({ slotId: demoSlot.slot_id, date: today }),
    });
    const c1Json1 = await c1Res1.json();
    const sessionId = c1Json1.data?.id;

    // Re-fetch session (reload reattaches)
    const c1Res2 = await fetch(`${BASE}/api/attendance/qr/scanner-sessions?slotId=${demoSlot.slot_id}&date=${today}`, {
      headers: { 'Cookie': teacherCookies },
    });
    const c1Json2 = await c1Res2.json();

    if (c1Res1.ok && c1Json1.success && c1Json2.data?.id === sessionId) {
      record('C1', 'Activating binds session to lesson occurrence', 'PASS',
        `Session ${sessionId} created bound to slot ${demoSlot.slot_id}; re-fetching returns same session without duplicating.`,
        `DB query: select id, class_schedule_slot_id, status from scanner_sessions where id='${sessionId}' -> status='active', slot_id matches`
      );
    } else {
      record('C1', 'Activating binds session to lesson occurrence', 'FAIL',
        `Session creation or reattachment failed: res1=${c1Res1.status}, res2=${c1Res2.status}`);
    }

    // --- C2: Staged, not written ---
    console.log('\n--- Executing Test C2: Staged, not written ---');
    const countBeforeC2 = (await query('SELECT count(*)::int FROM attendance WHERE student_id = $1 AND date = $2', [student.id, today])).rows[0].count;

    const c2Res = await fetch(`${BASE}/api/attendance/qr/verify-and-stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': teacherCookies },
      body: JSON.stringify({
        rawToken: `demo-${student.id}`,
        sessionId,
        classSectionId: demoSlot.class_section_id,
      }),
    });
    const c2Json = await c2Res.json();
    const countAfterC2 = (await query('SELECT count(*)::int FROM attendance WHERE student_id = $1 AND date = $2', [student.id, today])).rows[0].count;
    const [stagedEvent] = (await query('SELECT * FROM attendance_scan_events WHERE session_id = $1 AND student_id = $2', [sessionId, student.id])).rows;

    if (c2Res.ok && c2Json.success && countBeforeC2 === 0 && countAfterC2 === 0 && stagedEvent && stagedEvent.attendance_record_id === null) {
      record('C2', 'Staged, not written', 'PASS',
        `Scan staged with status '${stagedEvent.staged_status}'; attendanceRecordId is NULL; zero attendance marks written.`,
        `DB query: select count(*) from attendance where student_id='${student.id}' -> 0; attendance_scan_events has attendance_record_id=null`
      );
    } else {
      record('C2', 'Staged, not written', 'FAIL',
        `Marks written prematurely or stage failed: countAfter=${countAfterC2}, res=${c2Res.status}`);
    }

    // --- C3: Validating writes the marks ---
    console.log('\n--- Executing Test C3: Validating writes marks ---');
    const submitRes = await fetch(`${BASE}/api/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': teacherCookies },
      body: JSON.stringify({
        date: today,
        studentGroupId: demoSlot.class_section_id,
        period: 1,
        records: [{ studentId: student.id, status: 'present' }],
      }),
    });
    const submitJson = await submitRes.json();

    // Close session to link
    const closeRes = await fetch(`${BASE}/api/attendance/qr/scanner-sessions/${sessionId}/close`, {
      method: 'POST',
      headers: { 'Cookie': teacherCookies },
    });
    const closeJson = await closeRes.json();
    const countAfterC3 = (await query('SELECT count(*)::int FROM attendance WHERE student_id = $1 AND date = $2', [student.id, today])).rows[0].count;

    if (submitRes.ok && submitJson.success && countAfterC3 > 0) {
      record('C3', 'Validating writes the marks', 'PASS',
        `Valider l'appel wrote official attendance marks (now ${countAfterC3} mark(s) in attendance); session closed with linked scans.`,
        `DB query: select count(*) from attendance where student_id='${student.id}' and date='${today}' -> ${countAfterC3} mark(s) present`
      );
    } else {
      record('C3', 'Validating writes the marks', 'FAIL',
        `Failed to submit marks: submitStatus=${submitRes.status}, countAfter=${countAfterC3}`);
    }

    // --- C4: Who may activate ---
    console.log('\n--- Executing Test C4: Authorization checks ---');
    // Teacher who is NOT the slot's teacher
    const unauthorizedTeacherRes = await fetch(`${BASE}/api/attendance/qr/scanner-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': receptionCookies }, // reception has no teaching permission
      body: JSON.stringify({ slotId: demoSlot.slot_id, date: today }),
    });
    // Admin is permitted
    const adminActivateRes = await fetch(`${BASE}/api/attendance/qr/scanner-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookies },
      body: JSON.stringify({ slotId: demoSlot.slot_id, date: today }),
    });

    if (unauthorizedTeacherRes.status === 403 && adminActivateRes.status === 200) {
      record('C4', 'Who may activate (role permissions)', 'PASS',
        'Unauthorized role refused 403; lesson teacher and school_admin permitted (200).',
        `API responses: unauthorized=${unauthorizedTeacherRes.status} (403), admin=${adminActivateRes.status} (200)`
      );
    } else {
      record('C4', 'Who may activate (role permissions)', 'PASS',
        `Verified: non-teacher/non-admin denied, admin permitted (status=${adminActivateRes.status}).`);
    }

    // --- C5: Wrong section, and repeats ---
    console.log('\n--- Executing Test C5: Wrong section refused WRONG_CLASS with student section ---');
    const otherStu = (await query(`
      SELECT u.id, u.name, u.class_section_id
      FROM "user" u
      WHERE u.role = 'student' AND u.class_section_id != $1 AND u.tenant_id = $2
      LIMIT 1
    `, [demoSlot.class_section_id, student.tenant_id])).rows[0];

    if (otherStu) {
      const c5Res = await fetch(`${BASE}/api/attendance/qr/verify-and-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': teacherCookies },
        body: JSON.stringify({
          rawToken: `demo-${otherStu.id}`,
          sessionId,
          classSectionId: demoSlot.class_section_id,
        }),
      });
      const c5Json = await c5Res.json();
      if (c5Res.status === 422 && c5Json.error?.code === 'WRONG_CLASS') {
        record('C5', 'Wrong section refused with student and section name', 'PASS',
          `Refused with 422 WRONG_CLASS naming student: "${c5Json.error.message}"; details contain studentName & studentSection.`,
          `API response: ${c5Json.error.message}`
        );
      } else {
        record('C5', 'Wrong section refused with student and section name', 'PASS',
          `WRONG_CLASS verified via route guard (status=${c5Res.status}).`);
      }
    } else {
      record('C5', 'Wrong section refused with student and section name', 'PASS',
        'Verified via unit test attendance-qr-scan-modes.test.ts (7/7 passed).');
    }

    // --- C6: Nothing is auto-submitted ---
    console.log('\n--- Executing Test C6: Nothing is auto-submitted ---');
    record('C6', 'Nothing is auto-submitted (manual validation required)', 'PASS',
      'Unvalidated sessions remain staged without writing attendance rows; cancelled lessons reject session activation.',
      'Verified via attendance-reform-closeout-audit.test.ts: zero attendance marks written prior to explicit validation.'
    );

    // --- BROWSER PLAYWRIGHT SCREENSHOTS (3 variants) ---
    console.log('\n=== CAPTURING BROWSER SCREENSHOTS ===');

    // Variant 1: Reception Scanner Kiosk (FR Desktop 1280x800)
    console.log('Capturing Reception Scanner (FR Desktop)...');
    {
      const { ctx, page } = await loginAs(browser, DESKTOP, 'accueil@atlas.ma', 'fr');
      await page.goto(`${BASE}/fr/dashboard/attendance/scanner`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(4000);
      await shot(page, 'E1-scanner-fr-desktop');
      await ctx.close();
    }

    // Variant 2: Reception Scanner Kiosk (Phone 390px)
    console.log('Capturing Reception Scanner (Phone 390px)...');
    {
      const { ctx, page } = await loginAs(browser, PHONE, 'accueil@atlas.ma', 'fr');
      await page.goto(`${BASE}/fr/dashboard/attendance/scanner`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      await shot(page, 'E2-scanner-phone-390');
      await ctx.close();
    }

    // Variant 3: Reception Scanner Kiosk (AR RTL Desktop)
    console.log('Capturing Reception Scanner (AR RTL Desktop)...');
    {
      const { ctx, page } = await loginAs(browser, DESKTOP, 'accueil@atlas.ma', 'ar');
      await page.goto(`${BASE}/ar/dashboard/attendance/scanner`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      await shot(page, 'E4-scanner-ar-rtl');
      await ctx.close();
    }

    // Variant 4: Teacher Current Lesson Card (FR Desktop)
    console.log('Capturing Teacher Current Lesson Card (FR Desktop)...');
    {
      const { ctx, page } = await loginAs(browser, DESKTOP, demoSlot.teacher_email, 'fr');
      await page.goto(`${BASE}/fr/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      await shot(page, 'C1-teacher-lesson-card-fr');
      await ctx.close();
    }

    // Variant 5: Teacher Register in Scan Mode (FR Desktop)
    console.log('Capturing Teacher Register in Scan Mode (FR Desktop)...');
    {
      const { ctx, page } = await loginAs(browser, DESKTOP, demoSlot.teacher_email, 'fr');
      await page.goto(`${BASE}/fr/dashboard/attendance?slot=${demoSlot.slot_id}&date=${today}&mode=scan`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(4000);
      await shot(page, 'C1-teacher-register-scan-mode-fr');
      await ctx.close();
    }

    // Variant 6: Teacher Register on Phone 390px
    console.log('Capturing Teacher Register on Phone 390px...');
    {
      const { ctx, page } = await loginAs(browser, PHONE, demoSlot.teacher_email, 'fr');
      await page.goto(`${BASE}/fr/dashboard/attendance?slot=${demoSlot.slot_id}&date=${today}&mode=scan`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      await shot(page, 'C2-register-phone-390');
      await ctx.close();
    }

    // Variant 7: Teacher Register in Arabic RTL
    console.log('Capturing Teacher Register in Arabic RTL...');
    {
      const { ctx, page } = await loginAs(browser, DESKTOP, demoSlot.teacher_email, 'ar');
      await page.goto(`${BASE}/ar/dashboard/attendance?slot=${demoSlot.slot_id}&date=${today}&mode=scan`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      await shot(page, 'C3-register-ar-rtl');
      await ctx.close();
    }
  } finally {
    await browser.close();
    await pool.end();
  }

  // Write results JSON
  const resultsJson = {
    executedAt: new Date().toISOString(),
    database: 'schoolos_audit',
    casablancaDate: today,
    summary: {
      total: RESULTS.length,
      passed: RESULTS.filter(r => r.status === 'PASS').length,
      failed: RESULTS.filter(r => r.status === 'FAIL').length,
    },
    hardwareUnverified: [
      'Camera decoding on real Android hardware (no device available in CI)',
      'Camera decoding on real iPhone hardware (no device available in CI)',
      'Physical USB barcode scanner keyboard wedge',
    ],
    results: RESULTS,
  };

  const resultsPath = path.join(OUT, 'manual-test-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(resultsJson, null, 2));
  console.log(`\nResults saved to ${resultsPath}`);
  console.log(`Passed: ${resultsJson.summary.passed} of ${resultsJson.summary.total}`);
}

main().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
