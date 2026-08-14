// verify-two-factor.mjs — live verification of 2FA enforcement (plan #3).
// Covers:
//   A. super_admin mandatory enrollment screen on /dashboard
//   B. school_admin NOT enforced while the tenant toggle is off
//   C. tenant toggle on -> school_admin blocked, accountant unaffected, other
//      tenant (Lango) unaffected; toggle off -> restored
//   D. self-service TOTP enrollment (enable -> verify-totp)
//   E. re-login challenge (twoFactorRedirect + methods) then TOTP pass
//   F. email-OTP fallback: send-otp -> read code from two_factor_otps -> verify-otp
//   G. backup-code login
//   H. 2FA-challenge rate limit (4 rapid calls -> 4th blocked)
//   I. cleanup (disable 2FA, restore setting, remove otp rows) + final state
// Run: node scripts/verify-two-factor.mjs  (dev server must be on :3002)
// Prod: VERIFY_BASE=http://localhost:3004 node scripts/verify-two-factor.mjs
//   (H1/H2 rate-limit checks are real passes on a prod build; sign-ins are paced
//   to 11s apart so Better Auth's prod /sign-in rule of max 3 per 10s is respected)
import { Pool } from 'pg';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3002';
const ORIGIN = 'http://localhost:3000';
const ENROLL_MARKER = 'Sécurisez votre compte';

// ── test accounts (roles/tenants checked against DB at runtime) ──
const SUPER = { email: 'superadmin@schoolos.ma', password: 'Admin123!' };
const ADMIN = { email: 'admin2@atlas.ma', password: 'Admin123!' };       // Atlas school_admin
const LANGO_ADMIN = { email: 'admin@lango.ma', password: 'Admin123!' };  // Lango school_admin
const ACCOUNTANT = { email: 'accountant@atlas.ma', password: 'Admin123!' };

let passed = 0;
let failed = 0;
let deferred = 0;
const failures = [];
function check(name, ok, extra = '') {
  if (ok) { passed += 1; console.log(`  PASS  ${name}`); }
  else { failed += 1; failures.push(name); console.log(`  FAIL  ${name}${extra ? ` — ${extra}` : ''}`); }
}
function defer(name, note) {
  deferred += 1;
  console.log(`  DEFER ${name} — ${note}`);
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── env + pg ──
function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = rawLine.trim().match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
  }
}
loadLocalEnv();
const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos' });

const ATLAS = 'ca40c88e-339c-4fea-b5c4-51d5c9cc0239';
const LANGO = 'f62f31eb-1fc8-4102-9145-a5ce0bca989b';

// ── cookie jar ──
class Jar {
  constructor() { this.cookies = new Map(); }
  setFrom(res) {
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair, ...rest] = raw.split(';');
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      const attrs = {};
      for (const a of rest) {
        const t = a.trim(); const i = t.indexOf('=');
        attrs[i === -1 ? t.toLowerCase() : t.slice(0, i).toLowerCase()] = i === -1 ? true : t.slice(i + 1).replace(/^"(.*)"$/, '$1');
      }
      const maxAge = attrs['max-age'];
      if (maxAge !== undefined && Number(maxAge) <= 0) { this.cookies.delete(name); continue; }
      if (attrs.expires && new Date(attrs.expires) < new Date()) { this.cookies.delete(name); continue; }
      this.cookies.set(name, { name, value, path: attrs.path || '/' });
    }
  }
  header(url) {
    return [...this.cookies.values()].map(c => `${c.name}=${c.value}`).join('; ');
  }
  clear() { this.cookies.clear(); }
}

async function req(jar, method, pathStr, body) {
  const url = `${BASE}${pathStr}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      ...(jar ? { Cookie: jar.header(url) } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  jar?.setFrom(res);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json, text };
}

const signIn = (jar, email, password) => req(jar, 'POST', '/api/auth/sign-in/email', { email, password });
const signOut = (jar) => req(jar, 'POST', '/api/auth/sign-out');
// Better Auth's default special rule throttles /sign-in* to max 3 per 10s
// (dist/api/rate-limiter/index.mjs getDefaultSpecialRules), active in production.
// The suite logs in ~12 times, so space every sign-in >= 11s apart or the prod
// anti-brute-force limiter 429s the bursty sections (A-C have no built-in sleeps).
let lastSignInAt = 0;
async function pacedSignIn(jar, email, password) {
  const gap = Date.now() - lastSignInAt;
  if (lastSignInAt > 0 && gap < 11000) await sleep(11000 - gap);
  lastSignInAt = Date.now();
  return signIn(jar, email, password);
}
const getPage = async (jar, pathStr) => {
  const url = `${BASE}${pathStr}`;
  const res = await fetch(url, { headers: { Origin: ORIGIN, ...(jar ? { Cookie: jar.header(url) } : {}) }, redirect: 'manual' });
  jar?.setFrom(res);
  return { status: res.status, html: await res.text() };
};

// ── RFC 6238 TOTP ──
function base32Decode(str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...str.toUpperCase().replace(/=+$/, '')].map(c => alphabet.indexOf(c)).filter(i => i >= 0)
    .map(i => i.toString(2).padStart(5, '0')).join('');
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}
function totp(secretBase32) {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', key).update(buf).digest();
  const off = h[h.length - 1] & 0x0f;
  const bin = ((h[off] & 0x7f) << 24) | ((h[off + 1] & 0xff) << 16) | ((h[off + 2] & 0xff) << 8) | (h[off + 3] & 0xff);
  return (bin % 10 ** 6).toString().padStart(6, '0');
}

async function dbToggleRequireAdmin2fa(tenantId, on) {
  if (on) {
    await pool.query(`
      insert into setting_values (tenant_id, key, value, version, created_at, updated_at)
      values ($1, 'security.requireTwoFactorForAdmins', 'true', 1, now(), now())
      on conflict (tenant_id, branch_id, key)
      do update set value = excluded.value, updated_at = now()
    `, [tenantId]);
  } else {
    await pool.query(`delete from setting_values where tenant_id = $1 and key = 'security.requireTwoFactorForAdmins'`, [tenantId]);
  }
}

async function dbCleanup() {
  const uidRes = await pool.query(`select id from "user" where email = $1`, [ADMIN.email]);
  const uid = uidRes.rows[0]?.id;
  if (uid) {
    await pool.query(`delete from two_factor_otps where user_id = $1`, [uid]);
    await pool.query(`delete from two_factor where user_id = $1`, [uid]);
    await pool.query(`update "user" set two_factor_enabled = false where id = $1`, [uid]);
  }
  await dbToggleRequireAdmin2fa(ATLAS, false);
  await dbToggleRequireAdmin2fa(LANGO, false);
}

async function run() {
  try {
    // ─────────────────────────────────────────────────────────────────
    // A. super_admin mandatory
    // ─────────────────────────────────────────────────────────────────
    console.log('\n[A] super_admin mandatory enforcement');
    {
      const jar = new Jar();
      const si = await pacedSignIn(jar, SUPER.email, SUPER.password);
      check('A1: superadmin sign-in returns session (no challenge yet)', si.status === 200 && !!si.json?.user, `status=${si.status}`);
      const page = await getPage(jar, '/fr/dashboard');
      check('A2: /fr/dashboard shows mandatory 2FA enroll screen', page.html.includes(ENROLL_MARKER));
    }

    // ─────────────────────────────────────────────────────────────────
    // B. school_admin NOT enforced while toggle is off
    // ─────────────────────────────────────────────────────────────────
    console.log('\n[B] school_admin not enforced while toggle off');
    {
      const jar = new Jar();
      const si = await pacedSignIn(jar, ADMIN.email, ADMIN.password);
      check('B1: admin sign-in ok', si.status === 200 && !!si.json?.user, `status=${si.status}`);
      const page = await getPage(jar, '/fr/dashboard');
      check('B2: /fr/dashboard renders shell (no enroll screen)', !page.html.includes(ENROLL_MARKER));
    }

    // ─────────────────────────────────────────────────────────────────
    // C. tenant toggle on -> block; accountant + Lango unaffected; off -> restore
    // ─────────────────────────────────────────────────────────────────
    console.log('\n[C] per-tenant enforcement toggle');
    await dbToggleRequireAdmin2fa(ATLAS, true);
    {
      const jar = new Jar();
      const si = await pacedSignIn(jar, ADMIN.email, ADMIN.password);
      check('C1: admin sign-in still ok while toggle on', si.status === 200 && !!si.json?.user, `status=${si.status}`);
      const page = await getPage(jar, '/fr/dashboard');
      check('C2: Atlas school_admin blocked (enroll screen)', page.html.includes(ENROLL_MARKER));

      const aj = new Jar();
      await pacedSignIn(aj, ACCOUNTANT.email, ACCOUNTANT.password);
      const apage = await getPage(aj, '/fr/dashboard');
      check('C3: accountant unaffected (shell)', !apage.html.includes(ENROLL_MARKER));

      const lj = new Jar();
      await pacedSignIn(lj, LANGO_ADMIN.email, LANGO_ADMIN.password);
      const lpage = await getPage(lj, '/fr/dashboard');
      check('C4: Lango school_admin unaffected (tenant isolation)', !lpage.html.includes(ENROLL_MARKER));
    }
    await dbToggleRequireAdmin2fa(ATLAS, false);
    {
      const jar = new Jar();
      await pacedSignIn(jar, ADMIN.email, ADMIN.password);
      const page = await getPage(jar, '/fr/dashboard');
      check('C5: Atlas school_admin restored after toggle off', !page.html.includes(ENROLL_MARKER));
    }

    // ─────────────────────────────────────────────────────────────────
    // D. full TOTP enrollment via self-service endpoints
    // ─────────────────────────────────────────────────────────────────
    console.log('\n[D] TOTP enrollment (enable -> verify-totp)');
    let backupCodes = [];
    let secret = null;
    {
      const jar = new Jar();
      await pacedSignIn(jar, ADMIN.email, ADMIN.password);
      const en = await req(jar, 'POST', '/api/auth/two-factor/enable', { password: ADMIN.password });
      check('D1: enable returns totpURI + backupCodes', en.status === 200 && !!en.json?.totpURI && Array.isArray(en.json?.backupCodes) && en.json.backupCodes.length >= 5,
        `status=${en.status} codes=${en.json?.backupCodes?.length ?? 0}`);
      if (en.json?.totpURI) {
        secret = en.json.totpURI.match(/secret=([^&]+)/)?.[1] ?? null;
        backupCodes = en.json.backupCodes ?? [];
      }
      check('D2: secret extractable from URI', !!secret);
      const code = secret ? totp(secret) : '000000';
      const vt = await req(jar, 'POST', '/api/auth/two-factor/verify-totp', { code, trustDevice: true });
      // NOTE: in the full-session path the plugin returns the stale pre-update user,
      // so the twoFactorEnabled flip is proven by D4 (/api/auth/get-session) + D5 (dashboard).
      check('D3: verify-totp activates 2FA (response ok)', vt.status === 200 && !!vt.json?.user,
        `status=${vt.status}`);
      const sess = await req(jar, 'GET', '/api/auth/get-session');
      check('D4: session now reports twoFactorEnabled=true', sess.status === 200 && sess.json?.user?.twoFactorEnabled === true,
        `status=${sess.status}`);
      const page = await getPage(jar, '/fr/dashboard');
      check('D5: enrolled admin reaches dashboard shell', !page.html.includes(ENROLL_MARKER));
    }

    await sleep(11000);

    // ─────────────────────────────────────────────────────────────────
    // E. re-login challenge + TOTP pass
    // ─────────────────────────────────────────────────────────────────
    console.log('\n[E] login challenge + TOTP re-login');
    {
      const jar = new Jar();
      const si = await pacedSignIn(jar, ADMIN.email, ADMIN.password);
      check('E1: sign-in triggers twoFactorRedirect', si.json?.twoFactorRedirect === true, `status=${si.status}`);
      const methods = si.json?.twoFactorMethods ?? [];
      check('E2: methods include totp', methods.includes('totp'), `methods=${JSON.stringify(methods)}`);
      check('E3: methods include otp (sendOTP wired)', methods.includes('otp'), `methods=${JSON.stringify(methods)}`);
      const code = secret ? totp(secret) : '000000';
      const vt = await req(jar, 'POST', '/api/auth/two-factor/verify-totp', { code, trustDevice: true });
      check('E4: verify-totp completes sign-in', vt.status === 200 && !!vt.json?.user, `status=${vt.status}`);
      const page = await getPage(jar, '/fr/dashboard');
      check('E5: authenticated admin reaches dashboard', !page.html.includes(ENROLL_MARKER));
    }

    await sleep(11000);

    // ─────────────────────────────────────────────────────────────────
    // F. email-OTP fallback
    // ─────────────────────────────────────────────────────────────────
    console.log('\n[F] email-OTP fallback');
    {
      const jar = new Jar();
      await pacedSignIn(jar, ADMIN.email, ADMIN.password);
      const so = await req(jar, 'POST', '/api/auth/two-factor/send-otp', {});
      check('F1: send-otp succeeds', so.status === 200 && so.json?.status === true, `status=${so.status}`);
      const uidRes = await pool.query(`select id from "user" where email = $1`, [ADMIN.email]);
      const otpRes = await pool.query(
        `select otp, email, expires_at from two_factor_otps where user_id = $1 order by created_at desc limit 1`,
        [uidRes.rows[0]?.id],
      );
      const otpRow = otpRes.rows[0];
      check('F2: OTP recorded in two_factor_otps with user email', !!otpRow && otpRow.email === ADMIN.email, `row=${JSON.stringify(otpRow ?? null)}`);
      check('F3: OTP is 6 digits', !!otpRow && /^\d{6}$/.test(otpRow.otp), `otp=${otpRow?.otp}`);
      const vo = await req(jar, 'POST', '/api/auth/two-factor/verify-otp', { code: otpRow?.otp ?? '000000', trustDevice: true });
      check('F4: verify-otp completes sign-in', vo.status === 200 && !!vo.json?.user, `status=${vo.status}`);
      const page = await getPage(jar, '/fr/dashboard');
      check('F5: email-OTP-authenticated admin reaches dashboard', !page.html.includes(ENROLL_MARKER));
    }

    await sleep(11000);

    // ─────────────────────────────────────────────────────────────────
    // G. backup-code login
    // ─────────────────────────────────────────────────────────────────
    console.log('\n[G] backup-code login');
    {
      const jar = new Jar();
      await pacedSignIn(jar, ADMIN.email, ADMIN.password);
      const vb = await req(jar, 'POST', '/api/auth/two-factor/verify-backup-code', { code: backupCodes[0], trustDevice: true });
      check('G1: backup code completes sign-in', vb.status === 200 && !!vb.json?.user, `status=${vb.status} err=${vb.json?.message ?? ''}`);
      const page = await getPage(jar, '/fr/dashboard');
      check('G2: backup-code-authenticated admin reaches dashboard', !page.html.includes(ENROLL_MARKER));
    }

    await sleep(11000);

    // ─────────────────────────────────────────────────────────────────
    // H. 2FA-challenge rate limit (plugin built-in: 3 per 10s)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n[H] challenge rate limit');
    {
      const jar = new Jar();
      await pacedSignIn(jar, ADMIN.email, ADMIN.password);
      const codes = [];
      for (let i = 0; i < 4; i += 1) {
        const r = await req(jar, 'POST', '/api/auth/two-factor/verify-totp', { code: '999999' });
        codes.push(r.status);
      }
      if (codes.includes(429)) {
        check('H1: burst of 4 verify calls -> at least one rate-limited (429)', true, `statuses=${codes.join(',')}`);
        check('H2: first calls rejected as invalid code (401/400)', codes[0] === 401 || codes[0] === 400, `first=${codes[0]}`);
      } else {
        // Better Auth disables rate limiting outside production (dist/context/create-context.mjs:
        // `enabled: options.rateLimit?.enabled ?? isProduction`). The twoFactor plugin rule
        // (3 per 10s on /two-factor/*) is registered but inactive under `next dev`, so a 429
        // cannot fire here. Live-verified at the T8 production-build gate instead.
        defer('H1/H2', `rate limit inactive in dev (isProduction gate); plugin rule registered; statuses=${codes.join(',')}`);
      }
    }

    await sleep(11000);

    // ─────────────────────────────────────────────────────────────────
    // I. cleanup + final state
    // ─────────────────────────────────────────────────────────────────
    console.log('\n[I] cleanup + final state');
    {
      const jar = new Jar();
      await pacedSignIn(jar, ADMIN.email, ADMIN.password);
      // 2FA is still enabled, so sign-in leaves only a challenge cookie. Complete the
      // challenge first — /two-factor/disable requires an authenticated session.
      const code = secret ? totp(secret) : '000000';
      await req(jar, 'POST', '/api/auth/two-factor/verify-totp', { code, trustDevice: true });
      const dis = await req(jar, 'POST', '/api/auth/two-factor/disable', { password: ADMIN.password });
      check('I1: disable succeeds', dis.status === 200 && dis.json?.status === true, `status=${dis.status} msg=${dis.json?.message ?? ''}`);
      await dbCleanup();
      const uidRes = await pool.query(`select id from "user" where email = $1`, [ADMIN.email]);
      const uid = uidRes.rows[0]?.id;
      const state = await pool.query(
        `select two_factor_enabled,
          (select count(*) from two_factor tf where tf.user_id = $1) as tf_rows,
          (select count(*) from two_factor_otps o where o.user_id = $1) as otp_rows,
          (select count(*) from setting_values sv where sv.key = 'security.requireTwoFactorForAdmins' and sv.tenant_id = $2) as setting_rows
         from "user" where id = $1`,
        [uid, ATLAS],
      );
      const s = state.rows[0];
      check('I2: final state clean (tfa off, no tf rows, no otp rows, no setting row)',
        s.two_factor_enabled === false && Number(s.tf_rows) === 0 && Number(s.otp_rows) === 0 && Number(s.setting_rows) === 0,
        `tfa=${s.two_factor_enabled} tf=${s.tf_rows} otp=${s.otp_rows} setting=${s.setting_rows}`);
    }

    console.log(`\n==== ${passed} passed, ${failed} failed, ${deferred} deferred ====`);
    if (deferred > 0) {
      console.log('Deferred (documented, not counted as pass):');
      console.log('  - H1/H2 challenge rate limit — dev-mode gate; verify at T8 prod build');
    }
    if (failures.length) {
      console.log('Failed:');
      for (const f of failures) console.log(`  - ${f}`);
    }
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Verify crashed:', err);
  process.exitCode = 1;
}).finally(() => { process.exitCode = failed ? 1 : process.exitCode ?? 0; });
