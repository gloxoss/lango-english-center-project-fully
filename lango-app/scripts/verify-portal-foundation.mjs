// ---------------------------------------------------------------------------
// Live verification for the Role Portals Foundation against a running dev
// server (default http://localhost:3002). Requires the local Postgres DB.
//
//   node scripts/verify-portal-foundation.mjs
//
// Covers: anonymous denials, authenticated /api/portal/me + manifest + home +
// search projection + preferences allowlist, base-role switch, forged role
// denied, cross-tenant header denied, cross-tenant branch denied, derived
// role switch (student → parent via a throwaway guardian identity), stale
// active-context degradation when the guardian link is revoked, and context
// tampering (a context row bound to another user_id is refused + dropped;
// a stored active_branch_id that is not the principal's authoritative branch
// is cleared on read).
//
// Two throwaway tenant-A users are created with known passwords (a school_admin
// and a student actor with a guardian identity) and cleaned up in `finally` —
// the DB is left exactly as it was found. Shared administrators are never
// signed in, so their lockout/session state is never touched.
// ---------------------------------------------------------------------------
import { hashPassword } from 'better-auth/crypto';
import pg from 'pg';
import { Agent } from 'undici';

const BASE = process.env.PORTAL_VERIFY_BASE ?? 'http://localhost:3002';
// Next dev recompiles route graphs on demand; the first request to a cold route
// can exceed undici's default 5-min headers timeout. Give every fetch a much
// larger budget so verification measures behavior, not compile latency.
const httpAgent = new Agent({ headersTimeout: 900000, connectTimeout: 60000, keepAliveTimeout: 60000 });
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos';
// Better Auth rejects sign-in POSTs whose Origin does not match BETTER_AUTH_URL
// (serverEnv). localhost:3000 is the dev base URL.
const AUTH_ORIGIN = process.env.PORTAL_VERIFY_AUTH_ORIGIN ?? 'http://localhost:3000';

const T1 = 'ca40c88e-339c-4fea-b5c4-51d5c9cc0239';
const T2 = 'f62f31eb-1fc8-4102-9145-a5ce0bca989b';
// Disposable fixtures only — never sign in as a shared administrator. Resetting
// a shared admin's security state (lockouts, sessions) during verification can
// hide real lockout defects, so the admin-side checks use a throwaway
// school_admin created below and deleted in teardown.
const adminEmail = `portal-verify-admin-${Date.now()}@atlas.local`;
const adminId = `PVAD-${Date.now().toString(36)}`;
const adminPassword = 'PortalTest!123';

const pool = new pg.Pool({ connectionString: DB_URL });

const results = [];
function ok(name) { results.push({ name, pass: true }); console.log(`  ✓ ${name}`); }
function fail(name, detail) { results.push({ name, pass: false }); console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
async function expect(name, cond, detail) {
  if (cond) ok(name); else fail(name, detail);
}

let cookies = {};
let activeEmail = null;
async function signIn(email, password) {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: AUTH_ORIGIN,
      Referer: `${AUTH_ORIGIN}/login`,
    },
    body: JSON.stringify({ email, password }),
    dispatcher: httpAgent,
  });
  if (!res.ok) throw new Error(`sign-in ${email} failed: HTTP ${res.status}`);
  const setCookies = res.headers.getSetCookie?.() ?? [];
  const jar = setCookies.map((c) => c.split(';')[0]).filter(Boolean).join('; ');
  cookies[email] = jar;
  activeEmail = email;
  return jar;
}
async function req(path, { email, headers = {}, method = 'GET', body } = {}) {
  const jar = cookies[email ?? activeEmail];
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(jar ? { Cookie: jar } : {}),
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    dispatcher: httpAgent,
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, json };
}

const actorEmail = `portal-verify-${Date.now()}@atlas.local`;
const actorId = `PV-${Date.now().toString(36)}`;
let guardianId = null;
const actorPassword = 'PortalTest!123';

async function dbRow(query, params) {
  const r = await pool.query(query, params);
  return r.rows[0];
}

async function setup() {
  const password = await hashPassword(actorPassword);
  const adminHash = await hashPassword(adminPassword);
  await pool.query(
    `INSERT INTO "user" (id, tenant_id, email, name, role, user_status, email_verified, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'school_admin', 'active', true, now(), now())`,
    [adminId, T1, adminEmail, 'Portal Verify Admin'],
  );
  await pool.query(
    `INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
     VALUES ($1, $1, 'credential', $2, $3, now(), now())`,
    [adminId, adminId, adminHash],
  );
  await pool.query(
    `INSERT INTO "user" (id, tenant_id, email, name, role, user_status, email_verified, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'student', 'active', true, now(), now())`,
    [actorId, T1, actorEmail, 'Portal Verify Actor'],
  );
  await pool.query(
    `INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
     VALUES ($1, $1, 'credential', $2, $3, now(), now())`,
    [actorId, actorId, password],
  );
  const g = await dbRow(
    `INSERT INTO guardians (tenant_id, user_id, first_name, last_name, email, created_at, updated_at)
     VALUES ($1, $2, 'Portal', 'Verify', $3, now(), now()) RETURNING id`,
    [T1, actorId, actorEmail],
  );
  guardianId = g.id;
  await pool.query(
    `INSERT INTO guardian_students (tenant_id, guardian_id, student_id, relationship_type, is_primary_contact, is_emergency_contact, can_pickup)
     VALUES ($1, $2, 'STU-003', 'parent', true, false, false)`,
    [T1, guardianId],
  );
}

async function teardown() {
  try {
    if (guardianId) await pool.query(`DELETE FROM guardians WHERE id = $1`, [guardianId]);
  } catch {}
  // Sessions must go before the user rows (FK). Each sign-in creates one; with
  // migration 0086 applied, deleting a session also cascades its active-context
  // row. Portal rows are still deleted explicitly first for pre-0086 DBs.
  for (const id of [actorId, adminId]) {
    try { await pool.query(`DELETE FROM portal_active_contexts WHERE user_id = $1 OR session_id IN (SELECT id FROM session WHERE user_id = $1)`, [id]); } catch {}
    try { await pool.query(`DELETE FROM session WHERE user_id = $1`, [id]); } catch {}
    try { await pool.query(`DELETE FROM account WHERE user_id = $1`, [id]); } catch {}
    try { await pool.query(`DELETE FROM "user" WHERE id = $1`, [id]); } catch {}
  }
}

async function main() {
  console.log(`\nRole Portals Foundation — live verification against ${BASE}\n`);
  let branchT1 = null;
  let branchT2 = null;
  try {
    branchT1 = (await pool.query(`SELECT id FROM branches WHERE tenant_id = $1 LIMIT 1`, [T1])).rows[0]?.id ?? null;
    branchT2 = (await pool.query(`SELECT id FROM branches WHERE tenant_id = $1 LIMIT 1`, [T2])).rows[0]?.id ?? null;
  } catch {}

  // --- 1. Anonymous requests are denied on every portal endpoint -------------
  console.log('\n[1] Anonymous denials');
  for (const p of ['/api/portal/me', '/api/portal/manifest', '/api/portal/home', '/api/portal/search?q=Ali', '/api/portal/preferences']) {
    const r = await req(p);
    await expect(`anonymous GET ${p} → 401`, r.status === 401, `got ${r.status}`);
  }
  const anonRole = await req('/api/portal/role', { method: 'POST', body: { role: 'teacher' } });
  await expect('anonymous POST /api/portal/role → 401', anonRole.status === 401, `got ${anonRole.status}`);

  // --- 2. Authenticated tenant-A admin: context, manifest, home --------------
  console.log('\n[2] Tenant-A admin (school_admin)');
  await signIn(adminEmail, adminPassword);
  const me = await req('/api/portal/me');
  await expect('GET /api/portal/me → 200', me.status === 200, `got ${me.status}`);
  await expect('me.tenantId === T1', me.json?.data?.tenantId === T1, JSON.stringify(me.json?.data?.tenantId));
  await expect('me.role === baseRole === school_admin', me.json?.data?.role === 'school_admin' && me.json?.data?.baseRole === 'school_admin');
  await expect('me.availableRoles === [school_admin] (no derived identity)', JSON.stringify(me.json?.data?.availableRoles) === JSON.stringify(['school_admin']));
  await expect('me.permissions is a non-empty array', Array.isArray(me.json?.data?.permissions) && me.json?.data.permissions.length > 0);

  const manifest = await req('/api/portal/manifest');
  await expect('GET /api/portal/manifest → 200', manifest.status === 200, `got ${manifest.status}`);
  await expect('manifest.navigation is a non-empty array', Array.isArray(manifest.json?.data?.navigation) && manifest.json?.data?.navigation.length > 0);
  await expect('manifest.baseRole + availableRoles exposed', manifest.json?.data?.baseRole === 'school_admin' && manifest.json?.data?.availableRoles?.length >= 1);
  const badNav = (manifest.json?.data?.navigation ?? []).find((n) => !n.href || !n.label);
  await expect('every nav item has href + label', !badNav, badNav ? JSON.stringify(badNav) : '');

  const home = await req('/api/portal/home');
  await expect('GET /api/portal/home → 200', home.status === 200, `got ${home.status}`);
  await expect('home.role + widgets present', home.json?.data?.role === 'school_admin' && Array.isArray(home.json?.data?.widgets));

  // --- 3. Search scoping + sensitive-field projection ------------------------
  console.log('\n[3] Search scoping + projection');
  const search = await req('/api/portal/search?q=Omar');
  await expect('admin search → 200', search.status === 200, `got ${search.status}`);
  const s = search.json?.data?.students ?? [];
  await expect('admin finds tenant students', s.length >= 1, `got ${s.length}`);
  if (s.length > 0) {
    const allowed = new Set(['id', 'name', 'email', 'matricule']);
    const keys = Object.keys(s[0]);
    await expect('student projection is exactly {id,name,email,matricule}', keys.every((k) => allowed.has(k)) && keys.length === 4, `got ${JSON.stringify(keys)}`);
  }
  await expect('search has no finance/HR/sensitive fields', !Object.keys(search.json?.data ?? {}).some((k) => /finance|salary|medical|blood|national|guardian/i.test(k)));

  // --- 4. Role-switch gates ---------------------------------------------------
  console.log('\n[4] Role-switch gates');
  const forge = await req('/api/portal/role', { email: adminEmail, method: 'POST', body: { role: 'librarian' } });
  await expect('admin forging unassigned role librarian → 403', forge.status === 403, `got ${forge.status}`);
  const baseSwitch = await req('/api/portal/role', { email: adminEmail, method: 'POST', body: { role: 'school_admin' } });
  await expect('admin switching to own base role → 200', baseSwitch.status === 200, `got ${baseSwitch.status} ${JSON.stringify(baseSwitch.json)}`);
  const afterBase = await req('/api/portal/me', { email: adminEmail });
  await expect('me still school_admin after base switch', afterBase.json?.data?.role === 'school_admin');

  const crossTenant = await req('/api/portal/me', { email: adminEmail, headers: { 'x-tenant-id': T2 } });
  await expect('T1 admin with x-tenant-id=T2 → 403', crossTenant.status === 403, `got ${crossTenant.status}`);
  if (branchT1) {
    // The admin's active branch is null; any non-null branchId the client sends
    // is unassigned and must be refused.
    const crossBranch = await req('/api/portal/role', { email: adminEmail, method: 'POST', body: { role: 'school_admin', branchId: branchT1 } });
    await expect('role switch with an unassigned branchId → 403', crossBranch.status === 403, `got ${crossBranch.status}`);
  }

  // --- 5. Derived role switch (student → parent) via guardian identity --------
  console.log('\n[5] Derived role switch (student → parent)');
  await signIn(actorEmail, actorPassword);
  const actorMe = await req('/api/portal/me', { email: actorEmail });
  await expect('actor baseRole === student', actorMe.json?.data?.baseRole === 'student', JSON.stringify(actorMe.json?.data?.baseRole));
  await expect('actor availableRoles includes parent', (actorMe.json?.data?.availableRoles ?? []).includes('parent'), JSON.stringify(actorMe.json?.data?.availableRoles));
  await expect('actor role starts as student (no stale context)', actorMe.json?.data?.role === 'student', JSON.stringify(actorMe.json?.data?.role));

  const toParent = await req('/api/portal/role', { email: actorEmail, method: 'POST', body: { role: 'parent' } });
  await expect('student → parent switch → 200', toParent.status === 200, `got ${toParent.status} ${JSON.stringify(toParent.json)}`);
  const afterParent = await req('/api/portal/me', { email: actorEmail });
  await expect('me.role === parent after derived switch', afterParent.json?.data?.role === 'parent', JSON.stringify(afterParent.json?.data?.role));
  await expect('me.baseRole still student (base preserved)', afterParent.json?.data?.baseRole === 'student');

  const forgedDerived = await req('/api/portal/role', { email: actorEmail, method: 'POST', body: { role: 'teacher' } });
  await expect('student forging teacher → 403', forgedDerived.status === 403, `got ${forgedDerived.status}`);

  const ctxRow = await dbRow(`SELECT active_role FROM portal_active_contexts WHERE user_id = $1`, [actorId]);
  await expect('active context row persisted server-side', Boolean(ctxRow) && ctxRow.active_role === 'parent', JSON.stringify(ctxRow));

  // --- 6. Preferences allowlist -----------------------------------------------
  console.log('\n[6] Preferences allowlist');
  const setPref = await req('/api/portal/preferences', { email: actorEmail, method: 'PATCH', body: { key: 'navCollapsed', value: true } });
  await expect('PATCH allowed preference key → 200', setPref.status === 200, `got ${setPref.status} ${JSON.stringify(setPref.json)}`);
  const badPref = await req('/api/portal/preferences', { email: actorEmail, method: 'PATCH', body: { key: 'evilKey', value: {} } });
  await expect('PATCH unknown preference key → 400', badPref.status === 400, `got ${badPref.status}`);
  const getPrefs = await req('/api/portal/preferences', { email: actorEmail });
  await expect('GET preferences → 200', getPrefs.status === 200, `got ${getPrefs.status}`);
  await expect('preference persisted for actor', (getPrefs.json?.data ?? []).some((p) => p.key === 'navCollapsed' && p.value === true), JSON.stringify(getPrefs.json?.data));

  // --- 7. Stale active context degrades when identity is revoked -------------
  console.log('\n[7] Stale active-context degradation');
  await pool.query(`DELETE FROM guardian_students WHERE guardian_id = $1`, [guardianId]);
  await pool.query(`DELETE FROM guardians WHERE id = $1`, [guardianId]);
  guardianId = null;
  const degraded = await req('/api/portal/me', { email: actorEmail });
  await expect('revoked guardian → role degrades back to student', degraded.json?.data?.role === 'student', JSON.stringify(degraded.json?.data?.role));
  await expect('availableRoles back to base only', JSON.stringify(degraded.json?.data?.availableRoles) === JSON.stringify(['student']), JSON.stringify(degraded.json?.data?.availableRoles));
  const ctxGone = await dbRow(`SELECT active_role FROM portal_active_contexts WHERE user_id = $1`, [actorId]);
  await expect('stale context row dropped', !ctxGone, JSON.stringify(ctxGone));

  // --- 8. Context tampering: P0 user binding + P1 stale branch ----------------
  console.log('\n[8] Context tampering (P0 user binding + P1 stale branch)');
  // Re-establish a live guardian identity so the actor can reach parent again.
  const g2 = await dbRow(
    `INSERT INTO guardians (tenant_id, user_id, first_name, last_name, email, created_at, updated_at)
     VALUES ($1, $2, 'Portal', 'Verify', $3, now(), now()) RETURNING id`,
    [T1, actorId, actorEmail],
  );
  guardianId = g2.id;
  await pool.query(
    `INSERT INTO guardian_students (tenant_id, guardian_id, student_id, relationship_type, is_primary_contact, is_emergency_contact, can_pickup)
     VALUES ($1, $2, 'STU-003', 'parent', true, false, false)`,
    [T1, guardianId],
  );
  const rederive1 = await req('/api/portal/role', { email: actorEmail, method: 'POST', body: { role: 'parent' } });
  await expect('re-derived parent switch → 200', rederive1.status === 200, `got ${rederive1.status}`);

  // P0: a context row bound to a different authenticated user is refused and
  // dropped. (Migration 0086's user FK already blocks pointing the row at a
  // non-existent user — proven live by the FK violation above — so this points
  // it at a different REAL user, which the FK permits but the code must refuse.)
  await pool.query(`UPDATE portal_active_contexts SET user_id = $2 WHERE user_id = $1`, [actorId, adminId]);
  const p0me = await req('/api/portal/me', { email: actorEmail });
  await expect('tampered context user_id → /me degrades to student', p0me.json?.data?.role === 'student', JSON.stringify(p0me.json?.data?.role));
  const p0rows = await dbRow(
    `SELECT COUNT(*)::int AS n FROM portal_active_contexts WHERE session_id IN (SELECT id FROM session WHERE user_id = $1)`,
    [actorId],
  );
  await expect('tampered context row dropped (P0)', p0rows?.n === 0, JSON.stringify(p0rows));

  // P1: a stored active branch that is not the principal's authoritative
  // assignment is cleared on read, never honored.
  const rederive2 = await req('/api/portal/role', { email: actorEmail, method: 'POST', body: { role: 'parent' } });
  await expect('re-derived parent switch (again) → 200', rederive2.status === 200, `got ${rederive2.status}`);
  if (branchT1) {
    // The actor has no authoritative branch (user.branch_id is null), so a
    // stored active_branch_id that references any branch is stale by
    // definition and must be cleared on read.
    await pool.query(`UPDATE portal_active_contexts SET active_branch_id = $2 WHERE user_id = $1`, [actorId, branchT1]);
    const p1me = await req('/api/portal/me', { email: actorEmail });
    await expect('tampered active_branch_id not honored (role still parent)', p1me.json?.data?.role === 'parent', JSON.stringify(p1me.json?.data?.role));
    const p1row = await dbRow(`SELECT active_branch_id FROM portal_active_contexts WHERE user_id = $1`, [actorId]);
    await expect('tampered active_branch_id cleared on read (P1)', p1row?.active_branch_id === null, JSON.stringify(p1row));
  }

  // --- Report ----------------------------------------------------------------
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${'='.repeat(70)}`);
  console.log(`SUMMARY: ${passed}/${results.length} checks passed`);
  if (passed !== results.length) {
    console.error('FAILED:');
    results.filter((r) => !r.pass).forEach((r) => console.error(`  - ${r.name}`));
    process.exitCode = 1;
  }
  console.log(`(base: ${BASE})`);
}

try {
  await setup();
  await main();
} catch (err) {
  console.error('FATAL:', err);
  process.exitCode = 1;
} finally {
  await teardown();
  await pool.end();
}
