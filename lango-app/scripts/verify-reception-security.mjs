// Live acceptance verification — Receptionist Portal (R5). Hits the running
// dev server with the REC-* fixtures created by `scripts/seed-reception-fixtures.ts`
// and asserts the security matrix the receptionist-portal plan demands:
//
//   T01-T03  anonymous 401 / wrong-role 403 / receptionist home 200
//   T04-T06  lookup: short-search 422, masked PII, enumeration cap + no-match 404
//   T07      inquiry dedup: retry never creates a duplicate (409 + 1 row)
//   T08      approved-notification-template allowlist (zod enum 422; allowed template writes one sms)
//   T09      appointment idempotent create replay (created:false, 1 row)
//   T10      appointment check-in -> complete happy path + immutable history + version bump
//   T11      appointment concurrency race (one 200, one 409 INVALID_TRANSITION)
//   T12      reschedule only when scheduled (409 NOT_SCHEDULED)
//   T13      invalid transition rejected (409 INVALID_TRANSITION)
//   T14      visitor pass -> check-in -> check-out with replay protection
//   T15      pickup release default-deny for default receptionist (403)
//   T16      pickup release positive path via override + single release (1 event row)
//   T17      create-auth against unlinked guardian (422 PICKUP_PERSON_NOT_LINKED)
//   T18      handoff lifecycle open -> acknowledged -> resolved, replay-safe create
//   T19      handoff concurrency race (one 200, one 409)
//   T20      handoff never runs destination privileged action (static + code shape)
//   T21      receptionist Finance denial (403 on /api/finance/expenses)
//   T22      two-tenant + wrong-branch isolation (safe foreign-ID 404)
//   T23      DB: 5 reception tables + idempotency unique indexes present
//   T24      portal manifest agrees (reception group + 6 children)
//   T25      static agreement: every route guards ctx/tenant/capability; pages guard requireServerPage
//
// Fixture logins are `<id>@placeholder.local` with password `RecepVerify123!`.
// Run:  npx tsx scripts/seed-reception-fixtures.ts
//       node scripts/verify-reception-security.mjs
// Env overrides: VERIFY_BASE (default http://localhost:3002), DATABASE_URL.
import { Pool } from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3002';
const ORIGIN = 'http://localhost:3000';
const POOL = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos',
});
const PASS = 'RecepVerify123!';
const ATLAS = 'ca40c88e-339c-4fea-b5c4-51d5c9cc0239';

const results = [];
const check = (label, ok, detail = '') => {
  results.push({ label, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
};

async function q(sql, params = []) {
  const r = await POOL.query(sql, params);
  return r.rows;
}

async function signIn(email, password) {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  });
  const setCookies = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  if (!setCookies) throw new Error(`sign-in for ${email} failed (${res.status})`);
  return { cookie: setCookies };
}

async function api(cookie, path, { method = 'GET', body, expectStatus } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: ORIGIN },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  if (expectStatus !== undefined && res.status !== expectStatus) {
    throw new Error(`${method} ${path} expected ${expectStatus}, got ${res.status}: ${text.slice(0, 300)}`);
  }
  return { status: res.status, json, text };
}

const uuid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();
const plus2h = () => new Date(Date.now() + 2 * 3600_000).toISOString();

// Recursive file walk for the static agreement checks.
function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.isFile()) out.push(p);
  }
  return out;
}

async function main() {
  // Fixture discovery straight from the DB (seed is idempotent, REC- prefix).
  const [gate] = await q(`SELECT id FROM guard_gates WHERE gate_code = 'REC-GATE'`);
  const [student] = await q(`SELECT id FROM "user" WHERE id = 'REC-STU-A'`);
  const [auth] = await q(`SELECT id FROM guard_pickup_authorizations WHERE student_id = 'REC-STU-A' AND status = 'active' ORDER BY created_at DESC LIMIT 1`);
  const [unlinked] = await q(`SELECT id FROM guardians WHERE email = 'rec-guard-unlinked@placeholder.local'`);

  if (!gate || !student || !auth || !unlinked) {
    console.error('SKIPPED SUITE  fixtures missing — run `npx tsx scripts/seed-reception-fixtures.ts` first (need REC-GATE gate, REC-STU-A student, an active pickup authorization, and the unlinked guardian).');
    await POOL.end();
    process.exit(2);
  }
  const GATE_ID = gate.id;
  const STUDENT_ID = student.id;
  const AUTH_ID = auth.id;
  const UNLINKED_ID = unlinked.id;

  const desk = await signIn('rec-user@placeholder.local', PASS);            // default receptionist (branch A, no pickup.release)
  const pickupOps = await signIn('rec-pickup-user@placeholder.local', PASS); // receptionist with pickup.release override
  const teacher = await signIn('rec-teacher@placeholder.local', PASS);       // wrong-role probe
  const deskB = await signIn('rec-user-b@placeholder.local', PASS);          // receptionist branch B (wrong-branch probe)
  const lango = await signIn('rec-lango-user@placeholder.local', PASS);      // receptionist in Lango tenant

  // ---- T01-T03: authn / authz / home --------------------------------------
  {
    const anon = await api('', '/api/reception/me/home');
    check('T01 anonymous rejected', anon.status === 401, `status=${anon.status}`);
  }
  {
    const { status, json } = await api(teacher.cookie, '/api/reception/me/home');
    check('T02 wrong-role (teacher) 403', status === 403 && json?.error?.code === 'FORBIDDEN', `status=${status}`);
  }
  {
    const { status } = await api(desk.cookie, '/api/reception/me/home');
    check('T03 receptionist home 200', status === 200, `status=${status}`);
  }

  // ---- T04-T06: lookup enumeration resistance + PII redaction -------------
  {
    const { status, json } = await api(desk.cookie, '/api/reception/lookup?q=Re');
    check('T04 lookup short search 422', status === 422 && json?.error?.code === 'VALIDATION', `status=${status}`);
  }
  {
    const res = await api(desk.cookie, '/api/reception/lookup?q=REC-001');
    const hit = Array.isArray(res.json?.data) ? res.json.data.find((x) => x.id === STUDENT_ID) : null;
    const leakedRaw = res.text.includes('+212610000010');
    const badFields = /"nationalId"|"salary"|"bank|"grade"|"notes"|"password"/.test(res.text);
    check('T05 lookup masked PII (student)',
      res.status === 200 && hit && typeof hit.maskedPhone === 'string' && hit.maskedPhone.includes('****') && !leakedRaw && !badFields,
      `maskedPhone=${hit?.maskedPhone} rawLeak=${leakedRaw}`);
    const g = await api(desk.cookie, '/api/reception/lookup?q=Guardian');
    const gh = Array.isArray(g.json?.data) ? g.json.data.find((x) => x.type === 'guardian') : null;
    check('T05b lookup masked PII (guardian)', g.status === 200 && gh && gh.maskedPhone?.includes('****') && !g.text.includes('+212610000006'),
      `maskedPhone=${gh?.maskedPhone}`);
  }
  {
    const broad = await api(desk.cookie, '/api/reception/lookup?q=Guardian');
    const nomatch = await api(desk.cookie, '/api/reception/lookup?q=ZZZNoMatch123');
    check('T06 lookup capped + no-match 404',
      broad.status === 200 && Array.isArray(broad.json?.data) && broad.json.data.length <= 20 && nomatch.status === 404 && nomatch.json?.error?.code === 'NO_MATCH',
      `broad=${broad.json?.data?.length ?? '?'} nomatch=${nomatch.status}`);
  }

  // ---- T07: inquiry dedup / retry -----------------------------------------
  {
    const phone = `+2126${String(Date.now()).slice(-7)}`;
    const body = { contactName: 'Verify Walk-in', phone, source: 'walk_in', interestLevel: 'medium', notes: 'reception verify' };
    const first = await api(desk.cookie, '/api/reception/inquiries', { method: 'POST', body });
    const second = await api(desk.cookie, '/api/reception/inquiries', { method: 'POST', body });
    const rows = await q('SELECT count(*)::int AS n FROM inquiries WHERE tenant_id = $1 AND phone = $2', [ATLAS, phone]);
    check('T07 inquiry dedup (retry no duplicate)',
      first.status === 201 && second.status === 409 && second.json?.error?.code === 'DUPLICATE_INQUIRY' && rows[0].n === 1,
      `first=${first.status} retry=${second.status} rows=${rows[0].n}`);
  }

  // ---- T08: approved-notification-template allowlist -----------------------
  {
    const hostId = 'REC-HOST';
    const evil = await api(desk.cookie, '/api/reception/appointments', {
      method: 'POST',
      body: {
        guestName: 'Verify Template Probe', purpose: 'check', hostId,
        startAt: nowIso(), endAt: plus2h(),
        notificationTemplate: 'not_a_real_template',
      },
    });
    check('T08 free-form template rejected 422', evil.status === 422 && evil.json?.error?.code === 'VALIDATION_ERROR', `status=${evil.status}`);

    const phone = `+2126${String(Date.now()).slice(-7)}`;
    const ok = await api(desk.cookie, '/api/reception/appointments', {
      method: 'POST',
      body: {
        guestName: 'Verify Template OK', purpose: 'check', hostId, guestPhone: phone,
        startAt: nowIso(), endAt: plus2h(),
        notificationTemplate: 'appointment_scheduled',
      },
    });
    const sms = await q('SELECT body FROM sms_messages WHERE recipient_phone = $1', [phone]);
    check('T08 approved template renders one SMS',
      ok.status === 201 && sms.length === 1 && sms[0].body.includes('Rendez-vous confirmé'),
      `status=${ok.status} sms=${sms.length}`);
  }

  // ---- T09: appointment idempotent create replay ---------------------------
  {
    const key = `rec-appt-${Date.now()}`;
    const body = { guestName: 'Verify Replay', purpose: 'check', hostId: 'REC-HOST', startAt: nowIso(), endAt: plus2h(), idempotencyKey: key };
    const first = await api(desk.cookie, '/api/reception/appointments', { method: 'POST', body, expectStatus: 201 });
    const second = await api(desk.cookie, '/api/reception/appointments', { method: 'POST', body, expectStatus: 201 });
    const rows = await q('SELECT count(*)::int AS n FROM reception_appointments WHERE idempotency_key = $1', [key]);
    check('T09 appointment replay-safe create',
      first.json?.created === true && second.json?.created === false && rows[0].n === 1,
      `first=${first.json?.created} replay=${second.json?.created} rows=${rows[0].n}`);
  }

  // ---- T10: happy path + immutable history ---------------------------------
  {
    const body = { guestName: 'Verify Happy', purpose: 'check', hostId: 'REC-HOST', startAt: nowIso(), endAt: plus2h() };
    const { json } = await api(desk.cookie, '/api/reception/appointments', { method: 'POST', body, expectStatus: 201 });
    const id = json.data.id;
    const ci = await api(desk.cookie, `/api/reception/appointments/${id}/check-in`, { method: 'POST', body: { reason: 'verify' } });
    const done = await api(desk.cookie, `/api/reception/appointments/${id}/complete`, { method: 'POST', body: { reason: 'verify' } });
    const detail = await api(desk.cookie, `/api/reception/appointments/${id}`);
    const appt = detail.json?.data?.appointment;
    const hist = await q('SELECT to_status FROM reception_appointment_status_history WHERE appointment_id = $1 ORDER BY created_at', [id]);
    check('T10 check-in -> complete + history + version',
      ci.status === 200 && done.status === 200 && appt?.status === 'completed' && appt?.version === 2
        && hist.map((h) => h.to_status).join(',') === 'scheduled,checked_in,completed',
      `ci=${ci.status} done=${done.status} status=${appt?.status} v=${appt?.version} hist=${hist.map((h) => h.to_status).join(',')}`);
  }

  // ---- T11: appointment transition concurrency race -------------------------
  {
    const body = { guestName: 'Verify Race', purpose: 'check', hostId: 'REC-HOST', startAt: nowIso(), endAt: plus2h() };
    const { json } = await api(desk.cookie, '/api/reception/appointments', { method: 'POST', body, expectStatus: 201 });
    const id = json.data.id;
    const [a, b] = await Promise.allSettled([
      api(desk.cookie, `/api/reception/appointments/${id}/check-in`, { method: 'POST', body: { reason: 'race a' } }),
      api(desk.cookie, `/api/reception/appointments/${id}/check-in`, { method: 'POST', body: { reason: 'race b' } }),
    ]);
    const codes = [a, b].map((r) => r.status).sort();
    const first200 = a.status === 'fulfilled' && a.value.status === 200;
    const second409 = b.status === 'fulfilled' && b.value.status === 409 && b.value.json?.error?.code === 'INVALID_TRANSITION';
    const swapped = b.status === 'fulfilled' && b.value.status === 200 && a.status === 'fulfilled' && a.value.status === 409;
    check('T11 appointment race one 200 one 409', (first200 && second409) || swapped, `codes=${codes.join('/')}`);
  }

  // ---- T12: reschedule only when scheduled ---------------------------------
  {
    const body = { guestName: 'Verify Resched', purpose: 'check', hostId: 'REC-HOST', startAt: nowIso(), endAt: plus2h() };
    const { json } = await api(desk.cookie, '/api/reception/appointments', { method: 'POST', body, expectStatus: 201 });
    const id = json.data.id;
    await api(desk.cookie, `/api/reception/appointments/${id}/check-in`, { method: 'POST', body: {} });
    const res = await api(desk.cookie, `/api/reception/appointments/${id}/reschedule`, {
      method: 'POST', body: { startAt: plus2h(), endAt: new Date(Date.now() + 3 * 3600_000).toISOString() },
    });
    check('T12 reschedule non-scheduled 409', res.status === 409 && res.json?.error?.code === 'NOT_SCHEDULED', `status=${res.status}`);
  }

  // ---- T13: invalid transition rejected ------------------------------------
  {
    const body = { guestName: 'Verify Invalid', purpose: 'check', hostId: 'REC-HOST', startAt: nowIso(), endAt: plus2h() };
    const { json } = await api(desk.cookie, '/api/reception/appointments', { method: 'POST', body, expectStatus: 201 });
    const id = json.data.id;
    const res = await api(desk.cookie, `/api/reception/appointments/${id}/complete`, { method: 'POST', body: {} });
    check('T13 invalid transition 409', res.status === 409 && res.json?.error?.code === 'INVALID_TRANSITION', `status=${res.status}`);
  }

  // ---- T14: visitor pass -> check-in -> check-out replay-safe --------------
  {
    const created = await api(desk.cookie, '/api/reception/visitors', {
      method: 'POST',
      body: { visitorFirstName: 'Verify', visitorLastName: 'Visitor', visitorPhone: `+2126${String(Date.now()).slice(-7)}`, purpose: 'verify flow', hostId: 'REC-HOST' },
      expectStatus: 201,
    });
    const id = created.json.data.id;
    const pass = await api(desk.cookie, `/api/reception/visitors/${id}/pass`, { method: 'POST', body: {}, expectStatus: 201 });
    const ci1 = await api(desk.cookie, `/api/reception/visitors/${id}/check-in`, { method: 'POST', body: { gateId: GATE_ID, idempotencyKey: uuid() } });
    const ci2 = await api(desk.cookie, `/api/reception/visitors/${id}/check-in`, { method: 'POST', body: { gateId: GATE_ID, idempotencyKey: uuid() } });
    const co1 = await api(desk.cookie, `/api/reception/visitors/${id}/check-out`, { method: 'POST', body: { gateId: GATE_ID, idempotencyKey: uuid() } });
    const co2 = await api(desk.cookie, `/api/reception/visitors/${id}/check-out`, { method: 'POST', body: { gateId: GATE_ID, idempotencyKey: uuid() } });
    check('T14 visitor pass/check-in/check-out replay-safe',
      pass.status === 201 && ci1.json?.data?.replayed === false && ci2.json?.data?.replayed === true
        && co1.json?.data?.replayed === false && co2.json?.data?.replayed === true,
      `pass=${pass.status} ci1=${ci1.status} ci2=${ci2.status} co1=${co1.status} co2=${co2.status}`);
  }

  // ---- T15: pickup release default-deny ------------------------------------
  {
    const release = await api(desk.cookie, '/api/reception/pickups/release', {
      method: 'POST',
      body: { studentId: STUDENT_ID, authorizationId: AUTH_ID, method: 'manual', gateId: GATE_ID, idempotencyKey: uuid() },
    });
    const list = await api(desk.cookie, `/api/reception/pickups/authorizations?studentId=${STUDENT_ID}`);
    check('T15 pickup default-deny 403', release.status === 403 && list.status === 403, `release=${release.status} list=${list.status}`);
  }

  // ---- T16: pickup override positive + single release ----------------------
  {
    const list = await api(pickupOps.cookie, `/api/reception/pickups/authorizations?studentId=${STUDENT_ID}`);
    const replayKey = 'rec-rel-' + Date.now();
    const first = await api(pickupOps.cookie, '/api/reception/pickups/release', {
      method: 'POST',
      body: { studentId: STUDENT_ID, authorizationId: AUTH_ID, method: 'manual', gateId: GATE_ID, idempotencyKey: replayKey },
    });
    const replay = await api(pickupOps.cookie, '/api/reception/pickups/release', {
      method: 'POST',
      body: { studentId: STUDENT_ID, authorizationId: AUTH_ID, method: 'manual', gateId: GATE_ID, idempotencyKey: replayKey },
    });
    const fresh = await api(pickupOps.cookie, '/api/reception/pickups/release', {
      method: 'POST',
      body: { studentId: STUDENT_ID, authorizationId: AUTH_ID, method: 'manual', gateId: GATE_ID, idempotencyKey: 'rec-rel-fresh-' + Date.now() },
    });
    const events = await q('SELECT count(*)::int AS n FROM guard_release_events WHERE authorization_id = $1', [AUTH_ID]);
    check('T16 override release positive + single event',
      list.status === 200 && first.status === 201 && events[0].n === 1 && replay.status >= 400 && fresh.status >= 400,
      `list=${list.status} first=${first.status} rows=${events[0].n} replay=${replay.status} fresh=${fresh.status}`);
  }

  // ---- T17: unlinked guardian 422 ------------------------------------------
  {
    const res = await api(pickupOps.cookie, '/api/reception/pickups/authorizations', {
      method: 'POST',
      body: {
        studentId: STUDENT_ID, pickupPersonId: UNLINKED_ID, relationshipType: 'Autre',
        authorizedFrom: nowIso(), authorizedUntil: plus2h(),
      },
    });
    check('T17 unlinked guardian create-auth 422',
      res.status === 422 && res.json?.error?.code === 'PICKUP_PERSON_NOT_LINKED', `status=${res.status} code=${res.json?.error?.code}`);
  }

  // ---- T18: handoff lifecycle + replay-safe create -------------------------
  {
    const key = `rec-ho-${Date.now()}`;
    const body = { category: 'teacher', subjectType: 'student', subjectId: STUDENT_ID, title: 'Verify handoff', description: 'verify', priority: 'high', assignedToId: 'REC-HOST', idempotencyKey: key };
    const first = await api(desk.cookie, '/api/reception/handoffs', { method: 'POST', body, expectStatus: 201 });
    const second = await api(desk.cookie, '/api/reception/handoffs', { method: 'POST', body, expectStatus: 201 });
    const rows = await q('SELECT count(*)::int AS n FROM reception_handoffs WHERE idempotency_key = $1', [key]);
    const id = first.json.data.id;
    const ack = await api(desk.cookie, `/api/reception/handoffs/${id}/acknowledge`, { method: 'POST', body: { reason: 'verified' } });
    const resolve = await api(desk.cookie, `/api/reception/handoffs/${id}/resolve`, { method: 'POST', body: { resolutionNotes: 'done in verify' } });
    const resolveAgain = await api(desk.cookie, `/api/reception/handoffs/${id}/resolve`, { method: 'POST', body: { resolutionNotes: 'nope' } });
    const cancel = await api(desk.cookie, `/api/reception/handoffs/${id}/cancel`, { method: 'POST', body: { reason: 'late' } });
    const hist = await q('SELECT to_status FROM reception_handoff_status_history WHERE handoff_id = $1 ORDER BY created_at', [id]);
    check('T18 handoff lifecycle + replay-safe create',
      first.json?.created === true && second.json?.created === false && rows[0].n === 1
        && ack.status === 200 && resolve.status === 200 && resolveAgain.status === 409 && cancel.status === 409
        && hist.map((h) => h.to_status).join(',') === 'open,acknowledged,resolved',
      `create=${first.json?.created} ack=${ack.status} resolve=${resolve.status} again=${resolveAgain.status} cancel=${cancel.status} rows=${rows[0].n}`);
  }

  // ---- T19: handoff concurrency race ---------------------------------------
  {
    const body = { category: 'admin', title: 'Verify handoff race', priority: 'medium', assignedToId: 'REC-HOST' };
    const { json } = await api(desk.cookie, '/api/reception/handoffs', { method: 'POST', body, expectStatus: 201 });
    const id = json.data.id;
    const [a, b] = await Promise.allSettled([
      api(desk.cookie, `/api/reception/handoffs/${id}/acknowledge`, { method: 'POST', body: { reason: 'race a' } }),
      api(desk.cookie, `/api/reception/handoffs/${id}/acknowledge`, { method: 'POST', body: { reason: 'race b' } }),
    ]);
    const ok = (r) => r.status === 'fulfilled' && r.value.status === 200;
    const conflict = (r) => r.status === 'fulfilled' && r.value.status === 409;
    check('T19 handoff race one 200 one 409', (ok(a) && conflict(b)) || (ok(b) && conflict(a)),
      `a=${a.status === 'fulfilled' ? a.value.status : 'rej'} b=${b.status === 'fulfilled' ? b.value.status : 'rej'}`);
  }

  // ---- T20: reception module cannot reach destination-module internals ------
  // A handoff only records coordination intent. Static boundary: nothing under
  // features/reception or app/api/reception may import a finance/admissions
  // service — the privileged actions live behind their own modules.
  {
    const files = [
      ...walk(join(ROOT, 'src', 'features', 'reception')).filter((p) => p.endsWith('.ts')),
      ...walk(join(ROOT, 'src', 'app', 'api', 'reception')).filter((p) => p.endsWith('.ts')),
    ];
    const leaky = files.filter((p) => {
      const src = readFileSync(p, 'utf8');
      return /from ['"].*\/finance\/.*['"]|from ['"]@\/features\/finance|from ['"].*\/admissions\/.*['"]|from ['"]@\/features\/admissions/.test(src)
        || src.includes("from '@/features/finance");
    });
    check('T20 reception module has no finance/admissions imports', leaky.length === 0,
      leaky.length ? `leaks: ${leaky.map((p) => relative(ROOT, p)).join(', ')}` : '');
  }

  // ---- T21: receptionist Finance denial ------------------------------------
  {
    const res = await api(desk.cookie, '/api/finance/expenses');
    check('T21 receptionist Finance 403', res.status === 403, `status=${res.status}`);
  }

  // ---- T22: two-tenant + wrong-branch isolation ----------------------------
  {
    const body = { guestName: 'Verify Isolation', purpose: 'isolation', hostId: 'REC-HOST', startAt: nowIso(), endAt: plus2h() };
    const { json } = await api(desk.cookie, '/api/reception/appointments', { method: 'POST', body, expectStatus: 201 });
    const id = json.data.id;

    const cross = await api(lango.cookie, `/api/reception/appointments/${id}`);
    const wrongBranch = await api(deskB.cookie, `/api/reception/appointments/${id}`);
    const crossList = await api(lango.cookie, '/api/reception/appointments');
    const branchList = await api(deskB.cookie, '/api/reception/appointments');
    const crossSees = (crossList.json?.data ?? []).some((x) => x.id === id);
    const branchSees = (branchList.json?.data ?? []).some((x) => x.id === id);
    check('T22 cross-tenant + wrong-branch safe 404',
      cross.status === 404 && wrongBranch.status === 404 && !crossSees && !branchSees,
      `cross=${cross.status} wrongBranch=${wrongBranch.status} crossSees=${crossSees} branchSees=${branchSees}`);
  }

  // ---- T23: DB schema/constraints ------------------------------------------
  {
    const tables = await q(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
      AND table_name IN ('reception_appointments','reception_appointment_status_history','reception_identity_verifications','reception_handoffs','reception_handoff_status_history')`);
    const idx = await q(`SELECT indexname FROM pg_indexes WHERE tablename IN ('reception_appointments','reception_handoffs') AND indexname LIKE '%idempotency%'`);
    check('T23 reception tables + idempotency indexes present',
      tables.length === 5 && idx.length === 2,
      `tables=${tables.length} idempotencyIdx=${idx.length}`);
  }

  // ---- T24: portal manifest agreement --------------------------------------
  {
    const { status, json } = await api(desk.cookie, '/api/portal/manifest');
    const nav = Array.isArray(json?.data?.navigation) ? json.data.navigation : [];
    const grp = nav.find((g) => g.id === 'reception');
    check('T24 manifest reception group + 6 children',
      status === 200 && grp && Array.isArray(grp.children) && grp.children.length === 6,
      `status=${status} children=${grp?.children?.length ?? '?'}`);
  }

  // ---- T25: static agreement (routes guard, pages guard) -------------------
  {
    const routes = walk(join(ROOT, 'src', 'app', 'api', 'reception')).filter((p) => p.endsWith('route.ts'));
    const unguarded = routes.filter((p) => {
      const src = readFileSync(p, 'utf8');
      return !src.includes('requireRequestContext') || !src.includes('requireTenant') || !src.includes('requireCapability');
    });
    const pages = walk(join(ROOT, 'src', 'app', '[locale]', '(dashboard)', 'dashboard', 'receptionist')).filter((p) => p.endsWith('page.tsx'));
    const unguardedPages = pages.filter((p) => !readFileSync(p, 'utf8').includes('requireServerPage'));
    check('T25 all routes guard ctx/tenant/capability + pages guard requireServerPage',
      unguarded.length === 0 && unguardedPages.length === 0,
      `unguarded=${unguarded.length} unguardedPages=${unguardedPages.length}`);
  }

  await POOL.end();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
