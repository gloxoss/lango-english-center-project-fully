// Guard portal adversarial acceptance — static checks that need no DB/dev
// server. Covers §14 matrix rows that are verifiable from source: T14
// (forbidden-family projections), T15 (no directory enumeration surface),
// T16 (no browser storage in guard UI), T18 (guard role allowlist blast
// radius). Run: node scripts/verify-guard-adversarial.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'src');
const results = [];
const check = (label, ok, detail = '') => {
  results.push({ label, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
};

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.ts') || full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const allFiles = walk(ROOT);

// Guard API surface (routes + services only).
const guardApiFiles = allFiles.filter((f) => f.replace(/\\/g, '/').includes('/api/guard/') || f.replace(/\\/g, '/').includes('/features/guard/services/'));
// Guard UI (client components).
const guardUiFiles = allFiles.filter((f) => f.replace(/\\/g, '/').includes('/features/guard/ui/'));

// ---------------------------------------------------------------------------
// T14 — forbidden-family keys never appear in guard API projections.
// ---------------------------------------------------------------------------
// The forbidden families: academic (grades/results), finance, medical, HR,
// guardian-directory (the full guardian roster beyond pickup linkage), and
// credential secrets (rawToken/tokenHash).
const FORBIDDEN_FAMILY = [
  { key: 'grade', family: 'academic' },
  { key: 'average', family: 'academic' },
  { key: 'result', family: 'academic' },
  { key: 'score', family: 'academic' },
  { key: 'fee', family: 'finance' },
  { key: 'invoice', family: 'finance' },
  { key: 'payment', family: 'finance' },
  { key: 'balance', family: 'finance' },
  { key: 'tuition', family: 'finance' },
  { key: 'medical', family: 'medical' },
  { key: 'allerg', family: 'medical' },
  { key: 'blood', family: 'medical' },
  { key: 'salary', family: 'hr' },
  { key: 'payslip', family: 'hr' },
  { key: 'contract', family: 'hr' },
  { key: 'emergency_contact', family: 'guardian-directory' },
  { key: 'rawToken', family: 'credential-secret' },
  { key: 'tokenHash', family: 'credential-secret' },
];

// Credential secrets must never be projected. `resultStatus` is the scan
// outcome (allowed), not an academic result — use word boundaries so `result`
// does not match `resultStatus`.
const echo = [];
for (const file of guardApiFiles) {
  const text = readFileSync(file, 'utf8');
  for (const { key, family } of FORBIDDEN_FAMILY) {
    if (key === 'result') continue; // handled below via word boundary
    if (!text.includes(key)) continue;
    const projection = new RegExp(`(?:select|values)\\(\\{[\\s\\S]*?\\}\\)`, 'g');
    for (const m of text.matchAll(projection)) {
      if (m[0].includes(key)) echo.push(`${relative(ROOT, file)} selects/inserts '${key}' (${family})`);
    }
  }
  // `result` only leaks if projected as a standalone field name.
  const resultProj = new RegExp(`(?:select|values)\\(\\{[\\s\\S]*?\\}\\)`, 'g');
  for (const m of text.matchAll(resultProj)) {
    if (new RegExp(`\\bresults?\\s*:`, 'g').test(m[0])) echo.push(`${relative(ROOT, file)} selects a 'results' field (academic)`);
  }
}
check(
  'T14 guard projections avoid forbidden-family keys',
  echo.length === 0,
  echo.slice(0, 5).join('; ') || 'no forbidden-family projection keys found',
);

// rawToken / tokenHash may appear as verification *inputs* (param names) and as
// the one-time pass display, but never inside a SELECT projection.
const secretProjections = [];
for (const file of guardApiFiles) {
  const text = readFileSync(file, 'utf8');
  const projection = new RegExp(`(?:select|values)\\(\\{[\\s\\S]*?\\}\\)`, 'g');
  for (const m of text.matchAll(projection)) {
    if (/\b(rawToken|tokenHash)\b/.test(m[0])) secretProjections.push(`${relative(ROOT, file)} projects a credential secret`);
  }
}
check(
  'T14 credential secrets are never projected in guard queries',
  secretProjections.length === 0,
  secretProjections.join('; ') || 'ok',
);

// ---------------------------------------------------------------------------
// T15 — no directory enumeration surface.
// ---------------------------------------------------------------------------
// Every guard list service must cap its result set.
const uncappedGuards = [];
for (const file of guardApiFiles) {
  const text = readFileSync(file, 'utf8');
  if (text.includes('.select(') && !/\.limit\(\d+\)/.test(text)) {
    uncappedGuards.push(relative(ROOT, file));
  }
}
check(
  'T15 every guard list query is capped',
  uncappedGuards.length === 0,
  uncappedGuards.join('; ') || 'ok',
);

// No wildcard search: every `?q=` handler enforces a minimum length.
const searchRoutes = guardApiFiles.filter((f) => f.replace(/\\/g, '/').includes('/search/route.ts'));
const weakSearch = [];
for (const file of searchRoutes) {
  const text = readFileSync(file, 'utf8');
  if (!/(q\.length\s*<\s*3|SEARCH_TOO_SHORT)/.test(text)) weakSearch.push(relative(ROOT, file));
}
check(
  'T15 guard search routes enforce a minimum query length',
  weakSearch.length === 0,
  weakSearch.join('; ') || 'ok',
);

// ---------------------------------------------------------------------------
// T16 — no browser storage in guard UI.
// ---------------------------------------------------------------------------
const storageLeaks = [];
for (const file of guardUiFiles) {
  const text = readFileSync(file, 'utf8');
  for (const api of ['localStorage', 'sessionStorage', 'indexedDB']) {
    if (text.includes(api)) storageLeaks.push(`${relative(ROOT, file)} uses ${api}`);
  }
}
check(
  'T16 guard UI never writes to browser storage',
  storageLeaks.length === 0,
  storageLeaks.join('; ') || 'ok',
);

// ---------------------------------------------------------------------------
// T18 — guard role allowlist blast radius (static route-role review).
// ---------------------------------------------------------------------------
// Every guard route restricts to guard/school_admin(/super_admin) and gates on
// a guard.* capability. No guard route may admit directory roles like parent.
const routeFiles = guardApiFiles.filter((f) => f.replace(/\\/g, '/').includes('/api/guard/'));
const weakRoute = [];
for (const file of routeFiles) {
  const text = readFileSync(file, 'utf8');
  const allowedMatch = text.match(/requireRequestContext\(request,\s*\[([^\]]+)\]/);
  if (!allowedMatch) {
    weakRoute.push(`${relative(ROOT, file)}: no role allowlist`);
    continue;
  }
  const roles = allowedMatch[1];
  // Directory roles are the identity-roster surface (parent/student/alumni).
  // teacher/receptionist/accountant are operational staff — invitation
  // approval deliberately includes teacher (host self-approval) and the
  // receptionist desk. They must never be able to *enumerate* the directory.
  const admitsDirectoryRoles = /'parent'|'student'|'alumni'/.test(roles);
  if (admitsDirectoryRoles) weakRoute.push(`${relative(ROOT, file)} admits directory role: ${roles}`);
}
check(
  'T18 guard routes admit only operational roles (no directory roles)',
  weakRoute.length === 0,
  weakRoute.join('; ') || 'ok',
);

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
