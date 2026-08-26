# SchoolOS — App Context & UI System (shared reference)

> Read this before writing or executing ANY future-implementation plan. It exists so every plan gives the executing agent the same ground truth instead of re-deriving it, and so no plan invents new component styles, new route conventions, or a parallel architecture. Established and proven across the advanced-reporting, assessment-and-examination, and attachments-book builds this session — every rule below has real working code behind it, not aspiration.

## 1. Stack

Next.js 15/16 App Router, TypeScript, Drizzle ORM, PostgreSQL, Better Auth, Tailwind CSS, shadcn/ui-style primitives under `@/components/ui/`. Docker Compose: `db` (Postgres), `app` (Next standalone), `migrate` (one-shot), plus feature-added services when genuinely needed (e.g. `clamav` for attachments-book). No queue, no external services beyond Postgres unless a plan explicitly adds one and justifies it.

## 2. Backend route convention (every API route, no exceptions)

```ts
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']); // role allowlist, or omit for "any authenticated role"
    const tenantId = requireTenant(context);
    await requireCapability(context, 'module.action'); // when the action is capability-gated
    const body = await parseJson(request, someZodSchema.strict());

    // tenant-scoped Drizzle query/mutation here — every table with a tenantId column
    // is filtered by it; every foreign id referenced in the body is re-checked to
    // belong to the same tenant before use (see §5 below — this is the #1 bug class
    // found live in every remediation this session)

    recordAudit(context, 'create', 'entity_type', createdId, { metadata }); // fire-and-forget, NEVER awaited
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
```

- `requireRequestContext(request, [roles]?)` — `src/libs/api/context.ts`. Omitting the role array means ANY authenticated role can call it — use deliberately, not by accident.
- `requireTenant(context)` — throws `403 TENANT_REQUIRED` if no tenant (super_admin routes are the one deliberate exception).
- `requireCapability(context, key)` — `src/libs/api/permissions.ts`. Capability keys live in the `PERMISSIONS` const map (`'module.action': 'French label'`), dot-separated, lowercase. Add new keys there, then add them to the relevant role(s) in `DEFAULT_ROLE_PERMISSIONS` — `school_admin`/`super_admin` get everything automatically via `ALL_PERMISSIONS`, other roles need explicit entries.
- `parseJson(request, schema)` — `src/libs/api/validation.ts`, Zod `.strict()` always (rejects unknown fields).
- `ApiError(status, code, message)` — `src/libs/api/errors.ts`; `apiErrorResponse(error)` is the catch-all that also maps Postgres unique/FK violations (`23505`→409 `ALREADY_EXISTS`, `23503`→409 `IN_USE`) automatically.
- `recordAudit(context, action, entityType, entityId, metadata)` — `src/libs/api/audit.ts`. **`action` is a FIXED union**: `'create' | 'update' | 'delete' | 'login' | 'logout' | 'export' | 'import' | 'settings_change' | 'permission_change' | 'entitlement_change'`. There is no `'archive'` or `'publish'` — model those as `'update'` with a descriptive metadata field (e.g. `{ archived: true }`). Never `await` this call.
- Existence-hiding: when a caller shouldn't even learn a resource exists (wrong tenant, unpublished/private to them), return `404 NOT_FOUND`, not `403`.
- Multipart file uploads: parse via `request.formData()`, `formData.get('file') instanceof File` check — see `src/app/api/academics/homework/upload/route.ts` or any `attachments-book` route for the exact shape.

## 3. Schema convention

- New feature tables live in `src/features/<feature>/models/<feature>-schema.ts`, **not** appended to the 3900+-line `src/models/Schema.ts` directly.
- Wire it in with one barrel line in `Schema.ts`: `export * from '@/features/<feature>/models/<feature>-schema';`. `src/libs/DB.ts` needs no change — it imports `* as schema from '@/models/Schema'` and picks up new tables automatically.
- Table shape: `pgTable('snake_case_name', { id: uuid('id').defaultRandom().primaryKey().notNull(), tenantId: text('tenant_id').notNull(), ...columns, createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(), updatedAt: ... }, table => [index(...), unique(...)])`. No FK object required for `tenantId` at the feature-schema layer — tenant scoping is enforced at the query layer, matching the rest of the codebase.
- `pgEnum` vs plain `text()` for status/category fields: use `pgEnum` (defined locally in the feature file, e.g. `export const assetLifecycleStatus = pgEnum(...)`) for a **fixed business category** that drives real branching logic. Use plain `text()` with a comment listing valid values for something more provisional/display-only. Both patterns coexist in this codebase — pick per field, don't agonize.
- `user.id` is `text` (values like `STU-001`, `USR-001`), not `uuid`. Most feature-table PKs are `uuid`. `tenants.id` is `uuid`.

## 4. Migrations — DO NOT use `drizzle-kit generate`

**Known broken in this repo**: `npx drizzle-kit generate` diffs against a stale/desynced snapshot chain (`migrations/meta/_journal.json` is missing entries for several already-applied, hand-written migrations) and will produce a migration that tries to `CREATE TABLE`/`CREATE TYPE` for things that **already exist live** — a real incident this session, caught before it ran against the DB. Always hand-write migrations instead:

1. Find the highest existing `migrations/NNNN_*.sql` file, use `NNNN+1`.
2. Copy the exact SQL style of a recent sibling migration (`CREATE TABLE IF NOT EXISTS`, `DO $$ BEGIN CREATE TYPE ... EXCEPTION WHEN duplicate_object THEN null; END $$;` for enums to make it idempotent).
3. Append ONE new entry to `migrations/meta/_journal.json`'s `entries` array — `idx: <next int>`, `tag: "<the filename without .sql>"`, a `when` timestamp larger than the previous entry's. You do not need to backfill missing historical entries; this repo's journal is already sparse/non-contiguous and `drizzle-kit migrate` only processes what's listed, so a gap is harmless — don't "fix" old gaps as a side effect of a new migration.
4. Verify with a real `docker compose build migrate && docker compose up migrate`, captured real exit code — never trust it without running it.

## 5. Tenant isolation — the single most common real bug this session

Every remediation and every new build this session has found at least one live cross-tenant bug during final verification, always the same shape: a route validates the PRIMARY resource's tenant ownership but forgets to re-check a FOREIGN ID referenced in the request body (another table's id passed in as a parameter). Rule: **every id in a request body that references another table must be re-verified as `WHERE id = ? AND tenantId = ?` before use**, not just the URL-path resource. Run `npx tsx scripts/check-tenant-isolation.ts` before calling any route work done — it does a static check; it currently flags exactly 3 pre-existing, unrelated files (`academics/promotions`, `settings/migration/tasks/[id]`, `settings/migration/template`) as a known baseline. Any NEW file it flags is a real bug to fix before considering the work done. Static analysis is not enough — always also do a live cross-tenant sweep: log in as two different tenants' admins and have one try every new route against the other's real IDs.

## 6. Storage / uploads

Two established patterns, pick based on need:
- **`src/libs/api/uploads.ts`** (`saveUploadedFile`/`readUploadedFile`/`copyUploadedFile`) — simple, purpose-specific, tenant-namespaced local-disk files with magic-byte validation (student/teacher photos, documents, logos). Use for single-purpose, non-versioned uploads.
- **`src/libs/api/blob-store.ts`** (`BlobStore` interface, `blobStore` singleton, `blobKeyFor(tenantId, entityId, versionId, sha256)` content-addressed immutable keys, `quarantineKeyFor`) — built for attachments-book, use when you need versioning, immutability, or a future swap to real object storage. Both write under the same `UPLOADS_ROOT` Docker volume (`schoolos_uploads`), different subtrees, no collision.
- If a feature needs malware scanning (any user-uploaded file another user downloads), reuse `src/libs/api/malware-scan.ts` (`scanBuffer`) — it's already wired to a real `clamav` Docker Compose service. Don't re-derive this; just add the same `depends_on: clamav: condition: service_healthy` to any new service that needs it.

## 7. Docker discipline

- `app` and `migrate` are separate images with independent build caches — rebuild both explicitly after schema changes, don't assume one rebuild covers both.
- Build sequentially, not in parallel (`docker compose build migrate` then `docker compose build app`) — parallel builds have caused a real `ETXTBSY` race this session.
- **Never trust a piped/tailed exit code.** Always: `docker compose build app > /tmp/log.txt 2>&1; echo "EXIT_CODE:$?" >> /tmp/log.txt` and read the real code from the file.
- New service healthchecks that gate app startup: `depends_on: <service>: condition: service_healthy` on `app`, plus a real `healthcheck:` block with a generous `start_period` on the new service. Verify the gate actually held (check container start timestamps), don't just trust the YAML.
- If Docker Desktop's engine itself stops responding mid-session (has happened once, unrelated to any code change), restart it: `Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"` then poll `docker info` until it responds (~10-30s typical).
- Auth sessions are invalidated by container restarts. Re-login test accounts after every redeploy. Seed password for both demo tenants: `Admin123!` (`src/scripts/seed.ts`, `SCHOOL_ADMIN_SEED_PASSWORD` env override). Known seeded admins: `y.elamrani@atlas.ma` (Atlas tenant `c9177d8a-d1c8-491d-a56b-70f082865d79`), `admin@schoolos.ma` (SchoolOS tenant `17c1db51-4a33-4b90-9396-b4bae1f585f8`).
- No real student/employee login credentials exist for seeded test accounts, and better-auth signs its session cookie (a raw DB-inserted session-token row will NOT authenticate). To test a route as a specific student/staff member without their password, add a narrow `?asXId=`-style admin-preview override restricted to `school_admin`/`super_admin` (precedent: homework route's `?studentId=`, attachments-book's `?asStudentId=`) rather than fighting cookie signing.

## 8. Testing

No DB-backed vitest pattern exists or should be invented. Extract real business logic into small pure functions that the real service/route calls directly (not a parallel "test version" — e.g. `isAssetVisibleToUser`, `doTimeRangesOverlap`, `planSeatAllocations`), unit-test those with real vitest, and verify DB-dependent behavior live via `curl` + `psql` against the real running app instead of mocking `db`. Every test suite this session has proven its own regression-catching power by deliberately breaking the logic, confirming the expected tests fail, then reverting — do this for any security-relevant pure function.

## 9. UI / design system — do not invent new styling

Every dashboard page is `'use client'`, single-file (`page.tsx`), fetches its own data via `useEffect` + plain `fetch`, no separate `_components/` split unless the page is genuinely too large (matches the real, dominant pattern — e.g. `exam-master/page.tsx`, `content/library/page.tsx`, both 500+ line single files).

### Page shell (copy this structure)

```tsx
'use client';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// ...Input, Textarea, Select*, Dialog* from '@/components/ui/*' as needed
import { SomeIcon, Plus, Search } from 'lucide-react';

export default function SomePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => fetch('/api/module/items').then(r => r.json()).then(j => { if (j.success) setItems(j.data); });
  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <SomeIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Page Title</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">One-line French subtitle describing the page.</p>
          </div>
        </div>
        <Button className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs gap-1.5 px-4 cursor-pointer">
          <Plus className="w-4 h-4" /><span>Nouvelle Action</span>
        </Button>
      </div>

      {/* KPI banner: 3-4 stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Label</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{items.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2487B8] flex items-center justify-center shrink-0">
            <SomeIcon className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Main content card: search/filter bar + table or grid */}
      <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
        {/* ... */}
      </Card>
    </div>
  );
}
```

### Rules, not suggestions

- **Header icon gradient**: `from-[#2487B8] to-[#1B6C93]` is the dominant real pattern (5 uses vs. 2 for `#0066FF`→`#1B6C93`) — use `#2487B8`→`#1B6C93` unless matching an existing page that already uses the other one. `#16212B` is the standard heading/dark-text color. `slate-200`/`slate-400`/`slate-500` for borders/labels/secondary text.
- **Cards**: `rounded-2xl border border-slate-200/80 bg-white shadow-2xs`, content padding `p-5` or `p-6`.
- **Stat-card icon boxes**: `w-10 h-10 rounded-xl` with a pastel background + matching text color (`bg-blue-50 text-[#2487B8]`, `bg-emerald-50 text-emerald-600`, `bg-amber-50 text-amber-600`, `bg-purple-50 text-purple-600`, `bg-red-50 text-red-600` / `bg-rose-50 text-rose-600` for danger) — pick a distinct one per stat card, never reuse blue for everything.
- **Buttons**: primary action = `bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs gap-1.5 px-4 cursor-pointer`. Always add `cursor-pointer` explicitly (this app's buttons/interactive elements consistently do, even though native `<button>` styling wouldn't need it).
- **Badge** (`@/components/ui/badge.tsx`) — variant is **exactly** `'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'signal'`. There is no `default`, `destructive`, or `secondary` variant — that's a different, unrelated UI kit's naming and will fail `tsc`. Map: draft/inactive→`neutral`, in-progress/pending→`info`, success/published/active→`success`, needs-attention→`warning`, error/rejected/infected→`danger`.
- **Tables**: plain `<table className="w-full text-xs">`, header row `text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100`, body rows `border-b border-slate-50 hover:bg-slate-50/50`.
- **Forms/modals**: `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogFooter` from `@/components/ui/dialog` for create/edit — single flat form, not a multi-step wizard unless the underlying operation is genuinely multi-stage (e.g. true resumable upload). Field labels: `text-xs font-bold text-slate-700`.
- **Icons**: `lucide-react` only, sized `w-4 h-4` (inline/button) or `w-5 h-5`/`w-6 h-6` (header/stat).
- **French UI copy** — every user-facing label, button, error message in this app is French (matches every route's `ApiError` messages and every page's copy). Keep new features consistent.
- **Sidebar registration** — every reachable dashboard page must be added to `src/components/shared/sidebar.tsx`'s nav array: `{ label: 'Module Label', href: \`/${locale}/dashboard/module\`, icon: SomeLucideIcon, permission: 'module.read-or-relevant-key', subItems: [...] }`. Import the icon in the existing `from 'lucide-react'` block at the top of the file (alphabetical-ish, matches existing order). A page with no sidebar entry is unreachable to real users even if the route works.
- **Design mandate reminder** (CLAUDE.md): slate/blue palette, data-dense tables, top KPI card banners, quick inspector sidebars (a slide-out `Dialog` used as a detail panel, not a separate route) — no static/dummy placeholders, every list must be real `fetch()`-driven data.

## 10. Scope-sizing discipline for infra-heavy specs

Several future-implementation source docs (card management, certificates, attendance-qr) propose real infrastructure (WYSIWYG PDF designers, scanner device pairing, badge credential systems). Match infra ambition to what this deployment actually runs (3-container Compose, no queue, no object storage yet — attachments-book's ClamAV addition is the only precedent for adding a new service, and it was judged non-negotiable specifically because it's a security control, not a convenience). When a source spec's "Suggested implementation order" front-loads a big infra spike (e.g. "spike pdfme inside Next.js" before any schema work), that's usually right — validate the risky technical unknown first, in isolation, before building the full data model and CRUD around it. Defer phases explicitly (with reasoning written down, not silently dropped) rather than building everything a spec describes in one pass — this was the right call for attachments-book (deferred resumable uploads, S3, Tika, ops dashboard) and the same judgment applies here.

## 11. Known shared foundations relevant to multiple upcoming plans

- **Card & Admit Card Management** and **Certificate Management** both explicitly want to share one `pdfme`-based document-template/generation engine (their own docs call this out — "neutral internal library", "document-studio package shared with Card Management"). Do not build two separate PDF designers. Whichever is built first should extract the shared engine as its own internal module from day one, not bolt sharing on after the second addon duplicates it.
- **Attendance QR Enhancement**'s badge-credential system (`identityBadgeCredentials`, QR verification) and Card Management's `issuedDocuments`/QR verification token model cover *related but distinct* concerns (a scan-to-mark-attendance credential vs. a printed/verifiable identity document) — read both plans before assuming one subsumes the other; they're deliberately kept as separate entities per both source specs.
- **Exam admit cards** (Card Management) need a real exam-event/candidate/seat model that doesn't fully exist yet — but `examTerms`/`examHalls`/`examSchedules`/`examSeats` (built this session, `src/features/assessment/models/assessment-schema.ts`, via `ExamMasterService`) already cover most of the same ground (hall/seat allocation, scheduling with conflict detection). A Card Management plan should reuse these tables/services rather than inventing parallel `examEvents`/`examEventSubjects`/`examCandidates` tables — confirm the real column shapes before designing the admit-card data model.
