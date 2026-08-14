# UltraPlan Research — Advanced Reporting Addon Remediation

## Research Topics
1. Rate limiting pattern (reuse for report execution)
2. File upload/storage pattern (reuse for durable export storage)
3. Real SHA-256 checksum pattern (reuse for export artifacts)
4. Background job / scheduled task precedent (needed for the scheduler worker)
5. Zod `.strict()` + `parseJson` validation pattern (reuse for route rewrites)
6. `recordAudit` pattern (reuse for audit logging)
7. Domain-scoped permission pattern (needed for accountant Fees/Financial-only access)
8. Addon entitlement gating pattern (reuse — already followed correctly by existing routes)
9. Real XLSX generation library
10. Real PDF generation library
11. Cron expression parsing library
12. In-process scheduled task pattern for Next.js 15

## Research Method Note

Of the 3 planned parallel research subagents, only the **Codebase Researcher** completed — the Web Researcher and Docs Researcher (Context7) subagents both failed with an account-level monthly spend limit error, not a content/quality problem. Retrying would hit the same limit. Topics 9-12 below are therefore filled from built-in knowledge rather than live web/docs verification. This is a reasonable substitution: `exceljs`, `pdfkit`, and `cron-parser` are all long-established, API-stable packages (all pre-date 2020, all still actively maintained), not fast-moving or novel technology where current-web verification would meaningfully change the guidance. Flagging this transparently per this session's standing discipline of never silently asserting unverified claims.

## Tech Stack Analysis

No new frontend/backend framework needed — this is a remediation within the existing Next.js 15 / TypeScript / Drizzle / PostgreSQL stack. New dependencies needed: `exceljs` (real XLSX), `pdfkit` (real PDF), `cron-parser` (real cron parsing). All three are pure Node.js libraries with no native bindings, safe for this project's Alpine-based Docker image (confirmed no native-binding libraries are already excluded elsewhere in this project's Dockerfile).

## Findings by Topic

### 1. Rate limiting pattern
**Source:** [Codebase]

`src/libs/api/rate-limit.ts:15`:
```ts
export function checkRateLimit(key: string, limit: number = 30, windowMs: number = 60 * 1000): void
```
In-memory sliding-window counter. Synchronous, throws `ApiError(429, 'RATE_LIMIT_EXCEEDED', ...)` — not async, just call it before the protected logic; the route's existing `try { ... } catch (error) { return apiErrorResponse(error) }` wrapper handles the throw automatically.

Real call site — `src/app/api/public/alumni-documents/verify/route.ts:23-26`:
```ts
const clientIp = request.headers.get('x-forwarded-for') || '127.0.0.1';
checkRateLimit(`public-doc-verify:${clientIp}`, 10, 60 * 60 * 1000);
```

**For this remediation:** use `checkRateLimit(\`report-run:${tenantId}:${context.userId}\`, <N>, <windowMs>)` in the report-run route. Since this codebase's existing rate limiter has no cross-instance/restart persistence (an accepted, documented limitation elsewhere in this app), match that same accepted tradeoff here rather than building something more robust.

### 2. File upload/storage pattern (for durable export storage)
**Source:** [Codebase]

`src/libs/api/uploads.ts` (71 lines): `UPLOADS_ROOT = process.env.UPLOADS_DIR || '/app/uploads'`, a Docker named volume, tenant-namespaced (`{UPLOADS_ROOT}/{tenantId}/{subpath}`).

- `saveUploadedFile(tenantId, subpath, file: File, allowedTypes, maxBytes)` — validates a real uploaded `File`/`Blob` (MIME + magic bytes). **Not directly reusable for server-generated buffers** — every existing call site passes a real multipart-form `File`, and the function's validation logic (magic-byte sniffing for PNG/JPEG/PDF) doesn't apply to a CSV/XLSX/PDF buffer the server itself produces.
- `readUploadedFile(tenantId, subpath): Promise<Buffer>` — has a path-traversal guard (`fullPath.startsWith(...)` check), fully reusable as-is for the export download route.
- `contentTypeFor(ext)` only knows `png`/`pdf`/else-`jpeg` — **does not know `csv`/`xlsx`**, needs its own content-type mapping for exports (not a change to the shared helper, just a local map in the reporting code, matching this codebase's "small, local, not overengineered" convention).

**Conclusion:** there is no existing example anywhere in this codebase of the app generating and storing a server-produced file (as opposed to a user upload). This is new usage: write a small `saveGeneratedFile(tenantId, subpath, buffer)` in the reporting addon's own service layer that does the same `mkdir(recursive:true) + writeFile` under `path.join(UPLOADS_ROOT, tenantId, subpath)`, and reuse `readUploadedFile`'s traversal-guarded read path for downloads.

### 3. Real SHA-256 checksum pattern
**Source:** [Codebase]

`src/addons/advanced-reporting/services/snapshot-service.ts` already does this correctly for JSON snapshots:
```ts
const checksumSha256 = crypto.createHash('sha256').update(jsonStr).digest('hex');
```
For a binary export artifact, hash the `Buffer` directly instead of a JSON string: `crypto.createHash('sha256').update(fileBuffer).digest('hex')`. Same `node:crypto`, no new dependency.

### 4. Background job / scheduled task precedent
**Source:** [Codebase]

**Confirmed: zero precedent exists anywhere in this codebase for a real server-process recurring job.**
- No `instrumentation.ts` exists in the project (only third-party `node_modules` files with that name — OpenTelemetry/Sentry internals).
- No cron library installed (`grep` for `cron`/`node-cron`/`bull`/`bullmq`/`agenda` in `package.json` — no matches).
- The only `setInterval` usages found (4 files) are all **client-side React polling** inside `useEffect` (e.g. `src/addons/advanced-reporting/ui/my-runs-view.tsx:30` polling run status every 5s from the browser) — not server background jobs.

This must be built fresh. Confirmed via discovery: the chosen approach is an in-process interval check, which is the right fit for this app's single-container Docker Compose deployment (no separate worker service, no serverless).

### 5. Zod `.strict()` + `parseJson` pattern
**Source:** [Codebase]

`src/libs/api/validation.ts:4`:
```ts
export async function parseJson<T extends z.ZodType>(request: Request, schema: T): Promise<z.output<T>>
```
Throws `ApiError(400,'INVALID_JSON',...)` on malformed body, `ApiError(422,'VALIDATION_ERROR', <first 3 issues>)` on schema failure. Every schema in the codebase uses `.strict()`.

Canonical route order (e.g. `src/app/api/academics/question-bank/route.ts:94`):
```ts
const context = await requireRequestContext(request, ['school_admin', 'teacher']);
const tenantId = requireTenant(context);
await requireCapability(context, 'grading.manage');
const body = await parseJson(request, createBankItemSchema);
```

### 6. `recordAudit` pattern
**Source:** [Codebase]

`src/libs/api/audit.ts:21`:
```ts
export function recordAudit(
  context: RequestContext,
  action: AuditAction,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>,
): void
```
Doc comment: **"Fire-and-forget: a logging failure must never fail the request it is recording."** Internally does `db.insert(...).catch(err => console.error(...))`. The dominant, correct convention across real call sites (`src/app/api/users/route.ts`, `src/app/api/teachers/route.ts`, `src/app/api/academics/question-bank/route.ts`, etc.) is to call it **without `await`**. (Two outlier call sites incorrectly await a void-returning function — harmless but not the pattern to copy.)

### 7. Domain-scoped permission pattern (for accountant Fees/Financial-only access)
**Source:** [Codebase]

`src/libs/api/permissions.ts` (253 lines) has only a **flat, binary** capability model (`PERMISSIONS`, `DEFAULT_ROLE_PERMISSIONS`, `requireCapability`) — no concept anywhere of "permission X scoped to domain Y." `reports.read`/`reports.export`/`reports.manage`/`reports.schedule` already exist as flat permissions (lines 80-83); accountant already holds `reports.read`/`reports.export` (lines 114-122) but not scoped by domain.

**No reusable global primitive exists to copy.** The closest existing precedent for ad-hoc, in-route domain scoping is inline role-branching, e.g. `src/app/api/students/route.ts:175-178`:
```ts
if (context.role === 'accountant') {
  const { attendance: _attendance, ...billingSafeDetail } = detail;
  return NextResponse.json({ success: true, data: billingSafeDetail });
}
```
and `src/app/api/finance/payments/route.ts:64` (role + field-conditional branching).

**Directly usable existing data:** the reporting addon's own catalog already carries exactly the fields needed for this — `sensitivityLevel: 'standard'|'restricted'|'confidential'` and `domain: string` (e.g. `'Fees'`, `'Financial'`, `'HR'`) on every `report_definitions` row (`reporting-schema.ts:26`, populated per-entry in `catalog-definitions.ts`). There's also an unused `requiredPermissions: text[]` column on the same table (`reporting-schema.ts:32`).

**Conclusion (matches discovery decision to keep things simple/matching-existing-patterns):** keep `requireCapability(context, 'reports.read'/'reports.export')` as the binary gate (existing, correct), then add one small new inline check local to the reporting routes/service — e.g. a `canAccessReport(context, reportDefinition)` helper in the addon's own service layer — using the already-present `sensitivityLevel`/`domain` fields. This is new logic, but small, local to the addon, and reuses existing schema rather than inventing new permission infrastructure.

### 8. Addon entitlement gating pattern
**Source:** [Codebase]

`src/libs/api/entitlements.ts` (68 lines) is the addon-level gate (separate from role/capability):
```ts
export async function requireAddon(tenantId: string, addonId: string): Promise<void>  // line 58
```
Throws `ApiError(403,'ADDON_NOT_ACTIVATED', ...)`. Doc comment: "Call right after `requireTenant()`."

Every one of the 12 existing reporting routes already follows the correct 3-step sequence:
```ts
const context = await requireRequestContext(request);
await requireAddon(context.tenantId!, 'advanced-reporting');
requireCapability(context, 'reports.read'); // <-- BUG: missing await here, addon-wide (see audit findings)
```
**This confirms the audit finding precisely**: the entitlement gate itself (`requireAddon`) is correctly awaited everywhere; only the subsequent `requireCapability` call is missing `await` addon-wide. The fix is narrowly scoped to adding `await` to the second call, not restructuring the gating sequence.

### 9. Real XLSX generation — `exceljs`
**Source:** [Built-in knowledge — web/docs research unavailable this session, see Research Method Note above]

`exceljs` is the standard, actively-maintained choice for generating real `.xlsx` files in Node.js (alternative to the unmaintained-for-writing `xlsx`/SheetJS free tier, which has known ReDoS CVEs in older versions and weaker write-side support). No native bindings, pure JS, works in this project's Alpine Docker image without issue.

**Formula-injection risk — yes, it exists and needs the same defense already built for CSV**: any cell value starting with `=`, `+`, `-`, or `@` will be interpreted as a formula by Excel/LibreOffice when the file is opened, same class of vulnerability as CSV formula injection. `exceljs` does not sanitize this automatically — the existing `CsvExporter.sanitizeValue` escaping logic (prefixing `'` to any value starting with those 4 characters) should be reused/shared for XLSX cell values too, not re-implemented separately.

Minimal example — build a workbook with header + data rows + a totals row, return as a `Buffer` (not written to disk, since this needs to flow into an HTTP response / the addon's own file-storage helper):
```ts
import ExcelJS from 'exceljs';

async function generateXlsx(columns: string[], rows: Record<string, unknown>[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Report');
  sheet.addRow(columns).font = { bold: true };
  for (const row of rows) {
    sheet.addRow(columns.map(c => sanitizeCellValue(row[c])));
  }
  // optional totals row for numeric columns
  const totalsRow = sheet.addRow(columns.map((c, i) => (i === 0 ? 'Total' : sumIfNumeric(rows, c))));
  totalsRow.font = { bold: true };
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
```

### 10. Real PDF generation — `pdfkit`
**Source:** [Built-in knowledge — web/docs research unavailable this session]

For a small Docker container without headless-browser support, `pdfkit` is the right choice over `@react-pdf/renderer` (heavier, React-tree-based, more setup for a simple tabular report) or `pdf-lib` (lower-level, better for editing existing PDFs than composing a new document from scratch) or Puppeteer (requires a Chromium install, too heavy for this deployment per the discovery decision to avoid new infrastructure). `pdfkit` streams directly to a buffer/writable and has simple, direct text/table-position APIs well-suited to "title + timestamp + data table."

Minimal example — produce a Buffer (not a file):
```ts
import PDFDocument from 'pdfkit';

function generatePdf(title: string, generatedAt: Date, columns: string[], rows: Record<string, unknown>[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text(title, { align: 'center' });
    doc.fontSize(10).text(`Généré le ${generatedAt.toLocaleString('fr-FR')}`, { align: 'center' });
    doc.moveDown();

    const colWidth = (doc.page.width - 80) / columns.length;
    let y = doc.y;
    columns.forEach((col, i) => doc.fontSize(9).text(col, 40 + i * colWidth, y, { width: colWidth, bold: true }));
    y += 15;
    for (const row of rows) {
      columns.forEach((col, i) => doc.fontSize(8).text(String(row[col] ?? ''), 40 + i * colWidth, y, { width: colWidth }));
      y += 12;
      if (y > doc.page.height - 60) { doc.addPage(); y = 40; }
    }
    doc.end();
  });
}
```
Note: pdfkit's text-positioning API doesn't have `bold` as a `.text()` option directly — real implementation should call `.font('Helvetica-Bold')` before header row text and `.font('Helvetica')` before body rows; the snippet above is illustrative of structure, exact API calls should be double-checked against the installed version's TypeScript types during implementation (execution-time task, not blocking the plan).

### 11. Cron expression parsing — `cron-parser`
**Source:** [Built-in knowledge — web/docs research unavailable this session]

`cron-parser` is the small, well-established (pre-dates 2015, still maintained) library for this. Minimal example:
```ts
import { CronExpressionParser } from 'cron-parser';
// Note: package API has shifted between major versions (older: `parseExpression` top-level export,
// newer: `CronExpressionParser.parse`) - confirm against the actually-installed version's types
// during implementation rather than assuming either form blind.

const interval = CronExpressionParser.parse('0 8 * * MON', { tz: 'Africa/Casablanca' });
const next: Date = interval.next().toDate();
```
Throws on an invalid cron string — wrap in try/catch and surface as a real validation error (matches discovery decision: no silent fallback on failure).

### 12. In-process scheduled task pattern for Next.js 15
**Source:** [Built-in knowledge — web/docs research unavailable this session, cross-checked against Codebase Researcher's confirmation that no `instrumentation.ts` exists yet in this project]

Next.js 15's documented mechanism for running one-time server startup code is `instrumentation.ts`'s exported `register()` function, called once when the Node.js server process starts (not per-request, not per-hot-reload-in-a-meaningful-duplicating-way in production since `output: 'standalone'` runs a single persistent process — this project's Dockerfile already uses `.next/standalone` per the `runner` stage seen in this session's earlier Docker work).

```ts
// instrumentation.ts (project root, next to next.config.ts)
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startReportScheduleWorker } = await import('@/addons/advanced-reporting/services/schedule-worker');
    startReportScheduleWorker();
  }
}
```
```ts
// schedule-worker.ts
let started = false;
export function startReportScheduleWorker() {
  if (started) return; // guards against duplicate intervals if register() somehow re-fires
  started = true;
  setInterval(async () => {
    try {
      await runDueSchedules();
    } catch (err) {
      console.error('[report-scheduler]', err);
    }
  }, 5 * 60 * 1000); // every 5 minutes
}
```
The `NEXT_RUNTIME === 'nodejs'` guard prevents this from also trying to run in the Edge runtime (irrelevant here since this app doesn't use Edge routes, but it's the documented safe-guard and costs nothing to include). `instrumentation.ts` needs `experimental.instrumentationHook` enabled in `next.config.ts` for Next.js versions before it became default-on; must verify against the exact Next.js 15 minor version already in use in this project during implementation (this project is confirmed on Next.js 15 per every other section of this codebase).

## Conflicts Detected

**None.** No research finding contradicts any discovery answer. The one genuine correction (no existing scheduler pattern) was already surfaced and resolved mid-discovery, not held back for this phase.

## User Review

- Status: Approved
- Additional research requested: None
- Concerns raised: None
