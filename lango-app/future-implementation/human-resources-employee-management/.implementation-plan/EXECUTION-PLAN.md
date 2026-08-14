# Advanced HR & Employee Management — Verified Execution Plan

> Status: **PLANNED — no code changed yet.** This document was written after reading the four
> planning files in order and independently inspecting the live repository (schema, API routes,
> feature folders, migrations, and the running PostgreSQL database). Every assumption in
> `PLAN.md` was validated or corrected below. The first deliverable of this workstream is this
> plan; implementation begins only after it is internally consistent and accounts for the current
> dirty worktree.
>
> Verification date: **2026-08-08**. Highest migration observed: **`0072_leave_request_cancelled_status`**
> (`migrations/meta/_journal.json` last `idx = 73`). The next migration to reserve is **`0073`** with
> journal `idx = 74`. This number was confirmed immediately before writing this document, per the
> "check the actual highest migration immediately before assigning a number" requirement.

---

## 1. Verified current-state inventory

Everything below was read from the repository or queried from the live database
(`postgresql://schoolos:...@localhost:5432/schoolos`, tenants: Lango `f62f31eb-1fc8-4102-9145-a5ce0bca989b`,
Atlas `ca40c88e-339c-4fea-b5c4-51d5c9cc0239`).

### 1.1 Staff identity (core, must remain core)

- `user` table (`src/models/Schema.ts:476`): staff are real tenant-scoped rows, not mocks.
  Roles (enum `role`, line 27): `super_admin, school_admin, teacher, accountant, student, alumni,
  parent, receptionist, guard`. `userStatus` enum: `active, inactive, archived` (line 28).
- Staff stopgap columns documented in `MIGRATION-NOTES.md`: `nationalId`, `qualification`, `salary`,
  `lastLogin`, `employeeId`, `specialization`, `workloadHours`, `hireDate`, `documents` (jsonb),
  `cycle`, `matricule` live on the shared `user` table with no FK model. They are explicitly noted
  as "belongs elsewhere long-term".
- `user.employee_id` has a **global** unique constraint `user_employee_id_unique` (Schema.ts:569) —
  this is the "global uniqueness mismatch" the plan must resolve in favour of tenant-scoped
  uniqueness on `employee_profiles`.
- `requireRequestContext` (`src/libs/api/context.ts:23`) rejects `userStatus != 'active'`, so
  deactivating a login already has a real security effect. `requireTenant` + `x-tenant-id` +
  `x-branch-id` headers provide the isolation backbone.
- Core account APIs: `src/app/api/users/route.ts` (GET/POST/PUT/DELETE, school_admin +
  `users.manage`). POST creates `user` rows with id `USR-${Date.now()}` and sets
  `qualification`/`salary` — **no invite/password-set journey** (confirms PLAN's "no onboarding
  journey" observation). Core roster UI: `/dashboard/settings/staff` and `/dashboard/settings/users`.

### 1.2 Existing HR / payroll / leave foundations (extend, never duplicate)

| Domain | Tables (Schema.ts) | API routes | Reuse target |
|---|---|---|---|
| Employee profiles | `employeeProfiles` (line 3568): `id`, `tenantId`, `userId` **NOT NULL** (unique per tenant), `cnssNumber`, `amoNumber`, `bankRib`, `contractType` ('cdi'/'cdd'/'vacation'), `dependantsCount`, timestamps | `GET/POST /api/hr/employee-profiles` (school_admin+accountant; `hr.read` / `hr.manage`; POST upserts by `(tenantId, userId)`) | Extend with nullable `userId`, branch, department, designation, manager, lifecycle, dates, workload, archive. |
| Payroll | `salaryComponents` (3593), `salaryTemplates` (3611), `salaryTemplateComponents` (3624), `employeeSalaryAssignments` (3641, userId-keyed), `payrollPeriods` (3668), `payrollRunLines` (3692, userId-keyed, period+user unique), `payslips` (3726, `pdfStorageKey` nullable — PDF gap flagged earlier) | `/api/hr/payroll/*`, `/api/hr/salary-assignments`, `/api/hr/salary-templates`, `/api/hr/payslips` — gated `hr.read` / `hr.manage` | Keep untouched. **All payroll rows key by `user.id`** — the migration must not re-key them. |
| Leave | `leaveCategories` (3759), `employeeLeaveBalances` (3774, userId-keyed), `leaveRequests` (3801; status enum incl. `cancelled` via migration 0072) | `/api/hr/leave/*`; service `src/features/hr/services/leave-requests.ts` | Keep untouched. |
| Self-service | — | `/api/employee/me/*` (home, leave, payroll/payslip download, profile, time); gated by `resolveEmployeeContext` (`src/features/hr/services/employee-context.ts`) = "has employee_profiles row", not role. UI `/dashboard/hr/self-service` → `EmployeePortalView` (`src/features/hr/ui/employee-portal-view.tsx`). | Keep untouched; reuse for later self-service reconciliation. |
| Workforce pages | Time-clock is **kiosk-only, no persistence** (no schema table; `src/features/workforce/ui/time-clock-kiosk.tsx`). Leave/advances/awards pages under `/dashboard/workforce/*` and `/dashboard/hr/*` are config-driven static UI in `src/features/workforce/` + `src/features/crm/ui/hr-directory-view.tsx`. | — | The time-clock has no DB; do not build a second one in v1. |
| **Current `/dashboard/hr` page** | — | — | `HRDirectoryView` (`src/features/crm/ui/hr-directory-view.tsx`) is a **static mock**: 186 hardcoded fake employees, hardcoded dept distribution, fake KPIs, decorative buttons. This is the primary UI to replace with real data. |

### 1.3 Add-on infrastructure (already real and proven this week)

- `src/addons/registry.ts` **already lists `human-resources`** (`enabled: false`). Activating the addon
  does not require a registry change; it requires an `addon_entitlements` row per tenant.
- `src/libs/api/entitlements.ts`: `requireAddon(tenantId, addonId)`, `hasAddon`, `isActive`,
  `listEntitlements`, `assertKnownAddon`. Route pattern (proven by `event-management`):
  `requireRequestContext` → `requireTenant` → `requireAddon(tenantId, '…')` → `requireCapability`.
- Activation: `PATCH /api/settings/addons/[id]` — school_admin can **toggle** existing rows,
  super_admin **grants** new rows (via `POST /api/super-admin/entitlements`). Live DB rows today:
  `card-management`, `certificate-management`, `event-management` for both tenants.
- Reference addon implementation to mirror: `src/features/events/` (models/events-schema.ts,
  services/events-service.ts, ui/…, `/api/addons/events` gated by `requireAddon(tenantId,'event-management')`).

### 1.4 Permissions layer

- `src/libs/api/permissions.ts`: `PERMISSIONS` map, `requireCapability(ctx, key)`, role defaults
  (`school_admin`/`super_admin` = all). Existing HR keys: `hr.read`, `hr.manage`. `accountant`
  deliberately has **no** `hr.*` by default (comment: grant explicitly if accounting should own payroll).
- No `hr_manager` role exists. The enum `role` is closed. Per PLAN, do **not** add a role;
  add narrowly-scoped **capabilities** and grant them via tenant overrides where needed.

### 1.5 Live database state (queried 2026-08-08)

- **`employee_profiles` has 0 rows** in both tenants. Backfill will create profiles from scratch.
- Staff accounts: **6 total** (3/tenant): each tenant has `school_admin`, `teacher`, `accountant`.
  No `receptionist`/`guard` rows exist yet.
- **All `user.employee_id` values are empty/null**; no duplicates exist. Dropping the global
  `user_employee_id_unique` constraint is safe (no violations).
- `branches` table exists (Schema.ts:76, multi-branch addon) — reference it for `branchId`.

### 1.6 Dirty worktree (must be preserved)

`git status --short` shows **413 changed/untracked files** — a pre-existing dirty worktree, not ours.
Notable shared files already modified/untracked: `migrations/meta/_journal.json`,
`src/addons/registry.ts`, `src/app/[locale]/(dashboard)/dashboard/hr/page.tsx`,
`…/dashboard/hr/self-service/page.tsx`, `docker-compose.yml`, `package.json`, `package-lock.json`,
`next.config.ts`, `migrations/0026_add_attendance_summary_excuses_flags.sql`, `src/features/workforce/` (untracked),
`src/features/settings/` (untracked), many `.ultraplan/*.md`, `AGENT-HANDOFF.md`, and more.

**Implication:** no shared file may be assumed clean. All shared-file edits below follow the
NEXT-WAVE-AGENT-PLAN collision protocol and must be reviewed against the *current* file contents at
implementation time.

---

## 2. Gap analysis against the corrected `PLAN.md`

| PLAN.md claim | Verified truth | Decision |
|---|---|---|
| "Present `employeeProfiles` requires `userId`; cannot represent workers without accounts" | ✅ `userId NOT NULL`, 0 rows in DB | Make `userId` nullable; keep `unique(tenantId, userId)` (Postgres allows multiple NULLs). |
| "Lacks department, designation, manager, lifecycle, branch, contract history" | ✅ Confirmed (no such columns) | Add them (see §3). |
| "Backfill one profile for every existing staff user idempotently" | ✅ 6 staff users, 0 profiles | Migration inserts exactly 6 profiles, rerun-safe. |
| "Resolve global `user.employeeId` uniqueness mismatch in favour of tenant-scoped profile uniqueness" | ✅ Global unique on `user.employee_id`; all empty | Drop global unique; add `unique(tenant_id, employee_id)` on `employee_profiles`. Keep `user.employee_id` as read-only legacy mirror for teacher/roster UI compat. |
| "`hr.employee.read/manage`, `hr.organization.manage`, `hr.documents.read/manage`, `hr.sensitive.read`, `hr.access.manage`, `hr.export`" | ✅ No such keys exist yet; `hr.read`/`hr.manage` exist | Add new keys; keep `hr.read`/`hr.manage` for payroll/leave routes (do not touch their gating). |
| "Gate advanced pages/APIs with `requireAddon('human-resources')`; do not gate core account administration or teacher management" | ✅ Registry already lists the id; addon infra proven | Gate all new `/api/hr/*` addon routes + new pages. **Never** put `requireAddon` on `/api/users`, `/dashboard/settings/staff`, `/dashboard/settings/users`, `/dashboard/teachers/*`. |
| "Five-step wizard with review" | ✅ No wizard exists | Build it (phase 3). |
| "Offboarding deactivates access through core mechanism" | ✅ `requireRequestContext` rejects inactive | Offboard sets `user.userStatus = 'inactive'` via the same path the core uses; profile + history retained. |
| "Reuse existing employee self-service and leave/payroll services" | ✅ Services exist and are isolated | Do not fork them; only add employee-context surface fields. |
| "`employeeInvitations` … unless an existing Better Auth invitation primitive is found" | ❌ **No invitation primitive found** — `src/libs/auth.ts` exists but no invitation plugin/table; `user.mustChangePassword` + `access-reset` page are the only provisioning hooks | Build `employeeInvitations` with hashed token + `mustChangePassword` integration. |
| "Employment types v1: permanent/fixed_term/part_time/contractor/internship/substitute" | ✅ No enum exists yet | Store as `varchar` with display labels (do not freeze Moroccan legal enums). |
| PLAN §4 "Retain compatibility with existing `hr.read`/`hr.manage`" | ✅ Payroll/leave routes gate on them | Leave those routes untouched. New sensitive gating applies to **new** HR endpoints and to the legacy `employee-profiles` route (see §5). |

**Corrections the plan makes to `PLAN.md`** (assumptions that did not hold, now reflected):

1. `employee_profiles` is **empty**, not populated — backfill is from `user`, not a data-preserving merge.
2. Time-clock has **no persistence** — the PLAN's implied payroll/attendance integration does not exist;
   v1 deliberately does not build staff attendance (deferred, §10).
3. `/api/hr/employee-profiles` has **zero consumers** in `src` — gating its sensitive columns is low-risk.
4. `namingSeries` is keyed by **prefix only** (Schema.ts:1834-1840, PK = `prefix`), so an employee-ID
   series is a shared counter (same limitation as student `STD-`). Because employee-ID uniqueness is
   tenant-scoped on the profile, this is safe; it is documented as a known limitation.

---

## 3. Exact schema evolution and data-backfill strategy

### 3.1 New feature schema: `src/features/hr/models/hr-schema.ts`

New tables (all carry `tenantId`; Drizzle cross-references follow the proven feature-schema pattern —
see `src/features/certificates/models/certificates-schema.ts`, which imports `{ tenants }` from
`@/models/Schema` while Schema.ts re-exports that same file at the bottom of the barrel; FK callbacks
are lazy so the circular import resolves):

**`departments`**
- `id uuid PK`, `tenantId uuid NN FK→tenants cascade`, `branchId uuid null FK→branches`
- `name varchar(120) NN`, `code varchar(20) null`, `headEmployeeId uuid null FK→employee_profiles.id`
- `description text null`, `status varchar(20) NN default 'active'` (`active|archived`)
- `createdAt`, `updatedAt`
- `unique(tenantId, name)` (soft-archive instead of delete when in use)

**`designations`**
- `id uuid PK`, `tenantId uuid NN FK→tenants cascade`, `departmentId uuid null FK→departments`
- `title varchar(120) NN`, `code varchar(20) null`, `description text null`,
  `status varchar(20) NN default 'active'`
- `unique(tenantId, title)`. Designation **never** maps to an application role.

**`employeeDocuments`**
- `id uuid PK`, `tenantId uuid NN`, `employeeId uuid NN FK→employee_profiles.id`
- `documentType varchar(50) NN` (e.g. `contract`, `cin`, `passport`, `diploma`, `other`)
- `storageKey text NN` (blob-store path, immutable), `originalName varchar(255) NN`,
  `mimeType varchar(120) NN`, `fileSize int NN`
- `issuedAt date null`, `expiryDate date null`, `visibility varchar(20) NN default 'private'`
- `uploadedById text null FK→user.id`, `createdAt`

**`employeeEmploymentEvents`** (immutable timeline)
- `id uuid PK`, `tenantId uuid NN`, `employeeId uuid NN FK→employee_profiles.id`
- `eventType varchar(50) NN` (`hired|changed_department|changed_designation|changed_manager|
  employment_status_change|access_granted|access_revoked|offboarded|reactivated|archived|linked_account`)
- `actorId text NN FK→user.id`, `reason text null` (**restricted field**), `metadata jsonb null`
- `effectiveAt timestamp NN`, `createdAt` — append-only; no UPDATE path in service.

**`employeeInvitations`**
- `id uuid PK`, `tenantId uuid NN`, `employeeId uuid NN FK→employee_profiles.id`
- `tokenHash text NN unique` (sha256 of one-time token), `expiresAt timestamp NN`
- `invitedEmail varchar(255) NN`, `status varchar(20) NN default 'pending'`
  (`pending|sent|consumed|expired|revoked`), `consumedAt timestamp null`, `createdById text null`
- Append-only + status transitions only.

### 3.2 `employeeProfiles` evolution (edit the inline table in `src/models/Schema.ts:3568`)

Add:
- `userId` → **nullable** (drop NOT NULL); FK `user_id` `ON DELETE CASCADE` → **`SET NULL`**
  (preserve profile if a user row is ever hard-deleted). Drop/re-add the FK constraint in SQL.
- `branchId uuid null FK→branches`
- `employeeId varchar(50) null` + **`unique(tenantId, employeeId)`**
- `departmentId uuid null FK→departments`, `designationId uuid null FK→designations`
- `managerEmployeeId uuid null FK→employee_profiles.id` (self-ref)
- `employmentType varchar(20) null` (`permanent|fixed_term|part_time|contractor|internship|substitute`)
- `employmentStatus varchar(20) NN default 'active'`
  (`active|probation|on_leave|offboarded|archived` — **distinct** from `user.userStatus`)
- `hireDate date null`, `probationEndDate date null`, `contractStartDate date null`,
  `contractEndDate date null`, `workloadHours int null`
- Archive: `archivedAt timestamp null`, `archivedById text null FK→user.id`, `archivedReason text null` (restricted)

Keep: `cnssNumber`, `amoNumber`, `bankRib` (sensitive), `contractType`, `dependantsCount`,
`createdAt`, `updatedAt`, existing `id` values and `unique(tenantId, userId)`.

### 3.3 `user` table change (minimal)

- **Drop** `user_employee_id_unique` (Schema.ts:569). Keep `user.employee_id` column as a read-only
  legacy mirror so existing teacher/roster UIs that read `user.employeeId` keep rendering. Nothing
  new writes to it; the source of truth becomes `employee_profiles.employee_id`.
- No other `user` change.

### 3.4 Data-backfill (in migration `0073`)

Idempotent, deterministic, rerun-safe:

1. Insert one `employee_profiles` row for every staff `user` (roles `school_admin|teacher|accountant|
   receptionist|guard`, `tenantId NOT NULL`) that has no profile yet. Conflict guard:
   `ON CONFLICT (tenant_id, user_id) DO NOTHING`.
   - Carry over: `hire_date` ← `user.hire_date` (if set), `contract_type` ← existing default 'cdi',
     `cnss_number`/`amo_number`/`bank_rib` ← NULL (they were never set; nothing to preserve).
   - `employment_status = 'active'`; `user_status`-based: if `user.userStatus='inactive'` set
     `employment_status='offboarded'` is **not** assumed — leave all `active` (login vs employment
     are independent; do not invent offboardings).
2. Assign `employee_id`: per tenant, `EMP-{year}-{NNNN}` from a deterministic window function
   (`ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at)`), guaranteed unique per tenant.
   Mirror the same value into `user.employee_id` for roster/teacher UI continuity.
3. Seed `naming_series` with prefix `EMP-{currentYear}-` to the **global max** backfilled sequence so
   future app-generated IDs do not collide with backfilled ones (shared-counter limitation, §2.correction 4).
4. Insert an `employeeEmploymentEvents` `hired` row per backfilled profile (actor = `SYSTEM` sentinel
   is not allowed since `actorId` is an FK → use the tenant's `school_admin` user id from the same
   migration; if none exists, skip event rows for that tenant rather than inventing an actor).

**Preservation invariants (hard requirements):** existing `employee_profiles.id` values are never
re-generated; payroll/leave/payslip rows keyed by `user.id` are untouched; no historical identity is
deleted; running the migration twice yields exactly the same row set.

---

## 4. API and service inventory

### 4.1 New routes (all under `/api/hr/*`, gated: `requireRequestContext` → `requireTenant` →
`requireAddon(tenantId, 'human-resources')` → `requireCapability`)

| Route | Method | Capability | Notes |
|---|---|---|---|
| `/api/hr/departments` | GET / POST | `hr.employee.read` / `hr.organization.manage` | List (status filter) / create. `unique(tenantId,name)` 409 on dup. |
| `/api/hr/departments/[id]` | PATCH / DELETE | `hr.organization.manage` | PATCH: edit + archive. DELETE: **archive-only**; 409 `IN_USE` if employees assigned. |
| `/api/hr/designations` | GET / POST | `hr.employee.read` / `hr.organization.manage` | Same shape as departments. |
| `/api/hr/designations/[id]` | PATCH / DELETE | `hr.organization.manage` | Archive-only delete; 409 if in use. |
| `/api/hr/employees` | GET / POST | `hr.employee.read` / `hr.employee.manage` | GET: filters (role/department/designation/branch/employmentStatus/loginStatus/search) + **sensitive gating** (§5). POST: transaction — profile + optional account + `hired` event. `employee_id` auto from series if omitted. |
| `/api/hr/employees/[id]` | GET / PATCH | `hr.employee.read` / `hr.employee.manage` | PATCH: employment fields + manager/department/designation (tenant-checked) + emits change events. |
| `/api/hr/employees/[id]/history` | GET | `hr.employee.read` | `employeeEmploymentEvents` timeline. |
| `/api/hr/employees/[id]/documents` | GET / POST | `hr.documents.read` / `hr.documents.manage` | Upload via `saveUploadedFile`/blob-store; immutable storageKey. |
| `/api/hr/employees/[id]/documents/[documentId]` | DELETE | `hr.documents.manage` | Soft-archive (retain blob), never hard-delete. |
| `/api/hr/employees/[id]/provision-access` | POST | `hr.access.manage` | Create or link a login + issue `employeeInvitations` token OR set `user.mustChangePassword`; emits `access_granted`. |
| `/api/hr/employees/[id]/link-account` | POST | `hr.access.manage` | **One-time** link of an existing `user` (no duplicate profile; second link → 409). |
| `/api/hr/employees/[id]/offboard` | POST | `hr.access.manage` | Validates unresolved assignments (manager of others, active class-teacher rows, open leave), sets `user.userStatus='inactive'` via core mechanism, sets `employmentStatus='offboarded'`, records reason (restricted), emits `offboarded`. Preserves user + history + payroll + academic refs. |
| `/api/hr/employees/[id]/reactivate` | POST | `hr.access.manage` | `user.userStatus='active'` + `employmentStatus` update; emits `reactivated`. |
| `/api/hr/access` | GET | `hr.access.manage` | Login-state overview: invited/active/locked/inactive/never-provisioned. |
| `/api/hr/overview` | GET | `hr.employee.read` | Real headcount/hire/departure/document-expiry. Salary totals **only** under `hr.sensitive.read` (§5). |
| `/api/hr/export` | GET | `hr.export` | CSV/XLSX honoring filters + tenant boundary; sensitive columns opt-in only with `hr.sensitive.read`. |

### 4.2 New/updated services (under `src/features/hr/services/`)

- **`employee-id.ts`** — `reserveEmployeeId(tenantId)` reusing the `reserveMatricule`/`namingSeries`
  pattern (prefix `EMP-{year}-`).
- **`employees-service.ts`** — create/update/list/get with: tenant re-verification of every foreign id
  (`WHERE id=? AND tenantId=?` for branch/department/designation), manager-cycle prevention (BFS from
  manager before write; cycle → 409), profile+event transaction, sensitive-column projection (§5).
- **`organizations-service.ts`** (departments + designations) — CRUD, `IN_USE` guard (count employees),
  archive semantics.
- **`documents-service.ts`** — upload via `src/libs/api/uploads.ts` (`saveUploadedFile`),
  storage-key immutability, soft-archive, expiry listing.
- **`employment-events-service.ts`** — append-only timeline writer + reader.
- **`invitations-service.ts`** — token generation (crypto random), sha256 hashing at rest,
  status transitions, one-time link validation.
- **`offboarding-service.ts`** — unresolved-assignment audit, core deactivation, event+reason capture.
- **`employee-context.ts`** (extend, keep signature compatible) — add new profile fields to the
  returned object so self-service reads remain unchanged.

### 4.3 Reused without modification

- `src/features/hr/services/leave-requests.ts`, `payslips.ts` — untouched.
- `/api/employee/me/*` self-service routes, `/dashboard/hr/self-service` portal — untouched.
- `/api/users` for core account create (invite flow calls it, then sets `mustChangePassword`).
- `src/libs/api/audit.ts` `recordAudit` (in addition to the employment-events timeline) for compliance.
- `src/libs/api/entitlements.ts` `requireAddon`; `src/libs/api/permissions.ts` `requireCapability`.

---

## 5. Sensitive-field authorization matrix

**Principle (user requirement):** restriction happens at the **API response level** — unauthorized
callers receive responses where sensitive keys are *absent*, not masked or hidden in the UI.

Fields treated as sensitive: `salary` / `baseSalary` / payroll amounts, `nationalId`, `bankRib`,
`cnssNumber`, `amoNumber`, contract dates + `contractType` (full), `employeeDocuments` content,
offboarding/archive `reason`.

| Capability | Directory (name/photo/contact/dept/designation/hire/employmentStatus) | Documents metadata | Documents content | Salary / payroll | National ID | RIB / CNSS / AMO | Contract dates | Offboard/archive reason |
|---|---|---|---|---|---|---|---|---|
| `hr.employee.read` only | ✅ | ✅ | ❌ | ❌ absent | ❌ absent | ❌ absent | ✅ (start/end shown, no monetary) | ❌ absent |
| `+ hr.sensitive.read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `+ hr.documents.read` | ✅ | ✅ | ✅ (content) | ❌ absent | ❌ absent | ❌ absent | ✅ | ❌ absent |
| `+ hr.access.manage` | ✅ | ✅ | per docs cap | ❌ absent | ❌ absent | ❌ absent | ✅ | ✅ (reason visible to access managers) |

- `hr.sensitive.read` is **not** a default for `accountant` (mirrors the existing deliberate exclusion
  of `hr.*` from accountant defaults in `permissions.ts`). `school_admin`/`super_admin` have it via
  `ALL_PERMISSIONS`.
- **Legacy route**: `GET /api/hr/employee-profiles` currently returns `bankRib`, `cnssNumber`,
  `amoNumber` to anyone with `hr.read`. It has **zero consumers** in `src` (§2.correction 3), so this
  response is tightened to omit RIB/CNSS/AMO unless the caller has `hr.sensitive.read`. Its response
  shape for non-sensitive fields is preserved.
- New `/api/hr/employees` builds its `SELECT` conditionally on `hasCapability(ctx,'hr.sensitive.read')`;
  sensitive columns are **not selected** (not merely filtered) when unauthorized.

---

## 6. Migration and rollback strategy

### 6.1 Migration `migrations/0073_advanced_hr_employee_management.sql` (hand-written; never `drizzle-kit generate`)

Order (single transaction, `BEGIN`/`COMMIT`):
1. `CREATE TABLE departments`, `designations`, `employeeDocuments`, `employeeEmploymentEvents`,
   `employeeInvitations` (with FKs + tenant-scoped uniques).
2. `ALTER TABLE employee_profiles`: drop `NOT NULL` on `user_id`; drop `employee_profiles_user_id_fk`
   and re-add `ON DELETE SET NULL`; add new columns + FKs; add `unique(tenant_id, employee_id)`.
3. `ALTER TABLE "user" DROP CONSTRAINT user_employee_id_unique`.
4. Backfill `employee_profiles` (idempotent, §3.4), mirror `user.employee_id`, seed `naming_series`.
5. Optional `hired` events for backfilled profiles (tenant's `school_admin` actor).

Then append exactly one entry to `migrations/meta/_journal.json`:
`{ "version": "7", "when": <ts>, "tag": "0073_advanced_hr_employee_management", "breakpoints": true, "idx": 74 }`
(`when` must be greater than the previous entry's `1786200000002`; filename must equal `tag + ".sql"`).

**Verification gate:** `docker compose build migrate && docker compose up migrate` → exit 0;
`SELECT COUNT(*) FROM employee_profiles` = 6; rerun produces no change.

### 6.2 Rollback

- **Dev/test**: drop the 5 new tables, drop the new `employee_profiles` columns, delete
  `employee_profiles WHERE user_id IS NULL`, restore `NOT NULL` + cascade FK, restore
  `user_employee_id_unique`, remove the journal entry. Captured as a `DOWN` block in the migration file
  comment for dev use only.
- **Production**: do **not** roll back schema; toggle the `human-resources` entitlement off
  (`PATCH /api/settings/addons/human-resources {active:false}`). Data is preserved read-only and core
  staff/account/teacher functions continue (§8). This is the supported rollback path.

---

## 7. Backward-compatibility strategy

1. **Payroll/leave/payslip/self-service**: keyed by `user.id` — untouched. Profiles keep their `id`s;
   nothing re-keys.
2. **No-login employees**: `user_id NULL` rows are HR-tracked only. Payroll/leave/self-service join
   on `user`, so they remain available only to employees **with** a linked account — a documented
   boundary, not a regression (no-login workers never had payroll/leave). One-time `link-account`
   upgrades them into the integrated path without creating a duplicate profile.
3. **Existing `hr.read` / `hr.manage` routes** (payroll/leave): gating untouched; legacy
   `employee-profiles` only gets the sensitive-column tightening in §5 (zero consumers).
4. **Core staff/account/teacher surfaces** (`/api/users`, `/dashboard/settings/staff`,
   `/dashboard/settings/users`, `/dashboard/teachers/*`): no `requireAddon` added; keep working when
   the addon is disabled.
5. **`user.employee_id`** kept as read-only legacy mirror for existing teacher/roster UI.
6. **Permissions**: new `hr.*` keys are additive; existing defaults unchanged. No new role enum values.
7. **Addon disabled behavior**: HR pages route to an "Module non activé" state (the addon APIs 403);
   all HR data is preserved read-only; on reactivation the data reappears. Sidebar HR section is
   permission-gated, so only users with `hr.employee.read` (school_admin) see it.

---

## 8. Atomic implementation phases (each ends in a green gate)

Shared gate after **every** phase: `npx tsc --noEmit` (0), `npx next build` (exit 0), Docker build
passes for `app` + `migrate` (captured exit codes), and `scripts/check-tenant-isolation.ts` baseline.

- **Phase 0 — Preflight (no code):** lock shared files (`_journal.json`, `Schema.ts`, `permissions.ts`,
  `sidebar.tsx`, `registry.ts`) with the collision protocol; re-confirm highest migration = 0073/idx 74
  at the moment of writing; record exact dirty-worktree file list so phase diffs are attributable.
- **Phase 1 — Schema + backfill + permissions + compat:** `hr-schema.ts`, `Schema.ts` edits + barrel
  export, migration 0073 + journal, `permissions.ts` new `hr.*` keys, `employee-context.ts` surface
  extension, `employee-profiles` sensitive tightening. Verify: migrate applies, backfill = 6 + rerun
  idempotent, tsc, build.
- **Phase 2 — Organization:** `organizations-service`, departments/designations routes + views
  (CRUD, archive, IN_USE guard, tenant checks).
- **Phase 3 — Employee directory/profile/wizard:** `employees-service`, `/api/hr/employees*` routes,
  directory + wizard + profile UIs, sensitive gating, history, no-login employees, replace `/dashboard/hr`
  mock with real data (server page delegates to addon-aware client view).
- **Phase 4 — Documents, access, offboarding:** documents upload/list/archive, invitations +
  provision-access + link-account, access overview, offboarding + reactivation, sidebar HR section.
- **Phase 5 — Overview, export, disable behavior + full acceptance:** `/api/hr/overview` +
  `/api/hr/export`, HR overview view, addon-disable regression, complete test matrix + live two-tenant
  acceptance (§9).

---

## 9. Test matrix and live acceptance procedures

| # | Test | Acceptance |
|---|---|---|
| T1 | Migration apply + rerun | `docker compose up migrate` exit 0 twice; `employee_profiles` count = 6 both times; no dup `employee_id` per tenant |
| T2 | Backfill identity preservation | Existing `user.id`s, profile `id`s stable; payroll/leave rows untouched |
| T3 | Type/build gates | `tsc --noEmit` 0, `next build` exit 0, tenant-isolation script passes |
| T4 | Sensitive redaction | As `school_admin` *without* `hr.sensitive.read`: `/api/hr/employees` response JSON has no `salary`/`nationalId`/`bankRib` keys. Grant the capability → keys appear |
| T5 | Tenant isolation (two-tenant adversarial) | Tenant A cannot GET/PATCH tenant B's department/designation/employee; cross-tenant `departmentId`/`managerEmployeeId`/`branchId` in a body → 400/403 |
| T6 | Manager cycles | A→B→C→A rejected (409); acyclical tree accepted |
| T7 | No-login employee | Create profile with `userId` omitted (201); `link-account` once succeeds; second link → 409 |
| T8 | Offboarding | Sets `user.userStatus='inactive'` (login blocked), keeps profile + events + payroll/academic refs, records reason (restricted); unresolved assignments reported before commit |
| T9 | Addon disabled | New `/api/hr/*` → 403 `ADDON_NOT_ACTIVATED`; `/api/users`, `/settings/staff`, `/teachers/*` still 200; HR data intact; re-enable → data visible again |
| T10 | Reuse regression | Existing employee self-service portal flows (leave submit/cancel, payslip download, profile) + payroll period calculate/lock still pass (39/39 baseline) |
| T11 | Document lifecycle | Upload → blob stored + row created; delete → archived (blob retained); expiry listing correct |
| T12 | Designation ≠ permission | Change employee designation → application role/permissions unchanged |
| T13 | Live HTTP acceptance | Logged-in session: create dept → designation → employee (with and without login) → view profile → offboard → reactivate, all captured via `curl` with `?` exit codes |

---

## 10. Exact files expected to be created or modified

### Created
- `src/features/hr/models/hr-schema.ts`
- `src/features/hr/services/employee-id.ts`
- `src/features/hr/services/employees-service.ts`
- `src/features/hr/services/organizations-service.ts`
- `src/features/hr/services/documents-service.ts`
- `src/features/hr/services/employment-events-service.ts`
- `src/features/hr/services/invitations-service.ts`
- `src/features/hr/services/offboarding-service.ts`
- `src/features/hr/ui/employee-directory-view.tsx`
- `src/features/hr/ui/employee-wizard-view.tsx`
- `src/features/hr/ui/employee-profile-view.tsx`
- `src/features/hr/ui/departments-view.tsx`
- `src/features/hr/ui/designations-view.tsx`
- `src/features/hr/ui/access-lifecycle-view.tsx`
- `src/features/hr/ui/hr-overview-view.tsx`
- `src/app/api/hr/departments/route.ts`, `src/app/api/hr/departments/[id]/route.ts`
- `src/app/api/hr/designations/route.ts`, `src/app/api/hr/designations/[id]/route.ts`
- `src/app/api/hr/employees/route.ts`, `src/app/api/hr/employees/[id]/route.ts`
- `src/app/api/hr/employees/[id]/history/route.ts`
- `src/app/api/hr/employees/[id]/documents/route.ts`, `…/[documentId]/route.ts`
- `src/app/api/hr/employees/[id]/provision-access/route.ts`, `…/link-account/route.ts`
- `src/app/api/hr/employees/[id]/offboard/route.ts`, `…/reactivate/route.ts`
- `src/app/api/hr/access/route.ts`, `src/app/api/hr/overview/route.ts`, `src/app/api/hr/export/route.ts`
- `migrations/0073_advanced_hr_employee_management.sql`

### Modified
- `src/models/Schema.ts` (employeeProfiles columns/FK + barrel `export * from '@/features/hr/models/hr-schema'`)
- `migrations/meta/_journal.json` (one entry, `idx: 74`)
- `src/libs/api/permissions.ts` (add `hr.employee.read/manage`, `hr.organization.manage`,
  `hr.documents.read/manage`, `hr.sensitive.read`, `hr.access.manage`, `hr.export`)
- `src/components/shared/sidebar.tsx` (add "Ressources Humaines" section; keep "Portail Employé",
  "Enseignants", Settings staff/users)
- `src/app/[locale]/(dashboard)/dashboard/hr/page.tsx` (replace static mock)
- `src/features/hr/services/employee-context.ts` (extend return surface, keep signature)
- `src/app/api/hr/employee-profiles/route.ts` (sensitive tightening, §5)
- `src/app/[locale]/(dashboard)/dashboard/hr/employees/page.tsx`, `…/employees/new/page.tsx`,
  `…/employees/[id]/page.tsx`, `…/departments/page.tsx`, `…/designations/page.tsx`,
  `…/access/page.tsx` (thin server pages delegating to the client views above)

### Explicitly NOT touched (collision/dependency boundary)
`src/features/events/**`, `src/features/inventory/**` (unbuilt), `src/features/hostel/**` (unbuilt),
`src/features/guard/**` (unbuilt), `src/features/teachers/**` (core), payroll/leave routes, the
`/api/employee/me/*` self-service API, `src/features/crm/**` (only the static `hr-directory-view`
becomes unreferenced — see §11 risk R6).

---

## 11. Risks, dependencies and deliberately deferred work

### Risks
- **R1 Schema import cycle** (`Schema.ts` ↔ `hr-schema.ts`): mitigate by following the proven
  `events-schema.ts` pattern (lazy FK callbacks; re-export at the bottom of Schema.ts).
- **R2 Dirty worktree (413 files)**: no commits; shared-file edits reviewed against current contents;
  diffs kept attributable to HR phases only. Do not "clean up" unrelated files.
- **R3 Legacy `employee-profiles` tightening**: zero consumers, but if a runtime consumer is found
  during Phase 1 grep, restore `bankRib` for `hr.read` and gate only via the new endpoint.
- **R4 `naming_series` shared-prefix counter**: cross-tenant counter (same as `STD-`). Employee-ID
  uniqueness is enforced tenant-scoped on the profile, so no integrity risk; sequence may skip —
  acceptable.
- **R5 Hand-edited journal**: a malformed entry breaks `drizzle-kit migrate`. Mitigation: single
  entry, exact tag/filename match, `when` strictly increasing, verified by `docker compose up migrate`.
- **R6 Dead reference**: replacing `HRDirectoryView` leaves `src/features/crm/ui/hr-directory-view.tsx`
  unused. It is pre-existing code owned by the CRM surface; **mention** it, do not delete it without
  asking (per surgical-changes discipline).
- **R7 Accountant & payroll UI**: `accountant` has no `hr.*` today. If a payroll UI needs the legacy
  `employee-profiles` response, grant `hr.sensitive.read` per-tenant via overrides rather than by default.
- **R8 Docker build cost**: ~6 min build + EOF flakiness; build `migrate` and `app` separately and
  capture exit codes (`echo "EXIT_CODE:$?"`).

### Dependencies
- **Other agents** (per NEXT-WAVE-AGENT-PLAN): HR owns `src/features/hr/**`. Shared files
  (`_journal.json`, `Schema.ts`, `permissions.ts`, `sidebar.tsx`, `registry.ts`) are HR's to edit
  first but must be handed to later agents in a clean state. Inventory/Hostel/Guard depend on HR's
  stable employee-profile API/schema — do not rename the addon id or table names after Phase 1.
- `branches` (multi-branch addon) — read-only reference for `branchId`.
- `naming_series` + `src/libs/services/matricule.ts` pattern for `reserveEmployeeId`.
- `src/libs/api/uploads.ts`/`blob-store.ts` for document storage.

### Deliberately deferred (not in v1)
- Staff attendance (time-clock has no persistence; no fake KPIs — per the source spec).
- Payroll engine integration beyond preserving relationships (full payroll = separate addon).
- Leave/staff-absence KPIs on the overview (real leave data only; no fabricated numbers).
- Exports (CSV/XLSX/PDF/print) — Phase 5 low-priority, after correct employee data.
- Appraisals, shifts, onboarding checklists, nested department hierarchy.
- `librarian` application role (belongs to the Library addon).
- Moroccan employment-type legal conclusions — store display labels, configurable per school.
- 2FA / invitation email/SMS transport — invitations store a token + set `mustChangePassword`; the
  actual SMTP/SMS sender is deferred (a later phase may add real delivery).

---

## 12. Owner decisions requested before implementation begins

1. **Accountant sensitive access**: confirm `accountant` must keep read access to payroll-facing
   employee data (which currently returns RIB/CNSS through the legacy route). Default proposal:
   `accountant` gets **no** `hr.sensitive.read`; grant per-tenant only if a payroll UI demands it.
2. **Scope of "all workers"**: confirm v1 includes workers without SchoolOS accounts (cleaners,
   drivers, external trainers) with HR-only profiles (no payroll/leave until linked) — recommended yes.
3. **HR addon activation during development**: confirm we should insert `human-resources`
   entitlement rows for both dev tenants (as was done for `event-management`) so the pages can be
   tested end-to-end before super-admin activation exists in the UI flow.
4. **`/dashboard/hr` when addon disabled**: confirm it should show a "Module non activé" state
   (recommended) rather than redirecting to `/dashboard/settings/staff`.

---

*End of plan. Nothing in this document implies the feature is implemented — implementation starts only
after owner confirmation and phase-by-phase green gates.*

---

## 13. Implementation status — 2026-08-08 (Phases 1–5 shipped)

**Status: IMPLEMENTED & LIVE-VERIFIED** (phases 1–5; see `scripts/verify-hr-phase{2,3,4,5}.mjs`).

- Schema/migration: `migrations/0073_advanced_hr_employee_management.sql` applied (idempotent rerun OK).
- Gates: `tsc --noEmit` 0 · `next build` exit 0 (clean, after removing a disk-full-corrupted `.next`) ·
  `docker compose up migrate` exit 0 · `scripts/check-tenant-isolation.ts` pass.
- Live HTTP: Phase 4 = 25/25; Phase 5 = 17/17 (overview shape + salary redaction, CSV export incl.
  sensitive-column gating + tenant boundary, addon-disable regression + re-enable).
- Overview page: `/dashboard/hr/overview` (sidebar subItem "Aperçu").
- Deliberately deferred (unchanged): invitation transport/SMTP, provision-access account creation,
  full payroll engine, staff attendance, appraisals/shifts. `provision-access` route exists and is
  addon/permission-gated but returns a documented "SMTP not configured" error pending delivery.
