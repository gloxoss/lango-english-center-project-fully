# SchoolOS — Multi-Tenant Architecture & Security Model

## 1. Multi-Tenant Request Lifecycle & Authorization

Every API route handler under `src/app/api/**` must enforce authentication and tenant isolation at the entry point of the route handler:

```ts
const context = await requireRequestContext(request, ['school_admin', 'teacher']);
const tenantId = requireTenant(context);
```

### Core Security Primitives (`src/libs/api/context.ts`)

- **`requireRequestContext(request, allowedRoles?)`**: Validates the session token via Better Auth (`auth.api.getSession`), verifies the account status (`userStatus = 'active'`), asserts tenant status (`tenants.isActive = true`), and verifies caller role against `allowedRoles`.
- **`requireTenant(context)`**: Guarantees `context.tenantId` is non-null for tenant-scoped operations.
- **`requireSuperAdmin(context)`**: Carve-out for platform administration routes (`/api/super-admin/*`). `super_admin` accounts have `tenantId: null` by design and operate cross-tenant.

---

## 2. Query Scoping & Drizzle ORM Conventions

Multi-tenancy in SchoolOS is enforced via explicit application-level filtering on `tenant_id` in every SQL query, rather than Database Row-Level Security (RLS). This design ensures transparent Drizzle ORM query building and full compatibility with pooled PostgreSQL connections.

### Rules for Query Authors
1. **Always include `tenantId`**: Every `select`, `update`, and `delete` query against tenant-owned tables MUST filter by `eq(table.tenantId, tenantId)`.
2. **Use Zod `.strict()` validation**: All mutation request bodies must pass Zod `.strict()` validation (`src/libs/api/validation.ts`) to prevent mass-assignment vulnerabilities.
3. **Audit Logging**: Every mutation (create, update, delete) MUST call `recordAudit(context, action, entityType, entityId, metadata)` to write an immutable audit log.

---

## 3. Teacher Scoping Pattern

Teachers (`role = 'teacher'`) must only see data for class-sections they are explicitly assigned to teach.

### Implementation Helper (`src/libs/api/teacher-scope.ts`)

```ts
import { getTeacherClassSectionIds } from '@/libs/api/teacher-scope';

if (context.role === 'teacher') {
  const assignedIds = await getTeacherClassSectionIds(tenantId, context.userId);
  if (assignedIds.length === 0) {
    return NextResponse.json({ success: true, data: [], total: 0 });
  }
  conditions.push(inArray(table.classSectionId, assignedIds));
}
```

This helper aggregates assignments from both `classTeachers` and `subjectTeachers` join tables.

---

## 4. File-Storage Tenant Namespacing

File uploads (student photos, teacher photos, documents, homework submissions, exam media) are stored on local disk (backed by Docker named volume `schoolos_uploads:/app/uploads`).

### Storage Pattern (`src/libs/api/uploads.ts`)
- Target Path format: `/app/uploads/{tenantId}/{subfolder}/{filename}`
- Example: `/app/uploads/11111111-1111-1111-1111-111111111111/photos/student-xyz.jpg`
- **Security Rule**: File retrieval MUST check that the requested resource belongs to `context.tenantId` in the database *before* streaming disk bytes to the response.

---

## 5. Automated Verification & CI Controls

1. **`npm test -- security.test.ts`**: Verifies anonymous rejection (401), invalid role rejection (403), disabled account rejection, and cross-tenant isolation.
2. **`npm test -- tenant-isolation.test.ts`**: Programmatically iterates over all non-super-admin API routes to verify zero cross-tenant data leaks.
3. **`npm run check:isolation`** (`scripts/check-tenant-isolation.ts`): Static analysis script run in `npm run lint` that scans Drizzle queries across `src/app/api` to catch omitted `tenantId` filters at build time.

### ⚠️ Known open gap: account lockout is half-built

`user.failedLoginCount` and `user.lockedUntil` columns exist, and
`POST /api/users/unlock` lets an admin manually clear them — but **nothing
increments `failedLoginCount` or sets `lockedUntil` on an actual failed
login attempt**. Grepped `src/libs/auth.ts` and the whole `src/app/api/auth`
tree: zero hits, no Better Auth hook wired to the sign-in-failure path.
First flagged in `V2-INDEPENDENT-AUDIT.md`, re-confirmed still open
2026-07-31. Fix: wire a Better Auth `databaseHooks`/callback on failed
credential sign-in (or a small middleware check before Better Auth handles
the request) that increments the counter and sets `lockedUntil` past a
threshold, mirroring the existing manual-unlock logic in reverse.

---

## 6. Attendance Module Patterns (added 2026-07-31)

Two conventions established while building the attendance register
lifecycle and flag case-management — follow these for any similar
lock/escalation workflow elsewhere in the app:

### Lock + mandatory-reason reopen
A resource (register) starts unlocked, gets locked on submission, and can
only be corrected via an explicit reopen step that requires a stated
reason, followed by a resubmit that requires its own correction note. See
`src/libs/api/attendance-registers.ts` (`resolveRegisterForSubmission`) —
the pattern is generic enough to reuse for any other "submit and lock"
workflow (e.g. finalized grades, payroll runs) rather than reinventing it.

### Severity + assignment on detected issues
Auto-detected problems (`attendanceFlags`) carry a `severity` set at
detection time (not computed on read) and an `assignedToId` for case
ownership, plus a lightweight notes table
(`attendanceFlagNotes`: id/tenantId/flagId/authorId/body/createdAt) for
free-text follow-up. This is a reusable shape for any other
system-detected-issue queue (e.g. finance arrears, low-stock alerts) —
don't build a bespoke detail page pattern from scratch each time.
