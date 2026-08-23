// Live acceptance verification — Library Management (HTTP adversarial). Hits the
// running dev server with the LIB-* fixtures created by scripts/seed-library-test-data.ts
// and asserts the library security matrix:
//
//   C01  anonymous 401 on a staff route
//   C02  wrong-role (teacher) 403 FORBIDDEN
//   C03  librarian reads members 200 (real data)
//   C04  librarian denied library.charge.waive (403 before body/row logic)
//   C05  tenant-scoped super_admin reads members 200
//   C06  super_admin waives a charge; replay 409 CHARGE_NOT_OPEN
//   C07  school_admin zod validation 422 VALIDATION_ERROR
//   C08  add-on disable 403 ADDON_NOT_ACTIVATED / re-enable 200
//   C09  cross-tenant member 404 both directions
//   C10  cross-tenant copy 404
//   C11  e2e report reads return real data (overview/inventory/circulation)
//
// Fixture logins are `<id>@placeholder.local` with password `LibrVerify123!`.
// Run:  npx tsx scripts/seed-library-test-data.ts
//       node scripts/verify-library-adversarial.mjs
// Env overrides: VERIFY_BASE (default http://localhost:3002), DATABASE_URL.
import { Pool } from 'pg';

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3002';
const ORIGIN = 'http://localhost:3000';
const POOL = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos',
});
const PASS = 'LibrVerify123!';
let ATLAS = '';
const SCHOOL_ADMIN_EMAIL = 'y.elamrani@atlas.ma';
const SCHOOL_ADMIN_PASS = 'Admin123!';

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

async function setLibraryAddon(enabled) {
  await POOL.query(
    `UPDATE addon_entitlements SET is_enabled=$1, updated_at=now() WHERE tenant_id=$2 AND addon_id='library'`,
    [enabled, ATLAS],
  );
}

async function main() {
  // Atlas tenant id is resolved by slug (varies per local seed).
  const [atlasTenant] = await q(`SELECT id FROM tenants WHERE slug='atlas'`);
  if (!atlasTenant) { console.error('SKIPPED SUITE — Atlas tenant not found (slug=atlas). Run the base seed first.'); await POOL.end(); process.exit(2); }
  ATLAS = atlasTenant.id;

  // Fixture discovery straight from the DB (seed is idempotent, LIB- prefix).
  const [atlasMember] = await q(`SELECT id FROM library_members WHERE user_id = 'LIB-TEACHER'`);
  const [bMember] = await q(`SELECT id FROM library_members WHERE member_number = 'LIBVER-0001'`);
  const [bCopy] = await q(`SELECT id FROM library_copies WHERE accession_number = 'LIBVER-0001'`);
  const [bCharge] = await q(`SELECT id FROM library_charges WHERE dedupe_key = 'lib-verify-charge'`);

  if (!atlasMember || !bMember || !bCopy || !bCharge) {
    console.error('SKIPPED SUITE — fixtures missing. Run `npx tsx scripts/seed-library-test-data.ts` first.');
    await POOL.end();
    process.exit(2);
  }

  const admin = await signIn(SCHOOL_ADMIN_EMAIL, SCHOOL_ADMIN_PASS);
  const librarian = await signIn('lib-librarian@placeholder.local', PASS);
  const teacher = await signIn('lib-teacher@placeholder.local', PASS);
  const bSuper = await signIn('lib-b-super@placeholder.local', PASS);
  const bLibrarian = await signIn('lib-b-librarian@placeholder.local', PASS);

  // C01 — anonymous
  {
    const { status } = await api('', '/api/addons/library/members');
    check('C01 anonymous rejected', status === 401, `status=${status}`);
  }

  // C02 — wrong role
  {
    const { status, json } = await api(teacher.cookie, '/api/addons/library/members');
    check('C02 wrong-role (teacher) 403', status === 403 && json?.error?.code === 'FORBIDDEN', `status=${status} code=${json?.error?.code}`);
  }

  // C03 — librarian positive read
  {
    const { status, json } = await api(librarian.cookie, '/api/addons/library/members');
    check('C03 librarian reads members 200', status === 200 && Array.isArray(json?.data), `status=${status} count=${Array.isArray(json?.data) ? json.data.length : 'n/a'}`);
  }

  // C04 — librarian lacks charge.waive
  {
    const { status, json } = await api(librarian.cookie, `/api/addons/library/charges/${crypto.randomUUID()}/waive`, { method: 'POST', body: { reason: 'test deny' } });
    check('C04 librarian denied charge.waive', status === 403 && json?.error?.code === 'FORBIDDEN', `status=${status} code=${json?.error?.code}`);
  }

  // C05 — tenant-scoped super_admin (platform super_admin has tenantId null and
  // is rejected by requireTenant, so this proves the tenant-scoped path works).
  {
    const { status, json } = await api(bSuper.cookie, '/api/addons/library/members');
    check('C05 tenant-scoped super_admin reads members 200', status === 200 && Array.isArray(json?.data), `status=${status}`);
  }

  // C06 — super_admin waive + replay 409 (reset the fixture charge first so the
  // check is deterministic across repeated runs without re-seeding).
  {
    await POOL.query(`UPDATE library_charges SET state='open', waived_by_id=NULL, waived_at=NULL, waiver_reason=NULL, updated_at=now() WHERE dedupe_key='lib-verify-charge'`);
    const first = await api(bSuper.cookie, `/api/addons/library/charges/${bCharge.id}/waive`, { method: 'POST', body: { reason: 'Remise vérification' } });
    const replay = await api(bSuper.cookie, `/api/addons/library/charges/${bCharge.id}/waive`, { method: 'POST', body: { reason: 'Remise vérification bis' } });
    check('C06 super_admin waives charge + replay 409',
      first.status === 200 && replay.status === 409 && replay.json?.error?.code === 'CHARGE_NOT_OPEN',
      `first=${first.status} replay=${replay.status} code=${replay.json?.error?.code}`);
  }

  // C07 — zod validation
  {
    const { status, json } = await api(admin.cookie, '/api/addons/library/circulation/issue', { method: 'POST', body: {} });
    check('C07 school_admin zod validation 422', status === 422 && json?.error?.code === 'VALIDATION_ERROR', `status=${status} code=${json?.error?.code}`);
  }

  // C08 — add-on gate
  {
    await setLibraryAddon(false);
    const gated = await api(admin.cookie, '/api/addons/library/reports/overview');
    const okGated = gated.status === 403 && gated.json?.error?.code === 'ADDON_NOT_ACTIVATED';
    await setLibraryAddon(true);
    const back = await api(admin.cookie, '/api/addons/library/reports/overview');
    check('C08 add-on disable 403 / re-enable 200', okGated && back.status === 200, `disabled=${gated.status} reenabled=${back.status}`);
  }

  // C09 — cross-tenant member 404 both directions
  {
    const aToB = await api(librarian.cookie, `/api/addons/library/members/${bMember.id}`);
    const bToA = await api(bLibrarian.cookie, `/api/addons/library/members/${atlasMember.id}`);
    check('C09 cross-tenant member 404 both ways',
      aToB.status === 404 && aToB.json?.error?.code === 'NOT_FOUND' && bToA.status === 404 && bToA.json?.error?.code === 'NOT_FOUND',
      `A→B=${aToB.status} B→A=${bToA.status}`);
  }

  // C10 — cross-tenant copy 404
  {
    const { status, json } = await api(admin.cookie, `/api/addons/library/copies/${bCopy.id}`);
    check('C10 cross-tenant copy 404', status === 404 && json?.error?.code === 'NOT_FOUND', `status=${status} code=${json?.error?.code}`);
  }

  // C11 — e2e report reads (tenant B has exactly the seeded copy/branch)
  {
    const ov = await api(bSuper.cookie, '/api/addons/library/reports/overview');
    const inv = await api(bSuper.cookie, '/api/addons/library/reports/inventory');
    const circ = await api(bSuper.cookie, '/api/addons/library/reports/circulation');
    check('C11 e2e reports real data',
      ov.status === 200 && Number(ov.json?.data?.totalCopies ?? 0) >= 1
        && inv.status === 200 && Array.isArray(inv.json?.data?.byBranch)
        && circ.status === 200 && typeof circ.json?.data?.loans?.active === 'number',
      `ov=${ov.status} total=${ov.json?.data?.totalCopies} inv=${inv.status} circ=${circ.status}`);
  }

  await POOL.end();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await POOL.query(`UPDATE addon_entitlements SET is_enabled=true WHERE tenant_id=$1 AND addon_id='library'`, [ATLAS]).catch(() => {});
  process.exit(1);
});
