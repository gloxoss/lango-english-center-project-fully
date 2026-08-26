# Hostel Management — Verified Execution Plan

> Status: **PLANNED — no code changed yet, as of authoring.** Since implemented and
> live-verified; see `HOSTEL-MANAGEMENT-ADDON.md` top-of-file status and
> `future-implementation/_tracker/PLANS-AUDIT-AND-PROGRESS.md` (#28) for current status.
> This document is kept as the historical execution plan. Written after reading the five planning
> files in order (shared context, coordination plan, addon spec, references, prior
> `PLAN.md`, Advanced HR execution plan) and independently inspecting the live
> repository: schema, HR feature, addon infrastructure, permissions, migrations,
> journal, and existing non-overlap precedent. Every assumption was validated or
> corrected below.
>
> Verification date: **2026-08-08**. Highest migration observed: **`0075_hr_profile_national_id_salary`**
> (`migrations/meta/_journal.json` last `idx = 76`, contiguous). The next migration to
> reserve is **`0076`** with journal `idx = 77`. This number is confirmed **now**, and per
> the "recheck migration numbering immediately before integration" binding decision it
> MUST be re-confirmed from the actual journal at the moment the migration is written.

---

## 1. Verified integration map

Everything below was read from the repository at `schoolos-english-center-project-fully/schoolos-app`
(432-file pre-existing dirty worktree, per `git status --short` — no shared file is assumed clean).

| Integration | Verified source | How Hostel consumes it |
|---|---|---|
| **Student identity** | No `students` table exists. Students are `user` rows (`role = 'student'`, `id` text e.g. `STU-xxx`), `Schema.ts:476`. `src/features/students/model/types.ts` defines the `Student` projection. | `hostelAllocations.studentId` → `user.id` (FK). Eligibility and resident-self projections filter by `user.id` + `tenantId`. |
| **Guardians** | `guardians` (`Schema.ts:1743`) + `guardianStudents` (`Schema.ts:1711`, `studentId → user.id`, `isPrimaryContact`, `isEmergencyContact`, `relationshipType`). Routes `/api/guardians/[id]`, `/api/students/parents`. | Guardian consent (minors) and guardian-portal projections resolve children via `guardianStudents`. **Never** cross the tenant boundary. |
| **Session-scoped academic placement** | `studentPlacements` (`Schema.ts:3150`): `studentId`, `sessionYearId`, `classSectionId`, `status`, `startDate/endDate`, `isCurrent` with **partial unique** `student_placements_unique_current_idx (tenantId, studentId) WHERE isCurrent = true`, plus date-range CHECKs. Resolver: `src/libs/services/student-placement.ts` (`recordStudentPlacement`); route `/api/students/placements`. `sessionYears` at `Schema.ts:105`. | Eligibility = current placement exists (`isCurrent = true`) for the session. Read-only integration; Hostel never writes placements. |
| **Branches** | `branches` (`Schema.ts:76`): `id`, `tenantId`, `code` (+`unique(tenantId, code)`), `isDefault`, `isActive`. | `hostels.branchId → branches.id` (set null). List/hostel pages filter by `tenantId` and optionally `branchId`. |
| **Employees (HR) — VERIFIED READY, not a blocker** | Advanced HR shipped and live-verified (HR execution plan §13). `employee_profiles` (`Schema.ts:3568`): nullable `userId`, `firstName/lastName`, `employeeId` + `unique(tenantId, employeeId)`, `departmentId`, `designationId`, `employmentStatus`, `branchId`, sensitive `nationalId`/`salary`/`bankRib`/`cnssNumber`/`amoNumber`. Feature tables `departments`, `designations`, `employeeDocuments`, `employeeEmploymentEvents`, `employeeInvitations` in `src/features/hr/models/hr-schema.ts`, barrel-exported from `Schema.ts`. Migrations `0073`–`0075` applied. Services under `src/features/hr/services/`. | Warden/responsible-staff references `employee_profiles.id` (HR-tracked, may or may not have a login). Do **not** invent a competing employee model; do not rename HR tables. |
| **Finance (authoritative for charges)** | `invoices` (`Schema.ts:1800`), `invoiceItems` (`Schema.ts:1775`), `payments` (`Schema.ts:1846`), `feeStructures` (`Schema.ts:1606`), `feeStructureAssignments` (`Schema.ts:1627`), `feeCategories`, double-entry/receivables ledgers (migrations 0038/0039/0041/0042). | Hostel writes **no** Finance rows. A narrow adapter (`src/features/hostel/server/finance-adapter.ts`) records `hostelChargeLinks` that reference invoice/fee lines; on Finance failure it marks the link `failed` and **never** blocks occupancy or checkout. |
| **Attachments Book (authoritative for files, phase 4+)** | `digitalAssets`, `digitalAssetVersions` (`storageKey`, `sha256`, `scanStatus`), `digitalAssetTargets`, `digitalAssetUsageLinks` (`usageType` + `usageRefId`) in `src/features/attachments/models/attachments-schema.ts`. Blob store + malware scan in `src/libs/api/`. | Phase 4 files (incident/inspection photos) link via `digitalAssetUsageLinks` with `usageType = 'hostel_incident' | 'hostel_inspection'`. v1 keeps a minimal private adapter contract only; Hostel is independently usable without the addon. |
| **Add-on infrastructure** | `src/addons/registry.ts` **already lists `hostel`** (`enabled: false`). `addonEntitlements` (`Schema.ts:2917`, `unique(tenantId, addonId)`). `requireAddon(tenantId, id)` / `assertKnownAddon` in `src/libs/api/entitlements.ts`. Proven addon route pattern (`src/app/api/addons/events/route.ts`): `requireRequestContext` → `requireTenant` → `requireAddon` → `requireCapability` → `parseJson(strict)` → `recordAudit` (fire-and-forget) → `apiErrorResponse`. | All new routes gate with `requireAddon(tenantId, 'hostel')`. Gating is entitlement-driven; the registry `enabled` flag is documentation only (event-management is built and still shows `enabled: false`). |
| **Permissions** | `PERMISSIONS` map + `DEFAULT_ROLE_PERMISSIONS` in `src/libs/api/permissions.ts`. `school_admin`/`super_admin` get `ALL_PERMISSIONS`. No `hostel.*` keys exist yet. | Add `hostel.*` keys (§9). `requireCapability` on every gated action. |
| **Non-overlap precedent** | `migrations/0042_harden_finance_reference_integrity.sql:74-86` enforces fiscal-period non-overlap via a `BEFORE INSERT OR UPDATE` trigger raising `ERRCODE='23P01'` with `daterange(fp.start_date, fp.end_date, '[]') && daterange(NEW…)`. **`apiErrorResponse` (`src/libs/api/errors.ts`) maps only `23505`/`23503` — `23P01` falls through to 500.** | Hostel uses a **real `EXCLUDE USING gist` constraint** (not a trigger) as the concurrency guard, because a trigger's `EXISTS` check has a TOCTOU window under `READ COMMITTED` and overbooking is a hard acceptance criterion. Service layers additionally pre-check and map `23P01` → `ApiError(409, 'ALLOCATION_CONFLICT', …)`. |
| **Migrations / journal** | Highest = `0075`, journal last `idx = 76`, contiguous. `drizzle-kit generate` is **broken** in this repo — hand-write SQL only. | Migration `0076` + one journal entry `idx 77`. Never run `drizzle-kit generate`. |

**Dependency conclusion:** HR is **ready** — the stable employee-profile contract exists and is live. Hostel is unblocked per the NEXT-WAVE-AGENT-PLAN sequence (Hostel begins after HR). No competing employee model is created. The only genuinely new runtime dependency is the `btree_gist` PostgreSQL extension (needed for composite GiST exclusion constraints) — flagged as an owner decision in §10.

---

## 2. Policy & safeguarding ADR (Phase 0 deliverable, written now so code follows it)

These decisions are **recorded as configurable tenant policy**, never hard-coded legal assumptions.
The concrete artifact is the `hostelPolicies` table (§4.1) seeded with defaults; this ADR is its
rationale. Full ADR content is recorded here and mirrors the approved structure of the HR plan's
ADR-style gating decisions.

### 2.1 Residence eligibility
- A student is eligible when they have a **current placement** (`studentPlacements.isCurrent = true`)
  in a session for which residence is offered, and their age/gender meet the hostel's
  `genderPolicy`/`ageMin`/`ageMax`. Age/gender filtering is **configurable per hostel** and may be
  disabled by the school.
- Eligibility is a **read-side projection** of `studentPlacements` + `user.gender`/`user.dateOfBirth`.
  Hostel never mutates placement data.

### 2.2 Consent
- No universal legal assumption is hard-coded. Whether guardian consent is required is a
  **tenant policy**: default `REQUIRED` when the student is a minor (school configures the minor
  threshold), `NOT_REQUIRED` otherwise, overridable per hostel/zone.
- Leave passes and visitor pre-approvals for minors carry `guardianConsentRequired` and cannot
  reach `approved`/`active` without recorded guardian consent (`hostelLeavePassApprovals.approverRole = 'guardian'`)
  when the policy says so. Emergency departure is the sole override and logs the reason.

### 2.3 Visitor & leave rules
- Visitor hours, overnight-visit rules, and leave-pass duration caps are **zone-level policy**
  (`hostelZones.visitorHours`, policy snapshot). Visitor logging is phase 4; the policy surface is
  defined now so phase 4 does not invent rules.

### 2.4 Roll-call escalation
- Escalation is **configurable tiers**: e.g. T1 after N minutes past roll-call close → guardian
  contact log; T2 after M hours → warden; T3 → school_admin. Channels are **log-only in v1**
  (no SMS provider exists; see HR plan's deferred SMTP). Tiers and thresholds live in `hostelPolicies`.

### 2.5 Data retention
- Roll-call, leave-pass, and escalation records are retained for the school-defined period
  (default: current + 2 sessions), enforced by retention settings in `hostelPolicies`.
  Scheduled purge jobs are **phase 5**; the retention field is defined now.

### 2.6 Safeguarding access
- Anything safeguarding-flagged (restricted notes, sensitive reasons) is readable **only** with
  `hostel.safeguarding.read` and is **access-logged** (`recordAudit` + `hostelAllocationEvents`).
  Bed/room views never surface another resident's sensitive notes.
- Health/disability information is minimized, purpose-specific, and only attached where operationally
  necessary (e.g. `hostelBeds.isAccessible` is a facility flag, not a resident record).

### 2.7 Emergency departure
- Check-out is **never blocked** by Finance failure or unsettled charges. `hostelChargeLinks` are
  written in a separate, non-atomic, best-effort step after the hostel transaction commits
  (see §6.6). Incident/finance references remain attached to the allocation's immutable history.

### 2.8 Charges
- Base charge and deposit are a **snapshot at reservation** (`hostelAllocations.chargeSnapshot` from
  `hostelRoomCategories`). Finance is authoritative; `hostelChargeLinks` reconcile but do not
  implement accounting.

### 2.9 Independent operations
- Roll call is a **separate register** from academic attendance. It may create a supervision alert,
  but never writes to any attendance table.

---

## 3. Explicit v1 scope (phases 0–3 only)

**In v1 (this plan):**
- Phase 0: this ADR + permission matrix (§9) + policy table.
- Phase 1: physical inventory — hostels, zones, categories, rooms, beds; CRUD; archive/status rules;
  tenant/branch scoping; audit; capacity/occupancy board.
- Phase 2: allocation lifecycle — applications, effective-dated allocations, preview/commit,
  check-in/out, **atomic transfer**, bulk allocation with idempotency, exclusion constraints,
  allocation/occupancy reports, charge-link adapter boundary.
- Phase 3: daily supervision — roll call, leave/return, overdue escalation (idempotent),
  guardian approvals, **Tonight** command center, resident & guardian privacy projections.

**Explicitly NOT in v1 (phases 4–5, do not implement unless separately authorized):**
- Visitors/visits, incidents + restricted notes, inspections, maintenance/downtime, room readiness.
- Utilization forecasting, SLA/safety analytics, anonymized insights.
- Data export/retention jobs, restore tests, PWA/mobile QR scanning, real SMS delivery.
- PDF/print of emergency muster (Tonight provides a printable HTML view; no PDF engine).

Deliberate scope reductions (recorded, not silent):
- **No real SMS/email transport** (escalation notifications are log records; the send channel is
  `'log'`). Matches HR's `provision-access` "SMTP not configured" precedent.
- **No QR scanning** (optional accelerator per addon spec) — manual roll-call is the v1 path.
- **No separate warden application role.** Wardens are `employee_profiles` rows; operational
  permissions flow through capabilities granted to their linked login (or school_admin operates
  on their behalf). Consistent with HR's "no new role enum values" decision.

---

## 4. Data model (feature schema `src/features/hostel/models/hostel-schema.ts`)

All tables carry `tenantId` and follow the feature-schema pattern (`src/features/hr/models/hr-schema.ts`:
import shared types from `@/models/Schema`, define local `pgEnum`s, barrel-export from `Schema.ts`).
FKs are lazy so the `Schema.ts` circular import resolves. **EXCLUDE constraints cannot be expressed in
Drizzle — they live only in migration `0076`** (§7). No `effective_end` column is nullable; see §5.2.

### 4.1 Tables (v1 = phases 0–3)

**`hostelPolicies`** — tenant-level configurable rules.
`id`, `tenantId` (unique), `policies jsonb` (eligibility, consent thresholds, escalation tiers,
retention, safeguarding access, charge policy, emergency-departure rule), `version int` default 1,
`updatedById → user.id`, `updatedAt`.

**`hostels`** — residence/building.
`id`, `tenantId`, `branchId → branches` (set null), `code` (50), `name` (255), `address text`,
`phone`, `email`, `genderPolicy` (`mixed|male_only|female_only`), `ageMin int`, `ageMax int`,
`policySnapshot jsonb` (curfew, visitor hours, charge policy, escalation snapshot — copied from
category/zone policy at save time), `wardenEmployeeId → employee_profiles.id` (set null),
`emergencyContactName`, `emergencyContactPhone`, `capacity int` (**cached projection** = sum of
usable beds; never a manual counter, recomputed by the board read model), `status`
(`active|inactive|archived`), timestamps. `unique(tenantId, code)`, `index(tenantId, branchId)`.

**`hostelZones`** — building/floor/wing hierarchy.
`id`, `tenantId`, `hostelId → hostels` (cascade), `parentZoneId → hostelZones.id` (self, set null),
`zoneType` (`building|floor|wing|zone`), `code` (50), `name` (255), `curfewTime time`,
`rollCallTime time`, `visitorHours jsonb`, `emergencyAssemblyPoint text`, `chargePolicyOverride jsonb`,
`status` (`active|archived`). `unique(tenantId, hostelId, code)`, `index(hostelId)`.

**`hostelRoomCategories`** — room/bed category.
`id`, `tenantId`, `name` (120), `code` (30), `defaultCapacity int`, `amenities jsonb`,
`eligibleGenderPolicy` (`mixed|male_only|female_only`), `eligibleCohortIds jsonb` (classSectionId list),
`baseCharge numeric(12,2)` default 0, `depositAmount numeric(12,2)` default 0, `priority int` default 0,
`isAccessible boolean` default false, `status` (`active|archived`). Referenced categories are
**archived**, never deleted. `unique(tenantId, code)`.

**`hostelRooms`** — room under a hostel/zone/category.
`id`, `tenantId`, `hostelId → hostels` (cascade), `zoneId → hostelZones` (set null),
`categoryId → hostelRoomCategories` (set null), `code` (50), `name` (255), `isAccessible boolean`
default false, `facilities jsonb`, `responsibleEmployeeId → employee_profiles.id` (set null),
`status` (`active|inactive|out_of_service|archived`). `unique(tenantId, hostelId, code)`,
`index(hostelId, zoneId, categoryId)`. **Room capacity is derived = count of usable beds**, never a
stored counter.

**`hostelBeds`** — explicit numbered bed.
`id`, `tenantId`, `roomId → hostelRooms` (cascade), `code` (50), `isAccessible boolean` default false,
`status` (`active|out_of_service|archived`), `notes text` (facility/maintenance only — never another
resident's data). `unique(tenantId, roomId, code)`, `index(roomId)`.

**`hostelApplications`** — student application with decision.
`id`, `tenantId`, `studentId → user.id`, `sessionYearId → sessionYears` (set null),
`requestedStartDate date` NN, `requestedEndDate date` NN (**exclusive**; `CHECK end > start`),
`preferredCategoryIds jsonb`, `preferredRoomId → hostelRooms` (set null), `priorityReason text`,
`guardianConsentStatus` (`not_required|required|approved|denied`), `decision`
(`pending|approved|denied|waitlisted|withdrawn`), `decisionReason text`, `decidedById → user.id`,
`decidedAt timestamp`, timestamps. `index(tenantId, studentId, sessionYearId)`, `index(tenantId, decision)`.

**`hostelAllocations`** — the effective-dated source of truth.
`id`, `tenantId`, `applicationId → hostelApplications` (set null), `studentId → user.id`,
`bedId → hostelBeds` (cascade), `effectiveStartDate date` NN, `effectiveEndDate date` NN
(**exclusive**; `CHECK end > start`), `state` (`reserved|checked_in|checked_out|cancelled`),
`chargeSnapshot jsonb`, `sourceAllocationId → hostelAllocations.id` (self, set null; set on transfers),
`checkedInAt timestamp`, `checkedOutAt timestamp`, `notes text`, timestamps.
Indexes: `(tenantId, bedId)`, `(tenantId, studentId)`, `(tenantId, state)`. **Two partial EXCLUDE
constraints in migration `0076`** (§5.1). Allocations are never hard-deleted by the service; state
transitions only.

**`hostelAllocationEvents`** — **immutable** event history.
`id`, `tenantId`, `allocationId → hostelAllocations` (cascade), `eventType`
(`reserved|confirmed|checked_in|checked_out|transferred_out|transferred_in|cancelled|corrected|extended|shortened`),
`actorId → user.id`, `reason text` (**restricted**: shown only with `hostel.safeguarding.read`),
`metadata jsonb` (before/after snapshots), `createdAt`. **Append-only** — no UPDATE path in any
service. Corrections are recorded as new `corrected` events, never by editing a prior event.

**`hostelRollCalls`** — nightly register, **one per hostel per day**.
`id`, `tenantId`, `hostelId → hostels` (cascade), `callDate date`, `status` (`open|closed|cancelled`),
`openedById → user.id`, `closedById → user.id`, `closedAt`, timestamps. `unique(tenantId, hostelId, callDate)`.

**`hostelRollCallEntries`** — one row per resident per register.
`id`, `tenantId`, `rollCallId → hostelRollCalls` (cascade), `allocationId → hostelAllocations`,
`status` (`present|approved_leave|late|missing|sick|excused`), `notedById → user.id`, `note text`,
`notedAt`, `lastUpdatedAt`. `unique(tenantId, rollCallId, allocationId)`, `index(allocationId)`.

**`hostelLeavePasses`** — leave/return with guardian approval policy.
`id`, `tenantId`, `allocationId → hostelAllocations`, `studentId → user.id`, `destination text`,
`reason text`, `startDateTime timestamp` NN, `expectedReturnAt timestamp` NN, `actualReturnAt timestamp`,
`guardianApprovalRequired boolean` (from policy), `status`
(`pending|approved|denied|active|returned|expired|cancelled`), `createdById → user.id`, timestamps.
`index(tenantId, status)`, `index(allocationId)`.

**`hostelLeavePassApprovals`** — approval trail.
`id`, `tenantId`, `leavePassId → hostelLeavePasses` (cascade), `approverId → user.id`,
`approverRole` (`warden|guardian|school_admin`), `decision` (`approved|denied`), `reason text`,
`createdAt`.

**`hostelLeavePassReturns`** — return events, **idempotent** (one return per pass).
`id`, `tenantId`, `leavePassId → hostelLeavePasses` (cascade), `allocationId → hostelAllocations`,
`returnedAt timestamp`, `recordedById → user.id`, `note text`, `createdAt`. `unique(tenantId, leavePassId)`.

**`hostelEscalations`** — idempotent escalation records.
`id`, `tenantId`, `allocationId → hostelAllocations` (set null; null = hostel-wide/zone-wide),
`escalationType` (`missing_rollcall|overdue_return|unconfirmed_rollcall`), `triggerDate date`,
`tier int` default 1, `recipientType` (`guardian|warden|school_admin`), `channel` (`log|sms`)
default `log`, `acknowledgedAt`, `acknowledgedById → user.id`, `closureReason text`,
`idempotencyKey varchar(100)` NN, `createdAt`.
`unique(tenantId, idempotencyKey)` (mirrors `promotion_batches` idempotency precedent). Deterministic
key: `${escalationType}:${triggerDate}:${allocationId ?? 'ALL'}:${tier}`.

**`hostelChargeLinks`** — Finance reference adapter.
`id`, `tenantId`, `allocationId → hostelAllocations`, `feeStructureId → feeStructures` (set null),
`invoiceId → invoices` (set null), `invoiceItemId → invoiceItems` (set null), `chargeType`
(`residence_fee|deposit|damage`), `amount numeric(12,2)`, `status`
(`pending|linked|failed|reconciled|voided`), `error text`, timestamps. `index(tenantId, allocationId)`.

### 4.2 Deferred tables (documented; **created only in phase 4/5**)
`hostelVisitors`, `hostelVisits`, `hostelIncidents`, `hostelIncidentActions`, `hostelInspections`,
`hostelMaintenanceRequests`, `hostelAttachmentRefs`, analytics/forecast projections. Not created in
migration `0076`.

---

## 5. PostgreSQL exclusion-constraint design

### 5.1 Constraints (in migration `0076`, after `CREATE TABLE hostel_allocations`)

```sql
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS btree_gist; END $$;

ALTER TABLE "hostel_allocations"
  ADD CONSTRAINT "hostel_allocations_bed_no_overlap"
  EXCLUDE USING gist (
    "tenant_id" WITH =,
    "bed_id" WITH =,
    daterange("effective_start_date", "effective_end_date", '[)') WITH &&
  ) WHERE ("state" IN ('reserved', 'checked_in'));

ALTER TABLE "hostel_allocations"
  ADD CONSTRAINT "hostel_allocations_student_no_overlap"
  EXCLUDE USING gist (
    "tenant_id" WITH =,
    "student_id" WITH =,
    daterange("effective_start_date", "effective_end_date", '[)') WITH &&
  ) WHERE ("state" IN ('reserved', 'checked_in'));
```

Design decisions:
- **Real constraint, not a trigger.** The repo's fiscal-period precedent uses a `BEFORE` trigger with
  `EXISTS … &&` raising `23P01`, but a trigger check has a TOCTOU window under `READ COMMITTED`: two
  concurrent inserts into an empty range can both pass the check and both commit. The acceptance
  criterion "concurrent requests cannot overbook a bed or double-allocate a student" requires the
  index-enforced guarantee a real `EXCLUDE` constraint provides. `btree_gist` gives `=` support for
  `uuid`/`text` on a GiST index.
- **Partial constraints** (`WHERE state IN ('reserved','checked_in')`): `checked_out`/`cancelled`
  allocations are history and must not block new bookings — including the transfer's own "close
  source then open destination" sequence (§6.4).
- **Half-open `[)` ranges.** A transfer closes the source at `T` and opens the destination at `T`;
  with `[)` the source is `[start, T)` and the destination `[T, end)` — no overlap. Inclusive `[]`
  (as the fiscal-period precedent uses) would collide on abutting transfers. **Convention: every
  `effectiveEndDate`/`requestedEndDate` is EXCLUSIVE** — the first day the student no longer occupies
  the bed. `CHECK (effective_end_date > effective_start_date)`.
- **`tenant_id` is part of the exclusion key**, so the constraint is also a tenant-isolation guard at
  the database level.
- The Drizzle schema declares columns/indexes/CHECKs normally; Drizzle **cannot** express EXCLUDE, so
  these live only in hand-written SQL. Do **not** run `drizzle-kit generate`.

### 5.2 Why `effective_end_date` is NOT NULL
An open-ended "until further notice" allocation would need `COALESCE(end, 'infinity')` inside the
range expression. v1 keeps both endpoints NOT NULL: a residence stay always has a defined end
(session end or the approved period); "current" simply means the range contains today. This keeps the
constraint total and the board read model trivial. If open-ended stays become a real requirement, the
constraint is extended to `daterange(start, COALESCE(end, 'infinity'::date), '[)')` in a later
migration.

### 5.3 Error mapping
`23P01` is **not** mapped by `src/libs/api/errors.ts` today (only `23505`/`23503`). Every allocation
service wraps the commit in try/catch and re-maps `23P01` → `ApiError(409, 'ALLOCATION_CONFLICT',
'Conflit de période sur ce lit / cet élève.')`. Optionally add `23P01 → 409 CONFLICT` to `errors.ts`
(shared file; see collision risk R4) — this also fixes the latent fiscal-period 500, but it is **not**
required for Hostel.

---

## 6. Allocation lifecycle

### 6.1 Preview (no write)
`POST /api/addons/hostel/allocations/preview` runs the deterministic rules read-only:
1. Resolve eligibility via `placement-resolver.ts` (current placement for the session).
2. Filter candidate beds by hostel/zone/category/gender/age/cohort policy.
3. For each candidate, compute overlapping active allocations (`state IN ('reserved','checked_in')`
   whose `daterange` intersects the requested period) — the same predicate the constraint enforces.
4. Return per-student, per-bed outcomes with **applied priority rules and manual overrides listed**
   (the "fair allocation explanation" differentiator) plus any conflicts.
Pure function `planSeatAllocations(input)` is unit-tested directly (per shared-context §8 — no
DB-mocked vitest; verify live via curl+psql).

### 6.2 Commit transaction
`POST /api/addons/hostel/allocations/commit` (or `applications/[id]/decision` → create) runs in **one
`BEGIN`/`COMMIT`**:
1. Re-run the same checks inside the transaction (friendly 409 first).
2. `INSERT hostel_allocations` (`state='reserved'`, `chargeSnapshot` from category).
3. `INSERT hostelAllocationEvents` (`reserved`, actor, reason).
4. `recordAudit(context, 'create', 'hostel_allocation', id, …)` (fire-and-forget).
If the EXCLUDE constraint fires at step 2, the whole transaction rolls back → 409 (mapped per §5.3).
Commit is `school_admin`-gated (`hostel.allocation.manage`); the UI requires a preview step before
enabling the commit button.

### 6.3 Check-in / check-out lifecycle
- **check-in**: `reserved → checked_in`, sets `checkedInAt`, emits `checked_in`. Dates unchanged.
- **check-out**: `checked_in → checked_out`, sets `checkedOutAt`, and shortens `effectiveEndDate` to
  the checkout date (half-open: end = checkout date) if the student leaves before the planned end.
  Emits `checked_out`. The row leaves the active set via the partial constraint. **Finance failure
  does not block this** (§6.6).
- **cancel**: `reserved → cancelled` (before check-in), emits `cancelled`.
- Corrections (e.g. wrong recorded check-in date) are a **new** `corrected` event, never an edit of a
  prior event.

### 6.4 Atomic transfer
`POST /api/addons/hostel/allocations/[id]/transfer` in **one `BEGIN`/`COMMIT`**:
1. Service pre-check: source `state IN ('reserved','checked_in')` (else 409 — prevents a second
   transfer of an already-closed allocation).
2. **`UPDATE` source** → `state='checked_out'` (or `cancelled` if never checked in), `effectiveEndDate
   = transferDate`, `checkedOutAt = now`. The partial constraint drops the source from the active set.
3. **`INSERT` destination** allocation (`sourceAllocationId = source.id`, `effectiveStartDate =
   transferDate`, `state` follows source: `reserved` or `checked_in`).
4. **`INSERT` two events**: `transferred_out` (on source) and `transferred_in` (on destination).
5. `recordAudit` fire-and-forget.
Order matters: closing the source before opening the destination is what makes the abutting `[)`
ranges non-overlapping. If step 3 violates the constraint (concurrent transfer), the **entire
transaction rolls back** — both allocations unchanged (binding decision). Both histories remain
complete and reproducible.

### 6.5 Immutable allocation event history
`hostelAllocationEvents` is append-only. Every reserve/check-in/check-out/cancel/transfer/correction
writes a row with actor, reason, and before/after `metadata`. `GET …/allocations/[id]/events` returns
the timeline. No service exposes UPDATE/DELETE on events; corrections are additive.

### 6.6 Finance adapter boundary (never blocks occupancy)
`src/features/hostel/server/finance-adapter.ts`:
- On commit/check-out, after the hostel transaction commits, **best-effort** create/reconcile
  `hostelChargeLinks` against Finance. A Finance failure writes `status='failed'` + `error` and
  **returns success to the caller** — occupancy and emergency departure proceed.
- Reads only: fee structure / invoice lookups are read via the Finance routes' tenant-checked access.
- Hostel never writes to `invoices`/`payments`/ledgers directly.

### 6.7 Bulk allocation (idempotent)
`POST /api/addons/hostel/allocations/bulk/preview` + `bulk/commit`:
- Preview returns per-student outcomes (eligibility, chosen bed, applied rules, conflicts).
- Commit inserts all applications+allocations+events in one transaction with a deterministic
  `idempotencyKey` on a batch row (reuse the `promotion_batches` shape), so replaying the same bulk
  job is a no-op (`unique(tenantId, idempotencyKey)` → skip/409).

---

## 7. Roll call, leave/return, escalation

### 7.1 Roll call (separate register, never academic attendance)
- `POST /api/addons/hostel/roll-calls` opens a register (`hostelId`, `callDate`, `status='open'`).
  `unique(tenantId, hostelId, callDate)` prevents duplicates.
- `POST …/roll-calls/[id]/entries` upserts a `hostelRollCallEntries` row per resident
  (`present|approved_leave|late|missing|sick|excused`); `unique(tenantId, rollCallId, allocationId)`
  makes re-recording idempotent.
- Closing (`status='closed'`) runs the escalation evaluator (§7.3). Entries **never** write to any
  academic attendance table; `sick`/`missing` may create a supervision alert only.

### 7.2 Leave / return
- Resident (or school_admin on their behalf) creates a `hostelLeavePasses` row; `guardianApprovalRequired`
  is set from policy when the student is a minor.
- Approvals (`hostelLeavePassApprovals`) gate `pending → approved`; guardian consent recorded with
  `approverRole='guardian'` when required. `approved → active` at `startDateTime`.
- Return: `POST …/leave-passes/[id]/return` writes `hostelLeavePassReturns`
  (**`unique(tenantId, leavePassId)` → re-posting is a no-op/409**) and sets `actualReturnAt` +
  `status='returned'`. Late return feeds escalation.
- Cancelled passes (`cancelled`), missed windows (`expired` via a check at read/run time).

### 7.3 Overdue escalation — rules and idempotency
`POST /api/addons/hostel/escalations/run` (idempotent job; also invoked on roll-call close) evaluates,
from `hostelPolicies.policies.escalationTiers`:
- **missing_rollcall**: entries still `missing`/unconfirmed N minutes after roll-call close → T1;
  escalate tier when unresolved.
- **overdue_return**: leave passes `active` past `expectedReturnAt` → T1 guardian, T2 warden, T3 admin.
- **unconfirmed_rollcall**: a register still `open` past `rollCallTime` + grace → T1.
For each (type, date, allocation|hostel-wide, tier) it inserts a `hostelEscalations` row whose
`idempotencyKey` makes re-runs no-ops. Acknowledgment (`POST …/escalations/[id]/acknowledge`) records
`acknowledgedAt`/`acknowledgedById`/`closureReason`. Channel is `'log'` in v1 (no SMS provider);
the row is the audit record and the extension point for a future sender.

---

## 8. Read models & privacy projections

### 8.1 Tonight command center
`GET /api/addons/hostel/tonight` — a **derived read model**, no materialized table in v1:
- expected residents: allocations with `state='checked_in'` and `effectiveStartDate <= today < effectiveEndDate`.
- approved leave tonight: leave passes `active` covering today.
- overdue returns: passes past `expectedReturnAt`.
- unconfirmed roll call: today's register `open` or missing entries.
- staffing coverage: wardens (`hostel.wardenEmployeeId`) per hostel, mapped to `employee_profiles`
  names, plus a printable HTML view (no PDF engine).

### 8.2 Resident & guardian privacy projections
Enforced **server-side** at the API layer — never UI hiding:
- `GET /api/addons/hostel/resident/me` (role `student`): returns **only** the caller's own allocation,
  leave requests/passes, own return events, and hostel notices. No roommate names, no other visitor/
  welfare/incident data, no safeguarding fields.
- `GET /api/addons/hostel/guardian/me` (role `parent`): resolves children via `guardianStudents`
  (tenant-checked), returns each child's allocation, leave requests, approved visitor/arrival events
  (v1: leave/return only), and notices. **Never** roommate, safeguarding, incident, or welfare data.
- Both endpoints are scoped by `requireTenant` + the caller's identity; a child/student from another
  tenant cannot appear (tenant re-verification on every `studentId`/`allocationId`).

---

## 9. Permissions & sensitive-data matrix

### 9.1 New capability keys (add to `PERMISSIONS` map in `src/libs/api/permissions.ts`)
| Key | French label |
|---|---|
| `hostel.read` | Consulter les résidences et le tableau d'occupation |
| `hostel.manage` | Gérer résidences, zones, catégories, chambres et lits |
| `hostel.allocation.read` | Consulter les demandes et affectations |
| `hostel.allocation.manage` | Réserver, affecter, transférer, enregistrer arrivée/sortie |
| `hostel.supervision.read` | Consulter appels du soir, permissions de sortie et escalades |
| `hostel.supervision.manage` | Enregistrer l'appel du soir, les sorties/retours, les escalades |
| `hostel.safeguarding.read` | Consulter les notes et motifs sensibles (protection) |
| `hostel.export` | Exporter les données d'internat |
| `hostel.policies.manage` | Configurer les politiques d'internat |

Role defaults: `super_admin`/`school_admin` = all (via `ALL_PERMISSIONS`). `receptionist` gets
`hostel.read`, `hostel.allocation.read`, `hostel.supervision.read`, `hostel.supervision.manage`
(front-desk roll call/leave recording), **not** `hostel.allocation.manage` (allocation commits stay
with school_admin) — owner decision D3. `teacher`/`accountant`: none by default. `student`/`parent`
endpoints are gated by role allowlist + identity match, not a capability.

### 9.2 Sensitive-data matrix (API-response level — keys **absent**, never masked)
| Data | `hostel.read`/`allocation.read` | `hostel.supervision.read` | `hostel.safeguarding.read` | Resident/Guardian self |
|---|---|---|---|---|
| Inventory, board, occupancy | ✅ | ✅ | ✅ | ❌ |
| Allocation/application (own) | ✅ | ✅ | ✅ | own child only |
| Reason/notes (restricted) | ❌ absent | ❌ absent | ✅ | ❌ absent |
| Safeguarding-flagged fields | ❌ absent | ❌ absent | ✅ (access-logged) | ❌ absent |
| Charge snapshot amounts | ✅ (tenant-scoped) | ✅ | ✅ | own child only |
| Other residents' names/roommates | ✅ (board may show names to staff) | ✅ | ✅ | ❌ **never** |
| Incident/welfare/visitor data (phase 4) | n/a | n/a | restricted | ❌ **never** |

- Safeguarding reads are additionally written to `recordAudit` + an access-logged event.
- `hostel.export` honors filters + tenant boundary; sensitive columns require `hostel.safeguarding.read`.

---

## 10. Migration and rollback strategy

### 10.1 Migration `migrations/0076_hostel_management.sql` (hand-written; never `drizzle-kit generate`)
Single transaction, `BEGIN`/`COMMIT`:
1. `DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS btree_gist; END $$;`
2. `CREATE TABLE IF NOT EXISTS` all §4.1 tables with FKs, unique constraints, indexes, CHECKs.
3. `ALTER TABLE hostel_allocations ADD CONSTRAINT … EXCLUDE USING gist …` (both constraints, §5.1).
4. No backfill (new tables; no legacy data to migrate). Optional seed of `hostelPolicies` defaults per
   tenant is done in a seed script, not the migration.
Append exactly one journal entry: `{ "version": "7", "when": <ts > previous>, "tag":
"0076_hostel_management", "breakpoints": true, "idx": 77 }`.
**Verification gate:** `docker compose build migrate && docker compose up migrate` → captured exit 0;
rerun idempotent; `\d hostel_allocations` shows both exclusion constraints; `\dx` shows `btree_gist`.

### 10.2 Rollback
- **Dev/test**: drop tables in reverse dependency order (`hostelChargeLinks`, `hostelEscalations`,
  `hostelLeavePassReturns`, `hostelLeavePassApprovals`, `hostelLeavePasses`, `hostelRollCallEntries`,
  `hostelRollCalls`, `hostelAllocationEvents`, `hostelAllocations`, `hostelApplications`,
  `hostelBeds`, `hostelRooms`, `hostelRoomCategories`, `hostelZones`, `hostels`, `hostelPolicies`),
  optionally `DROP EXTENSION btree_gist` (only if no other consumer). Captured as a `DOWN` block in
  the migration comment.
- **Production**: do **not** roll back schema. Toggle the `hostel` entitlement off
  (`PATCH /api/settings/addons/hostel {active:false}`). Data preserved read-only; student/guardian/
  finance/attendance core flows are untouched by the addon being disabled (§12 T12).

---

## 11. Atomic build phases (each ends in a green gate)

Shared gate after every phase: `npx tsc --noEmit` (0), `npx next build` (exit 0), Docker build
passes for `migrate` + `app` (captured exit codes, sequential builds), `scripts/check-tenant-isolation.ts`
baseline, live two-tenant sweep, and `git status` diff attributable to Hostel only.

- **Phase 0 — Preflight (no code):** lock shared files (`_journal.json`, `Schema.ts`, `permissions.ts`,
  `sidebar.tsx`, `registry.ts`, optionally `errors.ts`) with the collision protocol; **re-confirm
  highest migration = 0076/idx 77 at the moment of writing**; record exact dirty-worktree file list;
  get owner sign-off on the §13 decisions.
- **Phase 1 — Inventory:** `hostel-schema.ts` (inventory tables + policies), `Schema.ts` barrel,
  migration `0076`, `permissions.ts` keys, registry flip, inventory CRUD services/routes, board read
  model, hostels/zones/categories/rooms/beds pages + board UI. Gate: migrate applies + reruns,
  tsc, build, isolation.
- **Phase 2 — Allocation:** applications + allocations + events + charge links; `eligibility-service`,
  `placement-resolver`, `allocation-service` (preview/commit/check-in/check-out/transfer), bulk,
  EXCLUDE constraints, reports, allocation workspace UI + inspector sidebar. Gate: §12 concurrency
  tests T1–T6.
- **Phase 3 — Supervision:** roll call, leave/return, escalations, Tonight dashboard, resident/
  guardian projections + their pages. Gate: §12 tests T7–T12 + full acceptance.

---

## 12. Concurrency & privacy test matrix

| # | Test | Acceptance |
|---|---|---|
| T1 | Migration apply + rerun | `docker compose up migrate` exit 0 twice; no `already exists` errors; `\dx` shows `btree_gist`; both EXCLUDE constraints present |
| T2 | Concurrent bed overbook | Two parallel `POST …/allocations/commit` for the same bed/overlapping period → exactly one 201, one 409 `ALLOCATION_CONFLICT` (no double commit) |
| T3 | Concurrent student double-allocate | Same student, two beds, overlapping periods → one 201, one 409 |
| T4 | Failed transfer atomicity | Transfer to an already-taken bed → 409 **and** both source+destination allocations unchanged; source still active |
| T5 | Successful transfer timeline | Close source + open destination in one txn; `[)` abutting ranges; `transferred_out` + `transferred_in` events present; history reproducible |
| T6 | Check-out with Finance down | `finance-adapter` throws → checkout still 201; `hostelChargeLinks` row `status='failed'`; allocation `checked_out` |
| T7 | Guardian privacy | Parent session: `/api/addons/hostel/guardian/me` returns only own children's allocation/leave/returns; response JSON has **no** roommate/safeguarding/other-student keys |
| T8 | Resident privacy | Student session: `/api/addons/hostel/resident/me` returns own records only; no other-resident keys |
| T9 | Out-of-service transition | Setting a bed/room `out_of_service` enumerates affected active allocations before commit; blocks new allocation; emits `corrected`/`shortened` events as applicable |
| T10 | Escalation idempotency | `POST …/escalations/run` twice → second run creates no duplicate rows (unique idempotencyKey); acknowledgement + closure reason recorded |
| T11 | Two-tenant adversarial | Tenant A cannot GET/PATCH tenant B's hostel/zone/room/bed/allocation; cross-tenant `studentId`/`bedId`/`branchId`/`wardenEmployeeId` in a body → 400/403 |
| T12 | Addon disabled | `requireAddon(tenantId,'hostel')` routes → 403 `ADDON_NOT_ACTIVATED`; `/api/students/placements`, student/guardian/finance/attendance flows still 200; re-enable → data intact |
| T13 | Type/build/isolation gates | `tsc --noEmit` 0, `next build` exit 0, `check-tenant-isolation.ts` flags no new files |

---

## 13. Owner decisions requested before implementation begins

1. **`btree_gist` extension** — confirm adding a PostgreSQL extension (superuser-available in the
   Docker `db` service) is acceptable. Alternative (weaker, follows the 0042 trigger precedent) would
   use a trigger + `SELECT FOR UPDATE` but cannot fully close the concurrent-overbook race. **Recommended: yes, real constraint.**
2. **Open-ended allocations** — v1 requires an `effectiveEndDate` on every allocation (half-open `[)`).
   Confirm no "until further notice" stays are needed in v1. **Recommended: yes (NOT NULL).**
3. **Receptionist capabilities** — front-desk roll call + leave recording but not allocation commits.
   **Recommended: yes.**
4. **Guardian consent default for minors** — required for leave passes and (phase 4) visitor
   pre-approval; tenant-configurable. **Recommended: required.**
5. **Escalation channel** — log-only in v1 (no SMS provider). **Recommended: yes.**
6. **Dev entitlement seeding** — insert `hostel` rows in `addon_entitlements` for both dev tenants
   during development (precedent: `event-management`). **Recommended: yes.**
7. **`errors.ts` `23P01 → 409` mapping** — optional shared-file edit that also fixes the latent
   fiscal-period 500. If declined, Hostel maps at the service layer only. **Recommended: add it.**
8. **Warden model** — warden is an `employee_profiles` reference; operational access via capability
   grants to the linked login, no new application role. **Recommended: yes.**
9. **Archived-category delete** — categories/zones in use are archived, never hard-deleted
   (matches HR org tables). **Recommended: yes.**

---

## 14. Shared-file collision risks

Per NEXT-WAVE-AGENT-PLAN, only one integration agent edits each shared file at a time. Current
baseline: **432 changed/untracked files** (pre-existing, must be preserved). Hostel needs these edits:
1. `migrations/meta/_journal.json` — one entry `idx 77`. Must be reviewed against current contents;
   `when` strictly increasing; tag == filename.
2. `src/models/Schema.ts` — barrel `export * from '@/features/hostel/models/hostel-schema'` only.
3. `src/libs/api/permissions.ts` — add `hostel.*` keys. HR keys exist; do not touch them.
4. `src/components/shared/sidebar.tsx` — add a Hostel section (permission-gated `hostel.read`).
5. `src/addons/registry.ts` — flip `hostel` to `enabled: true` + update description (documentation;
   gating is entitlement-driven). Low risk.
6. `src/libs/api/errors.ts` (optional, D7) — `23P01 → 409`; behavior change to the existing
   fiscal-period route (500 → 409), which is a latent-bug fix, but must be coordinated.
No `package.json`/lockfile change expected (no new npm deps — the constraint is pure SQL).

---

## 15. Exact files expected to be created or modified

### Created
- `src/features/hostel/models/hostel-schema.ts`
- `src/features/hostel/model/types.ts`
- `src/features/hostel/services/eligibility-service.ts`
- `src/features/hostel/services/inventory-service.ts`
- `src/features/hostel/services/allocation-service.ts`
- `src/features/hostel/services/roll-call-service.ts`
- `src/features/hostel/services/leave-passes-service.ts`
- `src/features/hostel/services/escalations-service.ts`
- `src/features/hostel/services/tonight-service.ts`
- `src/features/hostel/services/policies-service.ts`
- `src/features/hostel/server/placement-resolver.ts`
- `src/features/hostel/server/finance-adapter.ts`
- `src/features/hostel/server/attachments-adapter.ts` (contract only in v1; implementation phase 4)
- `src/features/hostel/ui/hostels-view.tsx`, `hostel-detail-view.tsx`, `zones-view.tsx`,
  `categories-view.tsx`, `rooms-beds-view.tsx`, `bed-board-view.tsx`, `allocation-workspace-view.tsx`,
  `allocation-detail-view.tsx`, `roll-call-view.tsx`, `leave-passes-view.tsx`, `tonight-view.tsx`,
  `resident-me-view.tsx`, `guardian-me-view.tsx`, `hostel-policies-view.tsx`, `hostel-reports-view.tsx`
- API routes under `src/app/api/addons/hostel/`: `hostels/route.ts`, `hostels/[id]/route.ts`,
  `zones/route.ts`, `zones/[id]/route.ts`, `categories/route.ts`, `categories/[id]/route.ts`,
  `rooms/route.ts`, `rooms/[id]/route.ts`, `beds/route.ts`, `beds/[id]/route.ts`,
  `beds/[id]/status/route.ts`, `board/route.ts`, `applications/route.ts`, `applications/[id]/route.ts`,
  `applications/[id]/decision/route.ts`, `allocations/preview/route.ts`, `allocations/commit/route.ts`,
  `allocations/bulk/preview/route.ts`, `allocations/bulk/commit/route.ts`, `allocations/route.ts`,
  `allocations/[id]/route.ts`, `allocations/[id]/events/route.ts`, `allocations/[id]/check-in/route.ts`,
  `allocations/[id]/check-out/route.ts`, `allocations/[id]/transfer/route.ts`,
  `roll-calls/route.ts`, `roll-calls/[id]/entries/route.ts`, `roll-calls/[id]/close/route.ts`,
  `leave-passes/route.ts`, `leave-passes/[id]/route.ts`, `leave-passes/[id]/return/route.ts`,
  `escalations/run/route.ts`, `escalations/[id]/acknowledge/route.ts`, `tonight/route.ts`,
  `resident/me/route.ts`, `resident/me/leave-requests/route.ts`, `guardian/me/route.ts`,
  `policies/route.ts`, `reports/occupancy/route.ts`, `reports/allocations/route.ts`
- Pages under `src/app/[locale]/(dashboard)/dashboard/hostel/`: `page.tsx` (Tonight),
  `hostels/page.tsx`, `hostels/[id]/page.tsx`, `zones/page.tsx`, `categories/page.tsx`,
  `rooms/page.tsx`, `board/page.tsx`, `applications/page.tsx`, `allocations/page.tsx`,
  `allocations/[id]/page.tsx`, `roll-call/page.tsx`, `leave-passes/page.tsx`, `policies/page.tsx`,
  `reports/page.tsx`, `me/page.tsx` (resident), `guardian/page.tsx` (parent) — thin server pages
  delegating to the client views above.
- `migrations/0076_hostel_management.sql`

### Modified
- `src/models/Schema.ts` (barrel export)
- `migrations/meta/_journal.json` (one entry, `idx: 77`)
- `src/libs/api/permissions.ts` (`hostel.*` keys)
- `src/components/shared/sidebar.tsx` (Hostel section)
- `src/addons/registry.ts` (hostel entry `enabled: true` + description) — optional
- `src/libs/api/errors.ts` (`23P01 → 409`) — optional, decision D7

### Explicitly NOT touched (collision/dependency boundary)
`src/features/attendance/**`, all academic attendance routes, `src/features/guard/**` (unbuilt),
`src/features/inventory/**` (unbuilt), HR payroll/leave routes and `employee_profiles` definitions,
Finance ledger routes (adapter reads only), `/api/students/placements` (read-only integration),
`src/features/cards/**`, `src/features/certificates/**`. Pre-existing dirty-worktree files are never
"cleaned up".

---

## 16. Risks and dependencies

- **R1 Schema import cycle** (`Schema.ts` ↔ `hostel-schema.ts`): follow the proven `hr-schema.ts`
  pattern (lazy FK callbacks; barrel at the bottom of `Schema.ts`).
- **R2 Dirty worktree (432 files)**: no commits; shared-file edits reviewed against current contents;
  diffs attributable to Hostel phases only.
- **R3 `btree_gist`** not present today: must be created in the migration; verify `\dx` after apply.
- **R4 `23P01` unmapped**: service-layer mapping is mandatory regardless of the optional `errors.ts` edit.
- **R5 Journal collision**: a concurrent agent appending before us would invalidate `idx 77` — recheck
  immediately before writing (binding decision).
- **R6 Tenant UUID drift**: the HR plan and the shared context list different dev tenant UUIDs —
  re-read tenant ids from the live DB at implementation time (use seeded admin emails
  `y.elamrani@atlas.ma`, `admin@schoolos.ma` as anchors).
- **R7 Docker build cost**: ~6 min; build `migrate` then `app` sequentially; capture exit codes.
- **Dependencies**: HR employee contract (verified ready). `studentPlacements`/`sessionYears`
  (verified). `branches`, `guardians`/`guardianStudents`, Finance invoice/fee tables, Attachments
  `digitalAssetUsageLinks` (phase 4). Per NEXT-WAVE-AGENT-PLAN, Hostel may begin now; Guard's Hostel
  handoff waits for Hostel phase 2 APIs.

---

*End of plan. Nothing in this document implies the feature is implemented — implementation starts only
after owner confirmation and phase-by-phase green gates.*
