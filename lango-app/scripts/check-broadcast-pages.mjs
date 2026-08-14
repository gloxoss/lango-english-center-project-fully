// Live page-render check for Broadcast Messaging UI (Phase 5).
// Signs in as the Atlas school admin and fetches every broadcast page in en+fr,
// asserting a 200 (authenticated) response. Client components render their data
// after hydration, so we assert status + that the page did not bounce to login.
// Run: node scripts/check-broadcast-pages.mjs
const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3002';
const ORIGIN = 'http://localhost:3000';

async function signIn(email, password) {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  });
  const setCookies = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  if (!setCookies) throw new Error(`sign-in for ${email} returned no cookie (${res.status})`);
  return setCookies;
}

async function get(cookie, path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Cookie: cookie, Origin: ORIGIN },
    redirect: 'manual',
  });
  const text = await res.text();
  return { status: res.status, location: res.headers.get('location') ?? '', html: text };
}

const PASSWORD = 'Admin123!';
const pages = [
  '/dashboard/broadcast',
  '/dashboard/broadcast/connections',
  '/dashboard/broadcast/segments',
  '/dashboard/broadcast/templates',
  '/dashboard/broadcast/campaigns',
  '/dashboard/broadcast/reports',
  '/dashboard/broadcast/automations',
];

const results = [];
const check = (label, ok, detail = '') => {
  results.push({ label, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
};

const cookie = await signIn('y.elamrani@atlas.ma', PASSWORD);
for (const locale of ['en', 'fr']) {
  for (const page of pages) {
    const { status, location, html } = await get(cookie, `/${locale}${page}`);
    const isLoginBounce = status === 307 && /sign-in|login/.test(location);
    const renders = status === 200 && !isLoginBounce;
    check(`${locale} ${page}`.trim(), renders, `status ${status}${location ? ` → ${location}` : ''}`);
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} page checks passed`);
process.exit(failed.length ? 1 : 0);
