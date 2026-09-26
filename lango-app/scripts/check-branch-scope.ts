import fs from 'node:fs';
import path from 'node:path';

// BRANCH-SCOPE-01 B3-02 — branch-scope ratchet: no route left behind.
//
// Fails when any of these hold:
//   1. A route exists on the filesystem that is not in the registry
//      (src/libs/api/branch-scope-registry.ts).
//   2. An `own`/`student`/`employee` route (including the services it
//      imports, same one-level closure as check-tenant-isolation.ts) uses
//      neither branchWhere nor assertBranchScope/assertWritableBranch and is
//      not listed in scripts/branch-scope-baseline.json.
//   3. More routes carry mode 'review' (or the review flag) than the
//      baseline's reviewCount — the unresolved set may only shrink.
//
// The baseline may only SHRINK: entries are removed as waves W1-W6 scope
// routes, never added. Same style as check-tenant-isolation.ts.

const API_DIR = path.join(process.cwd(), 'src', 'app', 'api');
const REGISTRY_PATH = path.join(process.cwd(), 'src', 'libs', 'api', 'branch-scope-registry.ts');
const BASELINE_PATH = path.join(process.cwd(), 'scripts', 'branch-scope-baseline.json');

// branchWhere/assertBranchScope/assertWritableBranch are the sanctioned
// vocabulary (BRANCH-SCOPE-01 B1-03). assertStudentBranchScope (portal-scope,
// the wave workhorse for student-detail routes) and assertStudentAccess
// (libs/api/student-access.ts, pre-existing campus-locking domain helper)
// count as branch asserts too.
const HELPER_RE = /\b(?:branchWhere|assertBranchScope|assertWritableBranch|assertStudentAccess|assertStudentBranchScope)\b/;

type Baseline = { pendingRoutes: string[]; reviewCount: number };

const read = (f: string): string => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
const resolveImp = (spec: string): string | null => {
  if (!spec.startsWith('@/')) return null;
  const b = `src/${spec.slice(2)}`;
  for (const x of [`${b}.ts`, `${b}/index.ts`, `${b}.tsx`]) if (fs.existsSync(x)) return x;
  return null;
};

function findRouteFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findRouteFiles(full));
    else if (entry.isFile() && entry.name === 'route.ts') results.push(full);
  }
  return results;
}

// Pull `'<route>': { mode: '...' }` shapes out of the registry source. The
// registry is a literal object; this keeps the check independent of ts
// loading.
function parseRegistry(): Map<string, { mode: string; review: boolean }> {
  const src = fs.readFileSync(REGISTRY_PATH, 'utf8');
  const map = new Map<string, { mode: string; review: boolean }>();
  const re = /'(\/api\/[^']+)':\s*\{\s*mode:\s*'([a-z]+)'([^}]*)\}/g;
  let m: RegExpExecArray | null = re.exec(src);
  while (m !== null) {
    map.set(m[1]!, { mode: m[2]!, review: /review:\s*true/.test(m[3] ?? '') });
    m = re.exec(src);
  }
  return map;
}

function main(): void {
  const baseline: Baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  const registry = parseRegistry();

  const files = findRouteFiles(API_DIR);
  const errors: string[] = [];
  const warnings: string[] = [];

  const scopedMissingHelper: string[] = [];
  let reviewCount = 0;

  for (const f of files) {
    const route = `/${path.relative('src/app', path.dirname(f)).split(path.sep).join('/')}`;
    const entry = registry.get(route);
    if (!entry) {
      errors.push(`${route} — not in the branch-scope registry (add it in src/libs/api/branch-scope-registry.ts)`);
      continue;
    }
    if (entry.mode === 'review' || entry.review) reviewCount++;

    if (entry.mode === 'own' || entry.mode === 'student' || entry.mode === 'employee') {
      const src = fs.readFileSync(f, 'utf8');
      const imps = [...src.matchAll(/from '(@\/(?:features|libs\/services|addons)[^']+)'/g)]
        .map(m => resolveImp(m[1]!))
        .filter(Boolean) as string[];
      const all = src + imps.map(p => read(p)).join('\n');
      if (!HELPER_RE.test(all) && !baseline.pendingRoutes.includes(route)) {
        scopedMissingHelper.push(route);
      }
    }
  }

  // Stale registry entries: visible, non-blocking (a route may have been
  // deleted; the wave that owns the module cleans its entries).
  for (const route of registry.keys()) {
    if (!fs.existsSync(path.join('src', 'app', route.replace(/^\//, ''), 'route.ts'))) {
      warnings.push(`${route} — in the registry but not on the filesystem`);
    }
  }

  if (reviewCount > baseline.reviewCount) {
    errors.push(
      `review routes grew: ${reviewCount} > baseline ${baseline.reviewCount}`
      + ' — resolve review entries, do not add new ones',
    );
  }

  for (const r of scopedMissingHelper) {
    errors.push(`${r} — scoped route (${registry.get(r)!.mode}) uses no branch helper (branchWhere/assertBranchScope/assertWritableBranch) and is not in the baseline`);
  }

  if (warnings.length > 0) {
    for (const w of warnings.slice(0, 20)) console.warn(`⚠ ${w}`);
    if (warnings.length > 20) console.warn(`⚠ ... and ${warnings.length - 20} more stale entries`);
  }

  if (errors.length > 0) {
    console.error(`❌ Branch-scope check failed (${errors.length}):`);
    for (const e of errors.slice(0, 30)) console.error(`  - ${e}`);
    if (errors.length > 30) console.error(`  ... and ${errors.length - 30} more`);
    process.exit(1);
  }

  console.log(
    `✅ Branch-scope ratchet passed.`
    + `\n   ${files.length} routes: registry covers all; `
    + `${reviewCount} review entries (baseline ${baseline.reviewCount}, may only shrink); `
    + `${baseline.pendingRoutes.length} scoped routes still pending in the baseline (may only shrink).`,
  );
}

main();
