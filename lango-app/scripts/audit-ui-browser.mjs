// Browser audit: loads every static dashboard page as a given role and records
// what a real user would actually hit.
//
// Why this exists: 2,121 unit tests pass while four separate live screens were
// broken — a 500 surfacing as "save failed", three nav entries whose permission
// disagreed with their page guard (bouncing users to the public marketing site),
// and a screen that 403'd for the only role that needs it. Route tests prove the
// API. They say nothing about whether a human can reach or use the thing.
//
// ---------------------------------------------------------------------------
// MEASUREMENT DISCIPLINE
//
// The first version of this script reported five findings on a healthy build.
// Four were artefacts of how it measured, and disproving them cost a 19-minute
// run plus a triage session. Each artefact is now structurally impossible:
//
//   1. COMPILE LAG. Turbopack compiles on demand, so the *first* hit on a route
//      can 500 for reasons unrelated to the code — byte-identical in the output
//      to a real break. The default is now `next start` against a production
//      build the audit builds and owns itself, in .next-audit/ (see
//      buildAuditBundle for why it is not `.next`). Every route is precompiled,
//      so a 500 is a real 500. If you audit a dev server instead (--server=dev),
//      every route is warmed once and discarded before measurement begins, and a
//      5xx is retried once with the recovery recorded rather than counted.
//
//   2. TEXT-FREE IS NOT EMPTY. A loading state renders no text, so the old
//      `innerText.length < 40` test flagged every spinner screen. settings/values
//      was reported as "renders almost nothing" while showing a text-free
//      spinner; it renders 1094 characters at 1.5s. Emptiness is now decided
//      after the page settles, with loading affordances counted as content, and
//      with DOM node count — not text length — as the real signal.
//
//   3. A 4xx IS NOT NECESSARILY A FAILURE. /api/settings/logo answers 404 with
//      {"success":false,"message":"Logo non trouvé"} when no logo is configured.
//      That is the endpoint working correctly. Responses with status < 500 and a
//      JSON body carrying success:false are reported as `handled` — printed, so
//      the excuse is visible and reviewable, never silent.
//
// SAFETY: clicking is opt-in (--click) and never touches a control whose label
// matches DESTRUCTIVE. Marking attendance here can send SMS to guardians, so
// --click refuses to run at all while any SMS/email/payment provider credential
// is present in the environment (see NOTIFY_CREDENTIAL below). Override with
// --allow-clicks-with-providers only when you mean it.
//
//   4. THE HARNESS'S OWN PRESSURE. A 298-route sweep blows past better-auth's
//      100-requests-per-minute limiter and starts collecting 429s around the
//      hundredth page, which the old version printed as failures on 41 screens
//      that were fine. A 429 is now its own outcome: the run reads
//      x-retry-after, yields for exactly that long, and re-measures the page.
//      Anything still unmeasured is listed as unmeasured rather than passed.
//
// Integrity guards, all of which exit 2 rather than reporting a defect:
//   - the audit build is fingerprinted (paths, not just mtimes, so a deleted
//     page still counts as a change) and rebuilt when src/ moves on;
//   - if the build directory or the server vanishes mid-run, the run is declared
//     invalid instead of reporting every page as a 500;
//   - package.json / package-lock.json / node_modules/.package-lock.json are
//     hashed at start and re-checked at the end, because changing a dependency
//     mid-run rewrites the module graph under the browser and invalidates
//     everything measured after that point. It has happened.
//
// Usage (from lango-app/):
//   node scripts/audit-ui-browser.mjs --role=school_admin
//   node scripts/audit-ui-browser.mjs --role=teacher --click
//   node scripts/audit-ui-browser.mjs --role=all --out=audit.json
//
// Exit codes: 0 clean, 1 findings, 2 the run itself was invalid (no fresh build,
// server unreachable, login failed, dependencies changed mid-run).
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const CWD = process.cwd();
const PASSWORD = process.env.AUDIT_PASSWORD ?? 'Admin123!';

// One seeded login per role. Update if the seed changes.
const ACCOUNTS = {
  school_admin: 'y.elamrani@atlas.ma',
  teacher: 'prof.01@atlas.ma',
  accountant: 'accountant@atlas.ma',
  receptionist: 'accueil@atlas.ma',
  librarian: 'bibliotheque@atlas.ma',
  guard: 'securite@atlas.ma',
  parent: 'parent.001@atlas.ma',
  student: 'etudiant.0001@atlas.ma',
  alumni: 'ancien.eleve@atlas.ma',
  super_admin: 'superadmin@schoolos.ma',
};

// Never clicked: these mutate state or notify families, and an audit has to be
// re-runnable against the same seed. Matched against the diacritic-stripped
// label (see fold()), so "Générer" and "Generer" both hit.
const DESTRUCTIVE = [
  'supprim', 'delete', 'remove', 'archiv', 'retir', 'revoqu', 'initialis',
  'desactiv', 'sactiv', 'clotur', 'valid', 'approuv', 'rejet', 'refus',
  'envoy', 'publi', 'payer', 'rembours', 'verrouill', 'annul', 'generer',
  'lancer', 'ecout', 'import', 'reset', 'purge', 'vider', 'marquer',
  'notifier', 'diffus', 'confirmer', 'soumettre', 'transf',
];

// A --click run that can reach a message queue is not an audit, it is a
// broadcast. Names only, never values, and empty/placeholder values do not
// count as configured.
const NOTIFY_CREDENTIAL = /^(?:TWILIO|VONAGE|NEXMO|INFOBIP|SENDGRID|MAILGUN|POSTMARK|RESEND|SMTP|MAIL|EMAIL|STRIPE|PAYPAL|ORANGE_SMS|MAROC_TELECOM|AWS_SES|FCM|FIREBASE|WHATSAPP|PUSH)[A-Z0-9_]*$/;

// ---------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = args.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const num = (name, fallback) => {
  const raw = arg(name, '');
  if (raw.trim() === '') {
    return fallback;
  }
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
};

const CLICK = args.includes('--click');
const ROLE = arg('role', 'school_admin');
const LIMIT = num('limit', 0) || Number.POSITIVE_INFINITY;
const OUT = arg('out', '');
const MAX_CLICKS = num('max-clicks', 10);
// Substring filter, so a suspicious subtree can be re-run on its own — useful for
// telling a real failure apart from a rate-limit cascade caused by the sweep.
const MATCH = arg('match', '');
const DELAY = num('delay', 0);
// prod: build into AUDIT_DIST if needed, serve it with `next start` (default).
// dev:  use whatever is already running at AUDIT_BASE, warming each route first.
const SERVER_MODE = arg('server', 'prod');
const SERVER_PORT = num('port', Number(process.env.AUDIT_PORT ?? 3222));
const ALLOW_STALE = args.includes('--allow-stale');
const NO_BUILD = args.includes('--no-build');
// The audit owns this directory. See buildAuditBundle() for why it is not `.next`.
const AUDIT_DIST = process.env.AUDIT_DIST_DIR ?? '.next-audit';
const ALLOW_PROVIDERS = args.includes('--allow-clicks-with-providers');
const SETTLE_MS = num('settle', 1600);
const CONTENT_WAIT_MS = num('content-wait', 4000);
const NAV_TIMEOUT = num('timeout', 40000);
// Rate-limit handling: how many times a role's sweep will yield to a 429, and the
// longest single yield. The sweep generates the load that trips the limiter, so
// the fix belongs here rather than in the app's limiter settings.
const MAX_THROTTLE_PAUSES = num('max-throttle-pauses', 6);
const MAX_THROTTLE_PAUSE_MS = num('max-throttle-pause', 90000);

const MIN_TEXT = 40;
const MIN_NODES = 12;

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: node scripts/audit-ui-browser.mjs [options]

  --role=<name|a,b|all>   seeded account(s) to audit (default school_admin)
  --match=<substring>     only routes containing this substring
  --delay=<ms>            extra settle time per route
  --click                 click non-destructive controls (opt-in; see SAFETY)
  --out=<file>            write the full JSON report
  --limit=<n>             cap the number of routes
  --max-clicks=<n>        controls clicked per page (default 10)
  --server=<prod|dev>     prod: build into .next-audit and serve it with next start (default)
                          dev:  use the server at AUDIT_BASE, warming each route first
  --port=<n>              port for the spawned production server (default 3222)
  --allow-stale           audit an existing .next-audit build even if src/ is newer
  --no-build              never run next build; fail if .next-audit is missing or stale
  --settle=<ms>           floor wait after navigation (default 1600)
  --content-wait=<ms>     extra budget when a page looks empty or still loading (default 4000)
  --max-throttle-pauses=<n>  how many times to yield to a 429 and re-measure (default 6)
  --allow-clicks-with-providers  permit --click while notification credentials exist
`);
  process.exit(0);
}

/** Lower-case, accent-stripped: so DESTRUCTIVE can be written in plain ASCII. */
const fold = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// ---------------------------------------------------------------------------
// Run integrity
// ---------------------------------------------------------------------------

/**
 * Hash of the manifests that, when changed mid-run, invalidate the results.
 *
 * node_modules/.package-lock.json is in the list because an install can rewrite
 * the module tree without touching package.json — and it is the module graph
 * changing underneath a running server that breaks the run, not the manifest.
 */
function dependencyFingerprint() {
  const hash = crypto.createHash('sha256');
  for (const f of ['package.json', 'package-lock.json', path.join('node_modules', '.package-lock.json')]) {
    const p = path.join(CWD, f);
    hash.update(fs.existsSync(p) ? fs.readFileSync(p) : 'missing');
  }
  return hash.digest('hex');
}

/**
 * Notification/payment credentials visible to this process or in the app's .env.
 * Only names are returned, and only for values that are actually set — an empty
 * or placeholder entry is not "configured".
 */
function configuredProviders() {
  const found = new Set();
  const consider = (key, value) => {
    if (!NOTIFY_CREDENTIAL.test(key)) {
      return;
    }
    const v = String(value ?? '').trim();
    if (v && !/^(?:changeme|placeholder|your[-_]|xxx+|test|todo|none)$/i.test(v)) {
      found.add(key);
    }
  };

  for (const [k, v] of Object.entries(process.env)) {
    consider(k, v);
  }
  for (const file of ['.env', '.env.local', '.env.production']) {
    const p = path.join(CWD, file);
    if (!fs.existsSync(p)) {
      continue;
    }
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) {
        consider(m[1], m[2].replace(/^["']|["']$/g, ''));
      }
    }
  }
  return [...found].sort();
}

// ---------------------------------------------------------------------------
// Route discovery
// ---------------------------------------------------------------------------

function discoverRoutes() {
  const appDir = path.join(CWD, 'src', 'app');
  const pages = [];

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name === 'page.tsx') {
        pages.push(full);
      }
    }
  };
  walk(appDir);

  return pages
    .map((f) => {
      let r = path.relative(appDir, f).replace(/\\/g, '/').replace(/\/page\.tsx$/, '');
      r = r.split('/').filter(s => !(s.startsWith('(') && s.endsWith(')'))).join('/');
      return r.replace(/^\[locale\]\//, '');
    })
    .filter(r => r.startsWith('dashboard/') && !r.includes('['))
    .filter(r => (MATCH ? r.includes(MATCH) : true))
    .sort();
}

// ---------------------------------------------------------------------------
// Production build: freshness and lifecycle
// ---------------------------------------------------------------------------

const SOURCE_ROOTS = ['src', 'locales', 'public', 'next.config.ts'];

/**
 * Path + mtime + size for every source file the build depends on.
 *
 * A newest-mtime scan cannot see a deletion — remove a page and the newest file
 * is simply a different one, so a build that still contains the deleted route
 * looks fresh. That is how the audit ends up measuring a page that no longer
 * exists and reporting it as fine. Hashing the file *list* catches additions,
 * deletions and edits alike.
 */
function sourceManifest() {
  const lines = [];

  const visit = (target) => {
    if (!fs.existsSync(target)) {
      return;
    }
    const st = fs.statSync(target);
    if (!st.isDirectory()) {
      lines.push(`${path.relative(CWD, target).replace(/\\/g, '/')} ${Math.round(st.mtimeMs)} ${st.size}`);
      return;
    }
    for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next') {
        continue;
      }
      visit(path.join(target, entry.name));
    }
  };
  SOURCE_ROOTS.map(r => path.join(CWD, r)).forEach(visit);
  lines.sort();
  return crypto.createHash('sha256').update(lines.join('\n')).digest('hex');
}

function newestSourceMtime() {
  let newest = 0;
  const visit = (target) => {
    if (!fs.existsSync(target)) {
      return;
    }
    const st = fs.statSync(target);
    if (!st.isDirectory()) {
      newest = Math.max(newest, st.mtimeMs);
      return;
    }
    for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next') {
        continue;
      }
      visit(path.join(target, entry.name));
    }
  };
  SOURCE_ROOTS.map(r => path.join(CWD, r)).forEach(visit);
  return newest;
}

const MANIFEST_FILE = '.audit-source-manifest.json';

/** Whether the audit's own production build exists and matches the current sources. */
function buildState() {
  const distPath = path.join(CWD, AUDIT_DIST);
  const idFile = path.join(distPath, 'BUILD_ID');
  if (!fs.existsSync(idFile)) {
    return { exists: false, fresh: false };
  }

  const manifestFile = path.join(distPath, MANIFEST_FILE);
  if (!fs.existsSync(manifestFile)) {
    // Someone built this by hand rather than through the audit, so there is no
    // record of what went into it. Fall back to mtime, and let --allow-stale
    // cover the case where that is not good enough.
    const built = fs.statSync(idFile).mtimeMs;
    const src = newestSourceMtime();
    return { exists: true, fresh: src <= built, built, src, untracked: true };
  }

  const recorded = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  return { exists: true, fresh: recorded.manifest === sourceManifest(), recordedAt: recorded.builtAt };
}

/**
 * Build the audit bundle into AUDIT_DIST.
 *
 * It deliberately does not reuse `.next`. `next start` serves chunk filenames
 * out of the manifest it was built with, so anything that rewrites that
 * directory while the server runs — a rebuild, a dev server, another agent in
 * the same checkout — leaves the served HTML pointing at files that are gone.
 * The browser then reports a blank page full of 404s, which is a measurement
 * artefact wearing a defect's clothes. A private directory removes the class.
 */
function buildAuditBundle() {
  const nextBin = path.join(CWD, 'node_modules', 'next', 'dist', 'bin', 'next');
  console.log(`Building the audit bundle into ${AUDIT_DIST}/ (this takes a few minutes; the run reuses it until src/ changes)...\n`);
  const result = spawnSync(process.execPath, [nextBin, 'build'], {
    cwd: CWD,
    env: { ...process.env, NEXT_DIST_DIR: AUDIT_DIST },
    stdio: ['ignore', 'inherit', 'inherit'],
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`next build failed with exit code ${result.status}`);
  }
  // Fingerprint what went in, so the next run can tell whether the build still
  // matches src/ — including when a file was deleted.
  fs.writeFileSync(
    path.join(CWD, AUDIT_DIST, MANIFEST_FILE),
    JSON.stringify({ manifest: sourceManifest(), builtAt: new Date().toISOString() }),
  );
  console.log('');
}


const sleep = ms => new Promise(r => setTimeout(r, ms));

function portIsFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}

async function findFreePort(start) {
  // Port 0 means "any free port" to the OS, which would leave the caller with a
  // base URL pointing at :0 while the server listens somewhere else.
  for (let p = Math.max(1, start); p < start + 40; p += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (await portIsFree(p)) {
      return p;
    }
  }
  throw new Error(`no free port in ${start}..${start + 40}`);
}

async function waitForServer(base, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      // /api/health reports database reachability too, so a 200 here also means
      // the audit will not drown in connection errors.
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        return true;
      }
    } catch { /* not up yet */ }
    // eslint-disable-next-line no-await-in-loop
    await sleep(500);
  }
  return false;
}

/**
 * Start `next start` on a free port from the audit build.
 *
 * BETTER_AUTH_URL must match the origin the browser uses or better-auth rejects
 * the sign-in POST with INVALID_ORIGIN (trustedOrigins is tenant domains only),
 * which would look like every role failing to log in.
 */
async function startProductionServer() {
  const port = await findFreePort(SERVER_PORT);
  const base = `http://localhost:${port}`;
  const nextBin = path.join(CWD, 'node_modules', 'next', 'dist', 'bin', 'next');
  if (!fs.existsSync(nextBin)) {
    throw new Error(`next binary not found at ${nextBin}`);
  }

  const child = spawn(process.execPath, [nextBin, 'start', '-p', String(port)], {
    cwd: CWD,
    env: {
      ...process.env,
      NEXT_DIST_DIR: AUDIT_DIST,
      BETTER_AUTH_URL: base,
      NEXT_PUBLIC_APP_URL: base,
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let log = '';
  child.stdout.on('data', d => { log += d.toString(); });
  child.stderr.on('data', d => { log += d.toString(); });
  child.on('exit', (code) => { log += `\n[server exited with code ${code}]`; });

  const stop = () => {
    if (child.exitCode !== null || child.killed) {
      return;
    }
    if (process.platform === 'win32') {
      // `next start` is a launcher that spawns the real server as a child, so a
      // plain kill would orphan the listener and hold the port.
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  };
  process.once('exit', stop);

  if (!(await waitForServer(base, 60000))) {
    stop();
    throw new Error(`production server did not become healthy on ${base}\n${log.slice(-2000)}`);
  }
  return { base, port, stop, isAlive: () => child.exitCode === null && !child.killed };
}

// ---------------------------------------------------------------------------
// Response classification
// ---------------------------------------------------------------------------

const STATIC_NOISE = /favicon|\.map$|\/_next\/static\/chunks\/webpack/;
const COSMETIC_TYPE = new Set(['image', 'font', 'media']);

/**
 * Sort every >=400 response into four buckets.
 *
 * `handled` is the one that matters most: a <500 response whose body is JSON
 * saying success:false is the API answering "no" deliberately — no logo
 * configured, no such record, not permitted. Counting those as failures is what
 * made this script accuse /api/settings/logo of being broken. They are still
 * printed, so the excuse is auditable rather than assumed.
 *
 * `throttled` is the second: a 429 is the server complaining about how fast the
 * sweep is asking, not a defect in the page. A 298-route sweep blows through
 * better-auth's 100-requests-per-minute limiter on /api/auth/get-session and
 * flags everything after roughly the hundredth page. The response carries
 * x-retry-after, so the caller can wait exactly as long as the server asked and
 * measure the page properly instead of writing it off.
 */
async function classifyResponses(responses, base) {
  const handled = [];
  const failed = [];
  const cosmetic = [];
  const throttled = [];
  let retryAfterMs = 0;

  for (const res of responses) {
    const status = res.status();
    if (status < 400 || STATIC_NOISE.test(res.url())) {
      continue;
    }

    const type = res.request().resourceType();
    const label = `${status} ${res.request().method()} ${res.url().replace(base, '')}`;

    if (status === 429) {
      throttled.push(label);
      const hinted = Number(res.headers()['x-retry-after'] ?? res.headers()['retry-after'] ?? 0);
      retryAfterMs = Math.max(retryAfterMs, (Number.isFinite(hinted) && hinted > 0 ? hinted : 60) * 1000);
      continue;
    }

    let json = null;
    try {
      json = JSON.parse(await res.text());
    } catch { /* non-JSON body, or the response was aborted */ }

    if (status < 500 && json && json.success === false) {
      handled.push(label);
      continue;
    }
    // A missing avatar or font 404s with an HTML error page; it is untidy but it
    // does not break the screen. A missing script or stylesheet does.
    if (status < 500 && !json && COSMETIC_TYPE.has(type)) {
      cosmetic.push(label);
      continue;
    }
    failed.push(label);
  }

  return {
    handled: [...new Set(handled)],
    failed: [...new Set(failed)],
    cosmetic: [...new Set(cosmetic)],
    throttled: [...new Set(throttled)],
    retryAfterMs,
  };
}

// ---------------------------------------------------------------------------
// Page measurement
// ---------------------------------------------------------------------------

// Anything here means "the screen is doing something", which is not the same as
// "the screen is empty".
const LOADING_SELECTOR = [
  '[aria-busy="true"]',
  '[role="status"]',
  '[role="progressbar"]',
  '.animate-spin',
  '.animate-pulse',
  '[class*="skeleton" i]',
  '[class*="spinner" i]',
  '[class*="shimmer" i]',
  '[data-loading="true"]',
]
  // `:visible` only binds to the last entry of a selector list, so apply it to each.
  .map(s => `${s}:visible`)
  .join(', ');

const CRASH_TEXT = /Application error|Unhandled Runtime Error|something went wrong|une erreur est survenue|Internal Server Error/i;

/** Text with whitespace collapsed, or '' if it cannot be read. */
async function readText(scope) {
  return (await scope.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
}

/**
 * Wait until the page has stopped changing shape, then describe it.
 *
 * The floor wait preserves the original behaviour (client fetches fire after
 * hydration). The extra budget is only spent when the page still looks like it
 * is loading or has rendered nothing — which is exactly the state the old
 * text-length test misread as "broken".
 */
async function settle(page, scope) {
  await page.waitForTimeout(SETTLE_MS + DELAY);

  let text = await readText(scope);
  let loading = (await scope.locator(LOADING_SELECTOR).count().catch(() => 0)) > 0;

  if (loading || text.length < MIN_TEXT) {
    // Network idle is the cheap, reliable signal that the fetch behind a spinner
    // has resolved. Bounded, because a page holding an open stream never idles.
    await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => {});
  }

  const deadline = Date.now() + CONTENT_WAIT_MS;
  while ((loading || text.length < MIN_TEXT) && Date.now() < deadline) {
    await page.waitForTimeout(200);
    text = await readText(scope);
    loading = (await scope.locator(LOADING_SELECTOR).count().catch(() => 0)) > 0;
  }

  const nodes = await scope.locator('*').count().catch(() => 0);
  const dialog = await page.locator('[role="dialog"]:visible').count().catch(() => 0);
  return { text, loading, nodes, dialog: dialog > 0 };
}

/**
 * Load one route and describe it. Returns a result record; never throws.
 */
async function measureRoute(page, route, base, rec) {
  // Park on a blank page first. Navigating away from the previous route aborts
  // whatever it still had in flight — RSC prefetches for every nav link, plus
  // that page's own client fetches — and each abort lands in a `.catch` that
  // logs "Failed to fetch". Those console errors belong to the page being left,
  // not the one being measured, and reporting them against the next route is a
  // defect invented by the harness. This is where `dashboard-view.tsx`'s
  // "Failed to load events" was coming from.
  await page.goto('about:blank', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(200);

  rec.consoleErrors.length = 0;
  rec.responses.length = 0;

  const target = `/fr/${route}`;
  const resp = await page.goto(`${base}${target}`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT })
    .catch(e => ({ __err: e.message }));

  if (resp?.__err) {
    return { route, verdict: 'nav-error', detail: String(resp.__err).slice(0, 120) };
  }

  const status = resp?.status?.() ?? 0;

  const main = page.locator('main').first();
  const scope = (await main.count()) > 0 ? main : page.locator('body');
  const { text, loading, nodes, dialog } = await settle(page, scope);

  const finalPath = new URL(page.url()).pathname;
  const redirected = finalPath !== target;

  let verdict = 'ok';
  if (finalPath === '/fr' || finalPath === '/') {
    // The nav/page-guard mismatch signature: the user could see the link but not
    // follow it. Not a hard failure on its own — a role visiting a page it has
    // no capability for is *supposed* to be refused. Which is why the role that
    // owns the nav entry has to be the one audited.
    verdict = 'bounced-to-marketing';
  } else if (finalPath.includes('/login')) {
    verdict = 'bounced-to-login';
  } else if (redirected) {
    verdict = 'redirected';
  } else if (status >= 400) {
    verdict = 'http-error';
  } else if (CRASH_TEXT.test(text)) {
    verdict = 'crashed';
  }

  const { handled, failed, cosmetic, throttled, retryAfterMs } = await classifyResponses(rec.responses, base);
  if (verdict === 'ok' && failed.length > 0) {
    verdict = 'failed-requests';
  }

  // Empty means empty: no text, no loading affordance, no dialog, and a DOM too
  // small to be a page. A text-free spinner fails all four and is not reported.
  const blank = verdict === 'ok' && !loading && !dialog && nodes < MIN_NODES && text.length < MIN_TEXT;
  const stalled = verdict === 'ok' && loading && text.length < MIN_TEXT;

  const controls = verdict === 'ok' ? await scope.locator('button:not([disabled])').count() : 0;

  return {
    route,
    status,
    verdict,
    finalPath: redirected ? finalPath : undefined,
    controls,
    blank,
    stalled,
    textLength: text.length,
    nodes,
    handled,
    cosmetic,
    throttled,
    retryAfterMs,
    failedRequests: failed,
    consoleErrors: [...new Set(rec.consoleErrors)].slice(0, 4),
    // Kept for any consumer of the old JSON shape.
    emptyBody: blank,
  };
}

// ---------------------------------------------------------------------------
// Clicking
// ---------------------------------------------------------------------------

function labelOf(raw) {
  return String(raw ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Everything that could name a control.
 *
 * Reading innerText alone is a safety hole, not just a blind spot: a row's
 * `⋮` menu carries "Supprimer" in its `title`/`aria-label` and no text at all,
 * so it would read as unlabelled and get clicked. Every naming attribute is
 * folded together, and a control that still has no name is skipped — an audit
 * cannot reason about a control it cannot read, and the safe answer there is no.
 */
async function clickLabelOf(btn) {
  const parts = [];
  try {
    parts.push(await btn.innerText({ timeout: 1200 }));
  } catch { /* no text node */ }
  for (const attr of ['aria-label', 'title', 'name', 'value', 'data-testid']) {
    try {
      parts.push(await btn.getAttribute(attr, { timeout: 500 }));
    } catch { /* attribute absent */ }
  }
  return labelOf(parts.filter(Boolean).join(' '));
}

async function clickThrough(page, scope, target, base, entry, rec) {
  const dead = [];
  const buttons = scope.locator('button:not([disabled])');
  const total = Math.min(await buttons.count(), MAX_CLICKS);

  for (let i = 0; i < total; i += 1) {
    const btn = buttons.nth(i);
    const label = await clickLabelOf(btn);
    if (!label || DESTRUCTIVE.some(word => fold(label).includes(word))) {
      continue;
    }

    const urlBefore = page.url();
    const htmlBefore = await scope.innerHTML().catch(() => '');
    const responsesBefore = rec.responses.length;
    const downloadsBefore = rec.downloads;

    try {
      await btn.click({ timeout: 2000 });
    } catch {
      continue;
    }
    await page.waitForTimeout(450);

    const navigated = page.url() !== urlBefore;
    const htmlAfter = await scope.innerHTML().catch(() => '');
    const dialog = (await page.locator('[role="dialog"]').count()) > 0;
    // A control that fired a request, or started a download, did something. This
    // is the difference between a genuinely dead button and a working one whose
    // result looks identical: "Actualiser" re-fetches the same rows and repaints
    // the same HTML, and "Exporter Excel" leaves the DOM untouched on purpose.
    // Both were reported dead before this check existed.
    const acted = rec.responses.length > responsesBefore || rec.downloads > downloadsBefore;

    if (!navigated && htmlBefore === htmlAfter && !dialog && !acted) {
      dead.push(label.slice(0, 50) || `#${i}`);
    }

    if (navigated) {
      await page.goto(`${base}${target}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(1200);
    } else if (dialog) {
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(250);
    }
  }

  entry.deadControls = dead;
  const { failed } = await classifyResponses(rec.responses, base);
  entry.failedRequests = [...new Set([...entry.failedRequests, ...failed])].slice(0, 8);
}

// ---------------------------------------------------------------------------
// Per-role sweep
// ---------------------------------------------------------------------------

/**
 * Whether the production server the audit is measuring still has a build behind
 * it.
 *
 * This is not paranoia. A full sweep once reported 216 of 298 pages as HTTP 500
 * because .next-audit/ was deleted while the run was in flight — every page was
 * fine, the server had simply lost its files. 216 fabricated defects is a worse
 * failure than any of the false alarms this rewrite set out to remove, so the
 * run now stops and calls itself invalid instead.
 */
function runIsIntact(spawned) {
  // Only the audit's own server can be invalidated this way; in dev mode the
  // server at AUDIT_BASE is somebody else's and we have no claim on its build.
  if (!spawned) {
    return null;
  }
  if (!spawned.isAlive()) {
    return 'the production server exited mid-run';
  }
  if (!fs.existsSync(path.join(CWD, AUDIT_DIST, 'BUILD_ID'))) {
    return `${AUDIT_DIST}/BUILD_ID disappeared mid-run`;
  }
  return null;
}

async function auditRole(browser, role, routes, base, devMode, spawned) {
  const email = ACCOUNTS[role];
  if (!email) {
    return { role, error: `no seeded account for role ${role}`, pages: [] };
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  const rec = { consoleErrors: [], responses: [], downloads: 0 };
  page.on('download', () => { rec.downloads += 1; });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') {
      return;
    }
    const t = msg.text();
    if (/favicon|React DevTools|Download the React/i.test(t)) {
      return;
    }
    rec.consoleErrors.push(t.slice(0, 200));
  });
  page.on('pageerror', e => rec.consoleErrors.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on('response', res => rec.responses.push(res));

  try {
    // Signing in is a precondition, not a measurement. If the login form does not
    // even render — a server that is down or mid-compile, a 500 on /login — that
    // is an invalid run, not a finding about any dashboard page. Crashing here
    // with a Playwright stack trace tells the reader nothing; say what happened.
    try {
      await page.goto(`${base}/fr/login`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
      await page.locator('input[type="email"]').fill(email, { timeout: 15000 });
      await page.locator('input[type="password"]').fill(PASSWORD, { timeout: 15000 });
      await page.locator('input[type="password"]').press('Enter');
      await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 30000 }).catch(() => {});
    } catch (error) {
      return {
        role,
        email,
        error: `could not sign in — ${base}/fr/login did not render a login form (${String(error.message).split('\n')[0].slice(0, 120)}). Is the server up?`,
        pages: [],
      };
    }

    if (page.url().includes('/login')) {
      const body = await page.locator('body').innerText().catch(() => '');
      return {
        role,
        email,
        error: `login rejected for ${email} — check AUDIT_PASSWORD and the seed`
          + (body ? ` (page says: ${body.replace(/\s+/g, ' ').slice(0, 120)})` : ''),
        pages: [],
      };
    }

    // Warm-up. On a dev server the first hit on a route pays for compilation and
    // may 500 while doing so; measuring that hit measures Turbopack, not the app.
    if (devMode) {
      for (const route of routes) {
        // eslint-disable-next-line no-await-in-loop
        await page.goto(`${base}/fr/${route}`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT }).catch(() => {});
      }
      await page.goto('about:blank', { waitUntil: 'domcontentloaded' }).catch(() => {});
    }

    const results = [];
    let pauses = 0;

    for (const route of routes) {
      // eslint-disable-next-line no-await-in-loop
      let entry = await measureRoute(page, route, base, rec);
      let recovered = null;

      // A 5xx or a crash on a dev server may still be compile lag. Retry once and
      // record the recovery, rather than reporting it as a broken page.
      const retryable = entry.verdict === 'http-error' || entry.verdict === 'crashed' || entry.verdict === 'nav-error';
      if (devMode && retryable) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(400);
        // eslint-disable-next-line no-await-in-loop
        const second = await measureRoute(page, route, base, rec);
        if (second.verdict === 'ok') {
          recovered = entry.verdict;
          entry = second;
        }
      }
      if (recovered) {
        entry.recoveredOnRetry = recovered;
      }

      // A 500 is only meaningful while the build is still there to serve. Check
      // on the first one rather than on every route.
      if (entry.verdict === 'http-error') {
        const broken = runIsIntact(spawned);
        if (broken) {
          return { role, error: `run invalidated — ${broken}. Discard this run.`, pages: results };
        }
      }

      // The sweep is the load that trips the limiter, so backing off is the
      // harness's own problem to solve. Wait exactly as long as the server asked,
      // then measure the page properly. Bounded, so a permanently-throttled
      // server cannot stall the run indefinitely.
      if (entry.throttled?.length > 0 && pauses < MAX_THROTTLE_PAUSES) {
        pauses += 1;
        const waitMs = Math.min(entry.retryAfterMs || 60000, MAX_THROTTLE_PAUSE_MS);
        console.log(`   … throttled (429), yielding ${Math.round(waitMs / 1000)}s then re-measuring ${route}`);
        // eslint-disable-next-line no-await-in-loop
        await sleep(waitMs);
        // eslint-disable-next-line no-await-in-loop
        const second = await measureRoute(page, route, base, rec);
        entry = second.throttled.length === 0
          ? { ...second, throttleRecovered: true }
          : second;
      }

      if (CLICK && entry.verdict === 'ok' && entry.controls > 0) {
        const main = page.locator('main').first();
        const scope = (await main.count()) > 0 ? main : page.locator('body');
        // eslint-disable-next-line no-await-in-loop
        await clickThrough(page, scope, `/fr/${route}`, base, entry, rec);
      }

      results.push(entry);
    }

    return { role, email, pages: results };
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const routes = discoverRoutes().slice(0, LIMIT);
const roles = ROLE === 'all' ? Object.keys(ACCOUNTS) : ROLE.split(',');

if (routes.length === 0) {
  console.error(`No routes matched${MATCH ? ` --match=${MATCH}` : ''}.`);
  process.exit(2);
}

if (CLICK) {
  const providers = configuredProviders();
  if (providers.length > 0 && !ALLOW_PROVIDERS) {
    console.error(
      `\nRefusing to click: message/payment provider credentials are configured (${providers.join(', ')}).`
      + `\n   This app can send SMS to guardians from an attendance screen, and an audit has to be`
      + `\n   safe to re-run against its own seed. Remove the credentials, or pass`
      + `\n   --allow-clicks-with-providers if you have confirmed nothing user-facing can send.\n`,
    );
    process.exit(2);
  }
  console.log(providers.length === 0
    ? 'Click safety: no SMS/email/payment provider credentials configured.\n'
    : `Click safety: OVERRIDDEN with providers present (${providers.join(', ')}).\n`);
}

const mode = SERVER_MODE;
if (mode !== 'prod' && mode !== 'dev') {
  console.error(`--server must be prod or dev (got "${SERVER_MODE}").`);
  process.exit(2);
}

if (mode === 'prod') {
  let state = buildState();
  const stale = state.exists && !state.fresh;

  if (stale && ALLOW_STALE) {
    const age = state.built
      ? `~${Math.round((state.src - state.built) / 60000)} minute(s) older than src/`
      : 'built from sources that have changed since';
    console.log(`⚠ ${AUDIT_DIST}/ is ${age}. Auditing it anyway (--allow-stale).\n`);
  } else if ((!state.exists || stale) && NO_BUILD) {
    console.error(
      `\n${AUDIT_DIST}/ is ${state.exists ? 'stale' : 'missing'} and --no-build was passed.`
      + `\n   Run \`node scripts/audit-ui-browser.mjs\` without it to build the audit bundle, or`
      + `\n   build it yourself with NEXT_DIST_DIR=${AUDIT_DIST} npx next build.\n`,
    );
    process.exit(2);
  } else if (!state.exists || stale) {
    try {
      buildAuditBundle();
    } catch (error) {
      console.error(`\n❌ ${error.message}\n   The audit needs a production build it can own; without one it cannot tell a`
        + `\n   real 500 from a compile in progress. Fix the build, or audit a running dev`
        + `\n   server with --server=dev (less trustworthy: routes are warmed but still compiled).\n`);
      process.exit(2);
    }
    state = buildState();
    if (!state.exists) {
      console.error(`\n❌ next build exited 0 but wrote no ${AUDIT_DIST}/BUILD_ID.\n`);
      process.exit(2);
    }
  }
}

const fingerprintBefore = dependencyFingerprint().slice(0, 12);

let spawned = null;
if (mode === 'prod') {
  try {
    spawned = await startProductionServer();
  } catch (error) {
    console.error(`\n❌ ${error?.message ?? error}`);
    process.exit(2);
  }
}
const BASE = spawned?.base ?? process.env.AUDIT_BASE ?? 'http://localhost:3111';
const devMode = mode !== 'prod';

console.log(`Auditing ${routes.length} route(s) as ${roles.length} role(s)${CLICK ? ' WITH clicks (non-destructive only)' : ' (load-only)'}`);
console.log(mode === 'prod'
  ? `Server: production build from ${AUDIT_DIST}/ via next start (${BASE})\n`
  : `Server: ${BASE}, dev-mode warm-up enabled — every route is compiled once and discarded before measurement\n`);

const browser = await chromium.launch();
const report = [];
let exitCode = 0;
// Counted across roles so the closing line cannot claim more coverage than the
// run actually achieved.
let unmeasuredThrottled = 0;

try {
  for (const role of roles) {
    const started = Date.now();
    // eslint-disable-next-line no-await-in-loop
    const result = await auditRole(browser, role, routes, BASE, devMode, spawned);
    report.push(result);

    if (result.error) {
      console.error(`\n### ${role}: ${result.error}`);
      exitCode = 2;
      continue;
    }

    const by = v => result.pages.filter(p => p.verdict === v);
    const hard = result.pages.filter(p => ['nav-error', 'http-error', 'crashed', 'failed-requests'].includes(p.verdict));
    const withErrors = result.pages.filter(p => p.consoleErrors?.length);
    const blank = result.pages.filter(p => p.blank);
    const stalled = result.pages.filter(p => p.stalled);
    const handled = result.pages.filter(p => p.handled?.length);
    const cosmetic = result.pages.filter(p => p.cosmetic?.length);
    const recovered = result.pages.filter(p => p.recoveredOnRetry);
    const throttled = result.pages.filter(p => p.throttled?.length);
    const throttleRecovered = result.pages.filter(p => p.throttleRecovered);
    const dead = result.pages.filter(p => p.deadControls?.length);

    console.log(`\n### ${role} (${result.email}) — ${Math.round((Date.now() - started) / 1000)}s`);
    console.log(`  reachable: ${by('ok').length}/${result.pages.length}`);
    console.log(`  bounced to marketing: ${by('bounced-to-marketing').length}  to login: ${by('bounced-to-login').length}  other redirect: ${by('redirected').length}`);
    console.log(`  crashed: ${by('crashed').length}  http-error: ${by('http-error').length}  failed-requests: ${by('failed-requests').length}  nav-error: ${by('nav-error').length}`);
    console.log(`  blank (no text, no loading state, no DOM): ${blank.length}  stalled on a spinner: ${stalled.length}`);
    console.log(`  handled 4xx ({"success":false}): ${handled.length}  cosmetic asset 404s: ${cosmetic.length}`);
    if (recovered.length > 0) {
      console.log(`  recovered on a second pass (compile lag, not a defect): ${recovered.length}`);
    }
    if (throttled.length > 0 || throttleRecovered.length > 0) {
      console.log(`  rate-limited by the sweep's own request rate (429): ${throttled.length} unmeasured, ${throttleRecovered.length} re-measured clean after yielding`);
    }
    if (CLICK) {
      console.log(`  pages with dead controls: ${dead.length}`);
    }

    for (const p of by('crashed')) {
      console.log(`   CRASH  ${p.route}`);
    }
    for (const p of hard.filter(p => p.verdict === 'http-error')) {
      console.log(`   ERROR  ${p.route} :: HTTP ${p.status}`);
    }
    for (const p of by('nav-error')) {
      console.log(`   NAV    ${p.route} :: ${p.detail}`);
    }
    for (const p of by('failed-requests').slice(0, 15)) {
      console.log(`   FAIL   ${p.route} :: ${p.failedRequests.join(' ; ')}`);
    }
    for (const p of blank.slice(0, 10)) {
      console.log(`   BLANK  ${p.route} :: ${p.nodes} node(s), ${p.textLength} char(s), no loading state`);
    }
    if (stalled.length > 0) {
      console.log(`   STALL  ${stalled.map(p => p.route).join(', ')}`);
    }
    for (const p of dead.slice(0, 10)) {
      console.log(`   DEAD   ${p.route} :: ${p.deadControls.join(' | ')}`);
    }
    // Printed, not swallowed: an excuse nobody can see is indistinguishable from
    // a bug nobody found.
    if (handled.length > 0) {
      console.log(`   HANDLED 4xx (deliberate "no" from the API):`);
      for (const p of handled.slice(0, 6)) {
        console.log(`     ${p.route} :: ${p.handled.join(' ; ')}`);
      }
      if (handled.length > 6) {
        console.log(`     … and ${handled.length - 6} more page(s)`);
      }
    }
    // A throttled page is not a broken page, but it is not a verified page
    // either, and saying nothing would quietly overstate the coverage.
    if (throttled.length > 0) {
      console.log(`   THROTTLED 429 — not measured, the sweep's own request rate tripped the limiter:`);
      for (const p of throttled.slice(0, 10)) {
        console.log(`     ${p.route} :: ${p.throttled.join(' ; ')}`);
      }
      if (throttled.length > 10) {
        console.log(`     … and ${throttled.length - 10} more`);
      }
      console.log(`     Re-run them with --match=<subtree> (add --delay=<ms> to pace the sweep).`);
    }

    for (const p of withErrors.slice(0, 5)) {
      console.log(`   CONSOLE ${p.route} :: ${p.consoleErrors[0]}`);
    }

    unmeasuredThrottled += throttled.length;

    if (hard.length > 0 || blank.length > 0 || dead.length > 0) {
      exitCode = 1;
    }
  }
} catch (error) {
  // Anything reaching here is the harness failing, not a page failing. Exit 2 so
  // a caller can never mistake a broken run for a clean one.
  console.error(`\n❌ The audit could not complete: ${error?.message ?? error}`);
  exitCode = 2;
} finally {
  await browser.close();
  spawned?.stop();
}

const fingerprintAfter = dependencyFingerprint().slice(0, 12);
const treeChanged = fingerprintBefore !== fingerprintAfter;

if (OUT) {
  fs.writeFileSync(OUT, JSON.stringify({
    base: BASE,
    mode,
    click: CLICK,
    routes: routes.length,
    dependencyTreeChanged: treeChanged,
    report,
  }, null, 2));
  console.log(`\nFull report written to ${OUT}`);
}

if (treeChanged) {
  console.error(
    '\n❌ A dependency manifest changed while the audit was running.'
    + '\n   That rewrites the module graph under the browser and invalidates the whole run.'
    + `\n   Re-run once the tree is settled. (Output above and in ${OUT || 'the report'} is not trustworthy.)`,
  );
  exitCode = 2;
}

if (exitCode === 0) {
  if (unmeasuredThrottled > 0) {
    console.log(
      `\n⚠ Nothing broken in what was measured — but ${unmeasuredThrottled} page(s) went unmeasured`
      + `\n  because the sweep tripped a rate limiter. Re-run those with --match=<subtree> before`
      + `\n  treating this as full coverage.`,
    );
  } else {
    console.log('\n✅ Audit clean: no crashed, failing, blank or dead-control page.');
  }
} else if (exitCode === 1) {
  console.error('\n❌ Audit found real problems (listed above).');
}
process.exit(exitCode);
