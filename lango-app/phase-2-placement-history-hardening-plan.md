# Phase 2 Placement History — Audit and Hardening Plan

## Audit verdict

**Current status after hardening: core placement integrity is verified; Phase 2 remains yellow/in progress until portal object scopes, remaining writers, audit/outbox, correction UI and reconciliation gates are complete.**

The table and basic GET/POST route exist and compile, but the implementation does not yet establish placement history as the authoritative system of record. The current contract test does not call the route, migration `0037` performs no backfill, promotions and transfers do not write placement rows, and the database does not enforce tenant consistency or the single-current-placement invariant.

Because migration `0037` is already registered and applied, do not rewrite it again. All database corrections must be delivered through the next available additive migration after the finance drafts currently named `0038` and `0039` (expected placement hardening migration: `0040_harden_student_placements.sql`, subject to final journal order).

## Confirmed findings

### P0 — Release blockers

1. **Cross-tenant reference vulnerability.** POST accepts arbitrary `studentId`, `sessionYearId`, and `classSectionId`. The row's `tenant_id` is taken from the session, but the three foreign keys validate only the referenced ID. A tenant can therefore create a placement pointing at another tenant's student or academic structure; GET then joins and returns the referenced student's name and matricule.
2. **Non-atomic state transition.** Closing the previous placement, inserting the new row, and updating `user.classSectionId` are three independent transactions. Any intermediate failure leaves placement history and the current student record inconsistent.
3. **No single-current invariant.** The database has no partial unique index preventing two current placements for the same tenant/student. Concurrent requests can create duplicates.
4. **Promotions and transfers are not integrated.** Both routes still update only `user.classSectionId`; neither imports or writes `studentPlacements`. The implementation report and completed checklist are inaccurate.
5. **No historical backfill.** Migration `0037` only creates the table and indexes. The live table contains zero rows. The claimed backfill was not implemented.
6. **Tests do not test the implementation.** `placements.test.ts` asserts properties on a local mock object. It does not import the route, query PostgreSQL, verify authorization, or exercise GET/POST.

### P1 — Correctness and privacy gaps

1. **Insufficient reference validation.** POST does not verify that the user is a student or that the student, session year, and class section all belong to the requesting tenant.
2. **Effective-date rules are undefined.** The previous row ends on the server's current date even when the new row has a different `startDate`. There are no checks for invalid or overlapping date ranges.
3. **Weak object scope.** GET relies on broad `students.read`. Teacher, parent, accountant, receptionist, and guard defaults include that capability in some form, but this route has no teacher-assignment, linked-child, branch, or purpose scope. Unfiltered GET returns the entire tenant placement history including notes.
4. **Missing promoted-from integrity.** `promotedFromPlacementId` has no self-referencing foreign key and POST never sets it.
5. **No validation contract.** The route uses raw JSON destructuring rather than strict Zod schemas; UUIDs, ISO dates, note length, unexpected properties, and invalid status transitions are not validated.
6. **No audit event or idempotency.** Placement changes are official academic-record transitions but do not emit a dedicated audit event or protect against retry duplication.
7. **Unbounded GET.** Tenant-wide placement history has no pagination, maximum page size, or stable cursor.

### P2 — Maintainability and product gaps

1. Placement logic lives directly in one route instead of a shared service used by admission conversion, manual placement, promotion, and transfer.
2. `updatedAt` is not explicitly advanced when a placement is closed.
3. The response omits class/section display names and transition reason/type, limiting timeline usefulness.
4. There is no placement-history UI on the student profile and no controlled correction/reversal workflow.

## Corrected ponytail audit

- **Do not delete the legacy academic tables yet.** `programs` is still used by the fee-structure API, and the other tables remain in relations/migration history. First produce a read/write dependency report, choose canonical replacements, migrate consumers/data, and only then deprecate through an additive migration.
- **Do not remove `user.level` or `user.className` yet.** The students API still reads them as compatibility fallbacks when `classSectionId` is absent. Remove them only after backfill coverage reaches 100%, fallback telemetry remains at zero, and response compatibility is migrated.
- **Do not perform the proposed “manual filtering” cleanup.** The cited array operations calculate attendance rates and invoice balances after tenant-scoped database queries; they are not duplicate query filtering. They may later move to SQL aggregates for performance, but that is a measured optimization, not dead-code removal.

## Implementation plan

### Stage 0 — Correct status and freeze unsafe writes

- Change Phase 2 in the tracker to in progress until all gates below pass.
- Temporarily restrict placement POST to school administrators if object-scoped authorization is not ready.
- Document one canonical date convention. Recommended: inclusive `startDate`, exclusive nullable `endDate`, with current meaning `endDate IS NULL`.

### Stage 1 — Add database invariants through the next available migration

- Add `CHECK (end_date IS NULL OR end_date > start_date)`.
- Add a partial unique index on `(tenant_id, student_id) WHERE is_current = true`.
- Add `CHECK ((is_current AND end_date IS NULL) OR NOT is_current)` or the finalized lifecycle equivalent.
- Add a self-FK from `promoted_from_placement_id` to `student_placements.id` using `ON DELETE SET NULL`.
- Enforce tenant-consistent references. Preferred approach: add unique `(tenant_id, id)` keys to `user`, `session_years`, and `class_sections`, then add composite placement foreign keys for `(tenant_id, referenced_id)`.
- Add query indexes for `(tenant_id, student_id, start_date DESC)` and `(tenant_id, session_year_id)`.
- Make migration idempotent where project conventions require it and test forward migration on a database snapshot.

### Stage 2 — Build a canonical placement service

- Create a service such as `src/libs/services/student-placement.ts`.
- Accept strict validated input plus authenticated tenant/actor context.
- In one database transaction:
  1. Load and validate the tenant-owned student, session year, and class section.
  2. Lock the student's current placement rows.
  3. Validate effective dates and close the prior row.
  4. Insert the new placement with transition type/reason and predecessor link.
  5. Update `user.classSectionId` as a compatibility projection.
  6. Record the academic audit event or transactional outbox record.
- Define idempotency for retried promotion/import requests.
- Return an explicit conflict for duplicate/overlapping transitions.

### Stage 3 — Backfill and reconcile

- Write a dry-run script that reports students with `classSectionId` but no placement, tenants without exactly one active/default session year, cross-tenant class references, and ambiguous dates.
- Backfill only unambiguous rows using the tenant's active/default session year and a documented effective date.
- Store ambiguous cases in an exception report for administrator review; never guess silently.
- Add a reconciliation query proving every active student's compatibility `classSectionId` matches their one current placement.
- Record before/after counts and make the backfill retry-safe.

### Stage 4 — Integrate every writer

- Replace direct class updates in admission conversion, manual placement, promotion, and transfer with the shared placement service.
- For promotions, link `promotedFromPlacementId` and use the destination session year.
- For within-year transfers, preserve the same session year and close the prior date range.
- Prevent remaining application code from writing `user.classSectionId` directly, except the placement service and explicit repair tooling.

### Stage 5 — Harden API and authorization

- Use `parseJson()` with strict Zod POST schemas and validated GET query schemas.
- Require `studentId` for ordinary users. Permit tenant-wide listing only to dedicated administrative/reporting capabilities.
- Apply teacher assignment, guardian-child, branch, and role object scopes where portal access is intended.
- Add cursor pagination, page-size limits, stable ordering, and minimal response projections.
- Exclude internal notes unless the caller has the specific capability.
- Add a correction/reversal endpoint instead of destructive history editing.

### Stage 6 — Replace the placeholder tests

- Add PostgreSQL integration tests for successful creation, prior-row closure, compatibility projection, rollback on failure, date validation, and audit emission.
- Add two-tenant tests proving cross-tenant student/session/class references are rejected and never disclosed by GET.
- Add concurrent POST tests proving only one current row survives.
- Add promotion and transfer tests proving history is written and predecessor links are correct.
- Add backfill tests for clean, duplicate, missing-year, and cross-tenant cases.
- Add role/object-scope tests for admin, assigned teacher, unrelated teacher, linked parent, unrelated parent, accountant, receptionist, and guard.
- Keep the route-discovery tenant-isolation suite passing.

### Stage 7 — UI and observability enhancements

- Add a read-only placement timeline to the student profile with year, class/section, status, effective dates, source transition, and actor.
- Add an administrator correction workflow requiring reason and previewing downstream schedule/fee effects.
- Add metrics for missing current placement, duplicate/overlap prevention, backfill exceptions, and projection mismatches without exposing student PII.

## Exit gates for Phase 2

Phase 2 may return to **100% / green** only when:

- The new invariant migration is applied and verified.
- Backfill/reconciliation reports zero unresolved active-student mismatches or explicitly approved exceptions.
- Admission, manual placement, promotion, and transfer all use the shared transactional service.
- Cross-tenant and object-scope tests pass.
- Concurrent transitions cannot create two current rows.
- Effective-date overlap tests pass.
- The full TypeScript, lint, PostgreSQL integration, security, and tenant-isolation suites pass with zero skipped release-gate tests.
- The implementation plan and roadmap contain only evidence-backed completion claims.
