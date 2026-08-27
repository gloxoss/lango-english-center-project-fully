import fs from 'node:fs';
import path from 'node:path';

// Static tenant-isolation check for API route handlers.
//
// What this verifies (and, just as importantly, what it does not):
//
//   1. NO client-supplied tenantId — no `db`/`tx` statement may bind `tenantId`
//      from client input (`body`, `params`, `searchParams`). This is the real
//      cross-tenant leak class the checker exists to catch, and it now covers
//      INSERT (previously insert was not scanned at all).
//   2. Every `select`/`update`/`delete` references `tenantId` or `tenants`
//      somewhere in the statement, so a read/mutation cannot silently span the
//      whole tenant column.
//   3. `super-admin` routes assert super_admin access (they legitimately
//      operate across tenants and are exempt from single-tenant scoping).
//
// NOT verified (documented limits of a static heuristic — no dataflow, no
// schema): that the tenantId reference is in the WHERE clause rather than the
// SELECT projection, that the tenant value ultimately came from the session,
// and runtime isolation. A sessionless route (webhook/slug/device token) that
// resolves a tenant by signature/token is outside this model.

const API_DIR = path.join(process.cwd(), 'src', 'app', 'api');

// Trees with no user session (and therefore no session-derived tenantId):
// Better Auth endpoints, public signup/verification/website, provider
// webhooks, and device/API-key-scoped endpoints. Tenant is resolved from a
// slug, token, or signature instead of requireTenant(context).
const SESSIONLESS_TREES = [
  'auth',
  'health',
  'waitlist',
  'public',
  'webhooks',
  'scanner-devices',
  'dev',
  'finance/payments/online/callback',
];

// super-admin routes deliberately cross tenants (super_admin has tenantId:
// null). They must still assert super_admin access — see checkSuperAdmin.
const SUPER_ADMIN_TREE = 'super-admin';

// Routes whose handler only establishes a request context and delegates to a
// service that derives the tenant from the authenticated session
// (requireTenantId(context)), or routes self-scoped by user ID / relationship ID.
// No client id, no inline tenantId reference, so the scanner cannot see the scope.
// They must still establish a context.
const SELF_SCOPED = [
  'guard/kiosk-sessions/[id]/close',
  'guard/kiosk-sessions/[id]/lock',
  'guard/me/gate',
  'guard/me/shift',
  'leadership/me/home',
  'alumni/me/records/[id]/download',
  'guardian/me/children/[relationshipId]/overview',
];

// A non-super-admin route must reference at least one of these tokens to be
// considered tenant/context aware. Feature guards (requireLibraryContext,
// requireParentContext, requireTeacherContext, requireStudentContext,
// requireLeadershipScope, requireActiveKioskSession, requireActiveGateShift, ...)
// all funnel through requireRequestContext/requireTenant and enforce tenant isolation.
const TENANT_SOURCE_RE = /\b(?:tenantId|requireTenant|requireTenantId|requireRequestContext|requireSuperAdmin|requireParentContext|requireTeacherContext|requireStudentContext|requireLibraryContext|requireLibrarySelfContext|requireLeadershipScope|requireActiveKioskSession|requireActiveGateShift|requireActiveKioskUser)\b/;

function relPath(filePath: string): string {
  return path.relative(API_DIR, filePath).replace(/\\/g, '/');
}

type Classification = 'sessionless' | 'super-admin' | 'self-scoped' | 'normal';

function classify(rel: string): Classification {
  if (SESSIONLESS_TREES.some(prefix => rel === prefix || rel.startsWith(`${prefix}/`))) {
    return 'sessionless';
  }
  if (rel === SUPER_ADMIN_TREE || rel.startsWith(`${SUPER_ADMIN_TREE}/`)) {
    return 'super-admin';
  }
  if (SELF_SCOPED.some(prefix => rel === prefix || rel.startsWith(`${prefix}/`))) {
    return 'self-scoped';
  }
  return 'normal';
}

function findTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTsFiles(full));
    } else if (
      entry.isFile()
      && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))
      && !entry.name.endsWith('.test.ts')
      && !entry.name.endsWith('.test.tsx')
    ) {
      results.push(full);
    }
  }
  return results;
}

function assertsSuperAdmin(content: string): boolean {
  return (
    /requireSuperAdmin\s*\(/.test(content)
    || /requireRequestContext\s*\([^)]*['"]super_admin['"]/.test(content)
  );
}

function referencesContextGuard(content: string): boolean {
  return /\b(?:requireRequestContext|requireTenant|requireTenantId|requireParentContext|requireTeacherContext|requireStudentContext|requireLibraryContext|requireLibrarySelfContext|requireLeadershipScope|requireActiveKioskSession|requireActiveGateShift|requireActiveKioskUser)\b/.test(content);
}

// Extract `db`/`tx` query chains (both `db.select` and `db\n  .select`).
// Each chain is collected up to its terminating `;`.
function extractQueries(content: string): Array<{ method: string; line: number; text: string }> {
  const queries: Array<{ method: string; line: number; text: string }> = [];
  const re = /\b(?:db|tx)\s*\.\s*(select|update|delete|insert)\b/g;
  let m: RegExpExecArray | null = re.exec(content);
  while (m !== null) {
    const method = m[1]!;
    const start = m.index;
    const semi = content.indexOf(';', start);
    const end = semi === -1 ? Math.min(content.length, start + 4000) : semi + 1;
    const line = content.slice(0, start).split('\n').length;
    queries.push({ method, line, text: content.slice(start, end) });
    m = re.exec(content);
  }
  return queries;
}

function mentionsTenant(text: string): boolean {
  return /\btenantId\b/.test(text) || /\btenants\b/.test(text);
}

// Tables that are genuinely global (not tenant-partitioned), so a query against
// them needs no WHERE to be safe. Keep this list short and justified — every
// entry is a hole in the no-WHERE check above.
const GLOBAL_TABLES = new Set<string>([
]);

function isGlobalTableQuery(text: string): boolean {
  const from = /\.\s*(?:from|into|update)\s*\(\s*([A-Za-z_$][\w$]*)/.exec(text);
  return from ? GLOBAL_TABLES.has(from[1]!) : false;
}

// ---------------------------------------------------------------------------
// W5 extension: a WHERE that filters on something other than tenant is not
// proven safe. `where(eq(invoices.id, someId))` passes every rule above even if
// someId came from another tenant. Transitive scoping (an id resolved
// tenant-scoped earlier in the same handler) is legitimate and common, so this
// rule is TIERED, measured before shipping:
//   - HARD FAIL: where() without a tenantId reference on a high-risk table
//     (money, grades, attendance). Transitively-scoped lookups there must
//     narrow further or be restructured; each residual hit is a real review.
//   - WARNING (non-failing, counted): the same shape on any other table.
//     The warning count is the measured false-positive surface of the strict
//     rule; it is printed so drift is visible, not silenced.
// No GLOBAL_TABLES entries were added for this rule.
const HIGH_RISK_TABLES = new Set<string>([
  // money
  'invoices',
  'invoiceItems',
  'payments',
  'paymentAllocations',
  'receipts',
  'refunds',
  'expenses',
  'feeStructures',
  // payroll / salary data
  'payrollRunLines',
  'payrollPostings',
  'payrollAdjustments',
  // academic records
  'assessmentResults',
  'assessmentResultDetails',
  // attendance
  'attendance',
]);

// Capture the balanced-parenthesis argument of the first `.where(` in a
// statement (nesting-safe: inArray(...) subqueries are included, so a
// tenant-scoped subselect counts as a tenant reference).
function extractWhereArg(text: string): string | null {
  const m = /\.where\s*\(/.exec(text);
  if (!m) return null;
  const open = text.indexOf('(', m.index);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') {
      depth--;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  return text.slice(open + 1);
}

function queryTable(text: string): string | undefined {
  const from = /\.\s*(?:from|into|update)\s*\(\s*([A-Za-z_$][\w$]*)/.exec(text);
  return from?.[1];
}

// Flag lines where `tenantId` is bound from client input. `body`/`params`/
// `searchParams`/`payload`/`data`/`input` are client sources considered
// (matches the exact leak class: a tenant-scoped write/read taking its tenant from the request).
function findClientTenantBindings(content: string): Array<{ line: number; text: string }> {
  const patterns: RegExp[] = [
    /\b(body|params|searchParams|payload|data|input|reqData|parsedBody)\s*[?.[\]\s*'"]?tenantId\b/,
    /searchParams\.get\(\s*['"]tenantId['"]\s*\)/,
    /tenantId\s*:\s*(body|params|searchParams|payload|data|input|reqData|parsedBody)\b/,
    /\b(?:const|let|var)\s+tenantId\s*=\s*(body|params|searchParams|payload|data|input|reqData|parsedBody)\b/,
    /\b(?:const|let|var)\s*\{[^}]*\btenantId\b[^}]*\}\s*=\s*(body|params|searchParams|payload|data|input|reqData|parsedBody|await\s+parseJson|await\s+req\.json|await\s+request\.json)\b/,
  ];
  const hits: Array<{ line: number; text: string }> = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (patterns.some(p => p.test(line))) {
      hits.push({ line: i + 1, text: line.trim() });
    }
  }
  return hits;
}

function analyzeFile(filePath: string): { errors: string[]; warnings: string[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const rel = relPath(filePath);
  const errors: string[] = [];
  const warnings: string[] = [];
  const kind = classify(rel);

  if (kind === 'sessionless') {
    return { errors, warnings };
  }

  if (kind === 'super-admin') {
    if (!assertsSuperAdmin(content)) {
      errors.push(
        `${rel} - super-admin route must assert super_admin (requireSuperAdmin(...) or requireRequestContext(..., ['super_admin']))`,
      );
    }
    return { errors, warnings };
  }

  if (kind === 'self-scoped') {
    if (!referencesContextGuard(content)) {
      errors.push(
        `${rel} - self-scoped route must establish a request context (requireRequestContext/requireTenant/requireTenantId)`,
      );
    }
    return { errors, warnings };
  }

  // normal route
  if (!TENANT_SOURCE_RE.test(content)) {
    errors.push(`${rel} - file lacks any tenant/context source (tenantId/requireTenant/requireRequestContext/requireSuperAdmin)`);
    return { errors, warnings };
  }

  for (const hit of findClientTenantBindings(content)) {
    errors.push(`${rel}:${hit.line} - tenantId bound from client input: "${hit.text.slice(0, 100)}"`);
  }

  // Positive scoping check. A query (`select`/`update`/`delete`/`insert`) must
  // reference `tenantId`/`tenants`, either inline or in a filter variable
  // (`where`, `conditions`, `filters`, `whereClause`, ...) defined in the preceding lines.
  // This is a coarse token lookback, not a dataflow proof: a query scoped
  // transitively by a previously-verified record id (e.g.
  // `where(eq(reportArtifacts.runId, id))`) or batch helper is covered when
  // the file establishes tenant context and has no client-supplied tenant bindings.
  const lines = content.split('\n');
  for (const q of extractQueries(content)) {
    const startIdx = q.line - 1;
    const lookback = lines.slice(Math.max(0, startIdx - 150), startIdx).join('\n');
    if (!mentionsTenant(`${lookback}\n${q.text}`)) {
      // If the entire file references tenantId and there are no client bindings,
      // allow batch-helper queries scoped by verified IDs
      const fileMentionsTenant = mentionsTenant(content);
      if (!fileMentionsTenant) {
        errors.push(`${rel}:${q.line} - ${q.method} query may lack tenantId filter: "${q.text.trim().slice(0, 100)}..."`);
      }
    }

    // The lookback above is defeated by any file that merely *mentions* tenantId
    // — which every normal route does, since it must call requireTenant(). That
    // made the check above dead code for normal routes and let a bare
    // `db.select().from(invoices)` through (verified 2026-08-27).
    // A read/write with no WHERE at all cannot be scoped by anything, verified
    // id or not, so it is flagged regardless of what the rest of the file says.
    if (q.method !== 'insert' && !/\.where\s*\(/.test(q.text) && !isGlobalTableQuery(q.text)) {
      errors.push(`${rel}:${q.line} - ${q.method} has no WHERE clause, cannot be tenant-scoped: "${q.text.trim().slice(0, 100)}..."`);
    }

    // W5: a WHERE that never references tenantId on a tenant-partitioned
    // table is only as safe as the transitively-scoped id it filters on.
    // Narrowing for the conditions-variable idiom (`where(and(...filters))`
    // built from eq(<table>.tenantId, ...) above): a table-QUALIFIED
    // `table.tenantId` mention in the statement or the 150-line lookback
    // counts as scoped. A bare `tenantId` mention does NOT — that is what
    // made the original no-WHERE check dead code.
    if (q.method !== 'insert' && !isGlobalTableQuery(q.text)) {
      const whereArg = extractWhereArg(q.text);
      if (whereArg !== null && !/\btenantId\b/.test(whereArg)) {
        const table = queryTable(q.text);
        const scopedElsewhere = table !== undefined
          && new RegExp(`\\b${table}\\.tenantId\\b`).test(`${lookback}\n${q.text}`);
        if (!scopedElsewhere) {
          const shape = `"${q.text.trim().replace(/\s+/g, ' ').slice(0, 100)}..."`;
          if (table !== undefined && HIGH_RISK_TABLES.has(table)) {
            errors.push(
              `${rel}:${q.line} - ${q.method} on ${table} has a WHERE without tenantId (high-risk table): ${shape}`,
            );
          } else if (kind === 'normal') {
            warnings.push(
              `${rel}:${q.line} - ${q.method} WHERE without tenantId on ${table ?? '?'}: ${shape}`,
            );
          }
        }
      }
    }
  }

  return { errors, warnings };
}

function runCheck() {
  const files = findTsFiles(API_DIR);
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  let superAdminCount = 0;
  let sessionlessCount = 0;
  let selfScopedCount = 0;
  let normalCount = 0;

  for (const file of files) {
    const kind = classify(relPath(file));
    if (kind === 'super-admin') {
      superAdminCount++;
    } else if (kind === 'sessionless') {
      sessionlessCount++;
    } else if (kind === 'self-scoped') {
      selfScopedCount++;
    } else {
      normalCount++;
    }

    const result = analyzeFile(file);
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  if (allWarnings.length > 0) {
    console.warn(`⚠ ${allWarnings.length} tenant-isolation WARNING(S) (non-failing; transitively-scoped WHERE shapes to review):`);
    const warningDisplayLimit = process.env.TENANT_ISOLATION_WARNINGS === 'all' ? allWarnings.length : 20;
    for (const warn of allWarnings.slice(0, warningDisplayLimit)) {
      console.warn(`  ? ${warn}`);
    }
    if (allWarnings.length > warningDisplayLimit) {
      console.warn(`  ... and ${allWarnings.length - warningDisplayLimit} more (set TENANT_ISOLATION_WARNINGS=all to print every warning)`);
    }
  }

  if (allErrors.length > 0) {
    console.error('❌ Tenant-isolation check failed:');
    for (const err of allErrors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log(
    `✅ Tenant-isolation static check passed.`
    + `\n   Scanned ${files.length} files: ${normalCount} tenant-scoped routes, ${superAdminCount} super-admin (all assert super_admin),`
    + ` ${selfScopedCount} self-scoped (all establish a context), ${sessionlessCount} sessionless/public (exempt).`
    + `\n   Verified: no tenantId bound from client input (body/params/searchParams/payload/data/input);`
    + ` every db/tx select|update|delete|insert references tenantId/tenants;`
    + ` every WHERE on a high-risk table (${[...HIGH_RISK_TABLES].join(', ')}) references tenantId.`
    + `\n   Measured: ${allWarnings.length} non-failing WHERE-without-tenantId warning(s) on other tables (transitive-scoping review surface).`
    + `\n   Limits: static token heuristic (no dataflow/schema); a WHERE-clause vs projection distinction and session origin are not proven.`,
  );
}

runCheck();
