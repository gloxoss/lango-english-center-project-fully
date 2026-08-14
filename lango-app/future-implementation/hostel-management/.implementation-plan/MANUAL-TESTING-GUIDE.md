# Hostel Management — Manual Testing Guide (T1–T13)

Full manual test run for the Internat (Hostel) add-on, phases 0–3. Run in order.
Each test records a pass/fail in the checklist at the end. Use realistic Moroccan
mock data — never "John Doe" placeholders.

**Scope note:** Phases 4–5 (WhatsApp automation wiring, billing engine, dashboards)
are intentionally NOT implemented. Tests below validate the implemented surface only.

---

## Automated regression suite (recorded evidence)

The audit ("A written unchecked checklist is not verification") is answered by a
real, DB-backed Vitest suite plus a migration idempotency script. Both were run
against the live local PostgreSQL and are reproducible with the exact commands
below.

**Suite:** `src/features/hostel/__tests__/hostel-audit.test.ts` — 16 tests, one per
hardened invariant, seeding two real tenants (never mocks). Skipped unless
`DATABASE_URL` is set. Run:

```
DATABASE_URL=postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos \
  npx vitest run src/features/hostel/__tests__/hostel-audit.test.ts
```

**Result (2026-08-08): 16/16 passing.** Covered invariants:

| # | Automated test | Proves |
|---|---|---|
| 1 | Transfer to a free bed | same-day source closes at `start+1` (CHECK-safe), dest checked_in with `sourceAllocationId` |
| 2 | Transfer to an occupied bed | `409 TRANSFER_BLOCKED`, source unchanged (atomic rollback) |
| 3 | Second checkout of the same allocation | idempotent no-op, exactly 1 `checked_out` event + 1 charge link |
| 4 | Two concurrent checkouts | `Promise.allSettled` both fulfill; exactly 1 event + 1 charge link (only the winner posts finance) |
| 5 | Bulk commit, tenant-B student | `422 STUDENT_NOT_FOUND`, whole batch aborted, zero rows |
| 6 | Commit application vs different student | `422 APPLICATION_STUDENT_MISMATCH` |
| 7 | Allocation outside application window | `422 APPLICATION_DATE_MISMATCH` |
| 8 | Same-day checkout | end date `= start+1`, satisfies the `end > start` CHECK |
| 9 | Foreign `sessionYearId` / `preferredRoomId` / `preferredCategoryId` | `422 INVALID_*` per field |
| 10 | Leave-pass self-service allowlist | never exposes `reason` or `createdById` |
| 11 | Two concurrent `emitCharge` | distinct invoice ids + numbers (tenant-scoped atomic `namingSeries` upsert) |
| 12 | Two concurrent leave approvals | exactly 1 approval row, one `ALREADY_DECIDED` |
| 13 | Double check-in | exactly 1 `checked_in` event (idempotent) |
| 14 | Double cancel of a reservation | idempotent, both calls return `cancelled` |

**Migration:** `scripts/verify-hostel-0076.mjs` applies
`migrations/0076_hostel_management.sql` block-by-block **twice** and inventories the
result. Result (2026-08-08): PRE 16/16 tables, 12/12 constraints, `btree_gist` 1 row,
both enums present; PASS 1 OK; PASS 2 (re-run) OK — fully idempotent, constraints are
created with catalog-existence checks and **never** DROP+ADD'd.

**Type check:** `npx tsc --noEmit` → 0 errors under `src/features/hostel/**`.
(3 pre-existing errors remain under `src/features/inventory/services/sales-service.ts`,
out of hostel scope and owned by a parallel agent — see T1 note.)

---

## T1 — Preflight & Environment

**Prerequisites**
- [ ] PostgreSQL running on `localhost:5432`, database `schoolos` reachable via the `DATABASE_URL` in `.env`.
- [ ] Migration applied: `node -e` block-check on `migrations/0076_hostel_management.sql` runs with **0 real failures** and is re-runnable (idempotent). Confirm the 16 `hostel_*` tables, the enum `hostel_allocation_state`, and the two GiST EXCLUDE constraints `hostel_allocations_bed_no_overlap` + `hostel_allocations_student_no_overlap` exist.
- [ ] `btree_gist` extension present: `SELECT extname FROM pg_extension WHERE extname='btree_gist';` → 1 row.
- [ ] Dev server runs: `npm run dev` (or `npm run dev:next`), no hostel-related compile error in the terminal.
- [ ] The tenant has the `hostel` add-on entitlement enabled (Super Admin → Abonnements & Tarifs → Plans & Modules, or directly via `entitlements` table). Without it every hostel API returns `403 ADDON_NOT_ENABLED`.
- [ ] Seeded students exist under the test tenant (use the existing Students module). Record at least 4 student names for use in T8–T10.

**Expected:** All above green. TypeScript check for `src/features/hostel/**` reports 0 errors (`npx tsc --noEmit` — ignore pre-existing errors under `src/features/inventory/**`, `src/features/settings/**`, `src/features/guard/**` which are out of hostel scope).

---

## T2 — Login & Role-Gated Navigation

Log in with each role listed below and check the sidebar **Modules Établissement** group.

| Role | Internat section visible? | Self-service link |
|---|---|---|
| `school_admin` | ✅ full section (Ce soir → Rapports) | none |
| `teacher` (with `hostel.read`) | ✅ full section | none |
| `receptionist` (has `hostel.read`, `hostel.allocation.read`, `hostel.supervision.*`) | ✅ section, but **Affectations** item hidden (no `hostel.allocation.manage`) | none |
| `student` | ❌ section hidden (no `hostel.read`) | ✅ **Mon Internat** (`/dashboard/hostel/me`) |
| `parent` | ❌ section hidden | ✅ **Internat de mon enfant** (`/dashboard/hostel/guardian`) |
| `guard` | ❌ everything | ❌ |

**Steps**
1. Log in as `school_admin`. Expand **Modules Établissement** → **Internat**. Verify all 12 sub-items render: Ce soir, Résidences, Zones, Catégories, Chambres & Lits, Occupancy, Applications, Affectations, Appel du soir, Sorties, Politiques, Rapports.
2. Click **Ce soir** → URL becomes `/dashboard/hostel`. The item is highlighted with the active background.
3. Log in as `receptionist`. Verify **Affectations** is absent from the Internat menu, and that a manual visit to `/dashboard/hostel/allocations` shows a clear permission-limited message (never a silent blank page).
4. Log in as `student`. Verify the Internat parent menu is absent and **Mon Internat** appears as a standalone item. Click it → `/dashboard/hostel/me`.
5. Log in as `parent`. Verify **Internat de mon enfant** appears and opens `/dashboard/hostel/guardian`.

**Expected:** Every role sees exactly the items its permission set allows; forbidden manual URLs give a role-aware error, not a generic 403 and not a working page.

---

## T3 — Résidences (Hostels) CRUD

**Steps**
1. Internat → **Résidences**. Create a residence:
   - Code: `RES-MEKNES`, Name: `Résidence Al Khayma`, Gender policy: `mixed`, Age range: 14–18, Curfew: `21:30`, Roll-call time: `21:00`, Assembly point: `Cour principale`.
   - Save → success toast; row appears.
2. Create a second residence `RES-CASA` (name `Résidence Anfa`, gender `girls`).
3. Edit `RES-MEKNES` (change phone, set curfew to `22:00`) → save → row reflects change.
4. Try to create a duplicate code `res-meknes` (case-insensitive) → **409** with a clear message ("code déjà utilisé").
5. Deactivate `RES-CASA` (status → `inactive`) → disappears from the active list on **Ce soir**, still visible in Résidences with an `inactive` badge.

**Expected:** CRUD works; duplicate code rejected; the Bed Board / Tonight only ever show active residences.

---

## T4 — Zones CRUD

**Steps**
1. Internat → **Zones**. Create under `RES-MEKNES`:
   - `BLOC-A` (building, curfew 21:30, roll-call 21:00) → `A-1` (floor, parent `BLOC-A`) → `A-1-EST` (wing, parent `A-1`).
2. Verify the parent picker only offers zones of the same hostel.
3. Set `BLOC-A` curfew → verify child zones inherit/override correctly in the zone list.
4. Attempt to set a zone's parent to a zone of a **different hostel** → rejected (410/422 with message).
5. Deactivate `A-1-EST` → bed/room dropdowns in T6 no longer offer it.

**Expected:** Tree structure enforced; cross-hostel parentage rejected; deactivation propagates to pickers.

---

## T5 — Catégories (Room Categories) CRUD

**Steps**
1. Internat → **Catégories**. Create:
   - `STANDARD` — capacity 4, gender `mixed`, base charge `1800.00` MAD, deposit `500`, priority 10.
   - `PREMIUM` — capacity 2, gender `girls`, base charge `3200.00`, deposit `1000`, priority 20.
2. Verify charge fields validate as decimals (enter `abc` → inline error; enter `2500.5` → accepted).
3. Edit `STANDARD` → capacity 3 → save.
4. Duplicate code → rejected.
5. Deactivate `PREMIUM` → unavailable when creating rooms in T6.

**Expected:** Validation (2-decimal money regex), duplicate rejection, lifecycle works.

---

## T6 — Chambres & Lits (Rooms + Beds) CRUD

**Steps**
1. Internat → **Chambres & Lits**. Create room:
   - Hostel `RES-MEKNES`, Zone `BLOC-A`, Category `STANDARD`, Code `R-101`, Name `Chambre 101`.
2. Repeat for `R-102`, `R-103`, `R-201` (zone `A-1`).
3. In the room list, verify each row shows the joined zone and category names.
4. Select `R-101` → add 4 beds `L1`…`L4` (all `active`).
5. Add a 5th bed → service rejects because it exceeds category capacity (or show a warning) — confirm behaviour matches the plan (capacity cap).
6. Add one bed `L5` to `R-102` and mark it `out_of_service` → verify the Bed Board in T7 renders it gray and it is NOT offered by the allocation pickers.
7. Edit a bed code → save; try duplicate code within the same room → rejected.

**Expected:** Two-panel UX (rooms list + bed panel) works; capacity and code-uniqueness enforced; status toggling respected everywhere downstream.

---

## T7 — Bed Board / Occupancy

**Steps**
1. Internat → **Occupancy**, pick `RES-MEKNES`.
2. Before any allocation: every active bed renders **free** (white), out-of-service beds gray, and the summary shows 0 occupied / N free.
3. After T9 creates reservations/check-ins, reload → occupied beds green (**checked_in**) or amber (**reserved**), matching the allocation state.
4. Verify counts reconcile with the allocations table (occupancy is **derived** from effective-dated allocations — never a manual counter).

**Expected:** Board always mirrors allocation state; no stale counter; filters by hostel.

---

## T8 — Applications (Waiting List)

**Steps**
1. Internat → **Applications** tab. Create 3 applications for recorded students:
   - `app-A`: student 1, requested start = next week, end = end of school year.
   - `app-B`: student 2, same period, preferred room `R-101`.
   - `app-C`: student 3, same period.
2. Approve `app-A` and `app-B` (decision → `approved`). Verify a decision reason is required or optional per policy; verify the applicant status chips update.
3. Deny `app-C` → moves to a `denied` list with the reason visible to staff only.
4. Apply `waitlisted` to a fresh application → confirm it reappears in the default view.

**Expected:** Status transitions render instantly; denied/waitlisted items filter correctly; the decision timestamp + actor are stored.

---

## T9 — Affectations (Allocations): Preview, Commit, Conflicts

**Steps**
1. Internat → **Affectations** tab. Open **Single affectation**.
   - Student `app-A` → bed `R-101/L1`, start = 2026-09-01, end = 2027-06-30 → **Preview** → `eligible: true`.
   - Commit → row appears with state `reserved`.
2. **Overbooking (bed) must fail**: same bed `R-101/L1`, student `app-B`, overlapping dates → Preview shows `eligible: false` with reason (e.g. "lit déjà occupé"); force commit → **409 ALLOCATION_CONFLICT** (the GiST `bed_no_overlap` exclusion). Confirm both allocations are unchanged afterward (no partial write).
3. **Double-allocation (student) must fail**: student `app-A`, a different bed `R-102/L5`, overlapping dates → **409 ALLOCATION_CONFLICT** from `student_no_overlap`. Same rollback check.
4. Non-overlapping (back-to-back) dates on the same bed: end 2026-06-30 / start 2026-07-01 → allowed (half-open `[start,end)` ranges).
5. **Bulk affectation is all-or-nothing**: 3 rows at once in a single transaction — a cross-tenant or unknown student (or unknown bed) aborts the **whole batch** with `422` and nothing is written. A batch of all-valid rows commits atomically (verified by the automated suite: tenant-B student on a tenant-A bed → `422 STUDENT_NOT_FOUND`, zero rows).
6. Try to allocate to a bed whose category gender policy conflicts with the student, or whose hostel age range excludes the student → eligibility reasons list the specific failure.

**Expected:** Both exclusion constraints are enforced at the DB level and surfaced as a friendly `ALLOCATION_CONFLICT` error; eligibility explains *why* with reasons; occupancy stays derived.

---

## T10 — Allocation Lifecycle: Check-in, Transfer, Check-out

**Steps**
1. On a `reserved` allocation (T9), open its detail page → **Check-in**.
   - State becomes `checked_in`, `checkedInAt` recorded, a `checked_in` event appears in the timeline.
2. **Transfer** (atomic close + open): open the same allocation → **Transfer** to bed `R-102/L5`, effective today.
   - Verify source allocation is now `checked_out` (or `cancelled`) and a NEW allocation exists on `R-102/L5` in the same effective state (`checked_in`), with `sourceAllocationId` pointing at the old one.
   - Verify the timeline shows the transfer event and both sides are consistent (no orphan, no double-active on the student).
   - **Same-day transfer**: when the transfer happens on the day the stay starts, the source ends at `start+1` (never `start`), so the `effective_end_date > effective_start_date` CHECK always holds — a transfer **succeeds** (it was previously always a `409` because the source counted itself in the student-overlap check; now the source is excluded and the locked row is re-validated under the transaction).
3. **Transfer rollback test**: attempt a transfer to an occupied bed → **409**; confirm BOTH the source and the destination allocations are unchanged (atomicity — no partial close+open). The source row is locked `.for('update')` so concurrent transfers/checkouts serialize; a stale state re-check under the lock rejects the loser.
4. **Check-out** on the transferred allocation with **finance in order**:
   - Normal path: state → `checked_out`, `checkedOutAt` set.
   - **Same-day check-out**: check out the same day the stay starts → end date `= start+1`, satisfying the CHECK (verified automatically).
5. **Emergency departure on finance failure** (the plan's hard guarantee): create a fresh allocation, check it in, then check out with the finance simulation flag:
   - In the allocation detail UI, use the **Départ d'urgence** path (the button that sends `simulateFinanceFailure: true`).
   - Expected: the check-out **succeeds despite a simulated finance failure** — the student is never blocked in the building because of billing.
   - Verify the event timeline records the emergency departure reason.
   - The finance post happens **after** the atomic state claim, so only the winning caller ever posts — no duplicate invoice under a crash/retry.
6. **Idempotency + concurrency**: check out an already-checked-out allocation again → idempotent no-op returning the `checked_out` row (not an error). Two staff checking out the same allocation at once → both calls succeed but exactly **one** `checked_out` event and exactly **one** charge link are created.

**Expected:** State machine is strict; transfers are atomic (all-or-nothing); finance failure never blocks a departure.

---

## T11 — Appel du soir (Roll Call)

**Steps**
1. Internat → **Appel du soir**, pick `RES-MEKNES`. Open a roll call for today.
2. Verify the roster is exactly the set of checked-in allocations (residents) for that hostel on that date.
3. Mark: 1 present, 1 `late`, 1 `missing`, 1 `approved_leave` (student on a leave pass — see T12), 1 `sick`.
4. Save entries → reload the detail → statuses persist.
5. Close the roll call. Verify:
   - Re-opening for the same hostel+date is rejected (unique `(tenant,hostel,call_date)`).
   - **Ce soir** (Tonight) screen now shows the recorded roll-call summary (present / on leave / missing / unaccounted) and raises a `missing_rollcall` escalation for the missing student.
6. Leave the `sick` and `missing` entries unaccounted and run the escalations engine (see T13) → confirm an escalation row is created for the missing student.

**Expected:** Roll call is independent of academic attendance; roster = residents only; close is idempotent; tonight summary + escalations reflect the data.

---

## T12 — Sorties (Leave Passes) + Returns

**Steps**
1. Internat → **Sorties**. Create a leave pass for a checked-in resident:
   - Start now, expected return tomorrow, destination `Casa`, reason `Week-end famille`.
   - Save → state `pending`.
2. Approve it as warden (`decision: approved`, `approverRole: warden`). Verify the approval row + approver role is stored.
   - **Concurrent approval race**: two staff approving the same pending pass at once → the pass row is locked `.for('update')`; exactly **one** approval row is created and one caller gets `409 ALREADY_DECIDED` (verified automatically).
3. Verify the **Appel du soir** roster shows this student as `approved_leave` / on leave tonight.
4. Mark the return (`POST /leave-passes/{id}/return`) → `actualReturnAt` recorded, state `returned`; the Tonight screen no longer counts the student as on-leave.
   - **Return idempotency**: re-submitting the return is a no-op — the `(tenant, leave_pass)` unique return row plus a conditional state flip prevent double-recording.
5. **Overdue return**: create + approve a pass that should have returned yesterday, leave it unreturned → Tonight summary flags `overdue_return` and the escalations engine (T13) produces an escalation.
6. Negative: deny a pass → confirm the resident cannot present an approved pass (state `denied`); attempt to create a leave pass for a student with **no active allocation** → rejected with a clear message.

**Expected:** Full lifecycle (pending → approved/denied → returned); approvals recorded; overdue detection works; leave pass requires a real checked-in/reserved allocation.

---

## T13 — Self-service, Policies, Reports, Escalations, Tenant Isolation

### 13.1 Resident self-service (`/dashboard/hostel/me`)
- [ ] Log in as the student who has an allocation. Page shows their current stay (bed, room, hostel), tonight's roll-call status, and their leave passes.
- [ ] Student submits a leave request → appears in the staff Sorties list as `pending`.
- [ ] Student attempts to read **another** student's data (craft the URL/param) → no leak, 403/404.

### 13.2 Guardian self-service (`/dashboard/hostel/guardian`)
- [ ] Log in as the parent of a resident. Page shows only that child's stay + leave passes.
- [ ] **Redaction check (safeguarding):** the guardian response must NOT include roommates, allocation reason notes, or safeguarding-sensitive fields. Compare against the `hostel.safeguarding.read` gate — guardians never get sensitive reasons. `listLeavePassesForSelf` is allowlisted to `destination`/status/dates and **never** returns `reason` or `createdById` (regression-covered by the automated suite).
- [ ] Parent of a non-resident child sees `enrolled: false` and a clear empty state.

### 13.3 Policies (`/dashboard/hostel/policies`)
- [ ] As `school_admin`: edit policy (e.g. `leavePassMaxHours` to 24, toggle `visitorPreApprovalRequired`, set `majorityAge`) → save → version bumps.
- [ ] Reload → persisted.
- [ ] As `receptionist` or `teacher` (no `hostel.policies.manage`): page/API returns a permission-limited error.
- [ ] Verify the policy actually gates a behaviour: e.g. with `leavePassRequiresDestination = true`, a leave pass without a destination is rejected.

### 13.4 Reports (`/dashboard/hostel/reports`)
- [ ] **Occupation** tab: same data as Bed Board, export CSV → file downloads with rows per bed/room.
- [ ] **Affectations** tab: filter by state (`reserved`, `checked_in`, `checked_out`) and by hostel → CSV export matches the on-screen rows.

### 13.5 Escalations engine
- [ ] Run `POST /api/addons/hostel/escalations/run` (staff with `hostel.supervision.manage`).
- [ ] With a `missing` roll-call entry and/or an overdue leave pass from T11/T12, confirm escalation rows are created with correct `tier`, `recipientType`, `channel`, and a stable `idempotencyKey`.
- [ ] Re-run → **no duplicate escalation rows** (idempotency holds).
- [ ] Acknowledge one escalation → `acknowledgedAt` + actor recorded.

### 13.6 Tenant isolation (two tenants)
- [ ] Create residence `RES-MEKNES` under tenant A and `RES-ANFA` under tenant B (two schools).
- [ ] Log in as tenant A admin → B's residences are invisible; `GET /api/addons/hostel/hostels` returns only A's rows.
- [ ] Attempt `GET /api/addons/hostel/allocations?bedId=<B-bed>` → returns empty/404, never B's data.
- [ ] Attempt to transfer/check-in an allocation belonging to tenant B from tenant A's session → 403/404.
- [ ] Confirm the audit trail recorded the hostel actions (reminder batches pattern: `triggeredById` + timestamps).

### 13.7 Audit trail
- [ ] Open Settings → Tâches & Audit (or the audit API) and confirm `create/update` audit rows exist for the hostel CRUD + allocation actions performed above, tagged with the acting user.

---

## Regression / design-conformance sweep

- [ ] **Loading:** every data screen shows a skeleton matching its layout (no bare spinner on tables/dashboards).
- [ ] **Empty:** an empty hostel, empty zone list, empty allocation list each show a specific next action (e.g. "Create a residence"), never a blank void.
- [ ] **Error:** an invalid form (bad money, duplicate code, overbooked bed) shows an inline, specific, actionable message.
- [ ] **Success:** fast actions (roll-call submit, check-in) confirm via toast; slower ones via inline status change.
- [ ] **Conflict:** destructive actions (delete residence/zone, reject leave, emergency checkout) require a two-step confirm — the destructive button only turns solid after the dialog opens.
- [ ] **Permission limited:** every role doing something outside its matrix sees a role-aware message, never a silent no-op.
- [ ] **Design tokens:** no gradients, no decorative shadows, no zebra tables (hairline dividers), no floating form labels; primary `#2487B8`; Automation Cyan `#0EA5C4` appears **only** on the automation trigger surface (none expected in this phase — grep the hostel screens to confirm it is absent).
- [ ] **Arabic RTL:** switch locale to Arabic; verify the Internat screens mirror correctly (layout flip, not just translated strings) and remain legible.

---

## Checklist summary

| # | Area | Result (✅/❌/N/A) | Notes |
|---|---|---|---|
| T1 | Preflight & environment | | |
| T2 | Role-gated navigation | | |
| T3 | Résidences CRUD | | |
| T4 | Zones CRUD | | |
| T5 | Catégories CRUD | | |
| T6 | Chambres & Lits CRUD | | |
| T7 | Bed Board / occupancy | | |
| T8 | Applications | | |
| T9 | Affectations + conflicts | | |
| T10 | Allocation lifecycle + emergency | | |
| T11 | Appel du soir | | |
| T12 | Sorties + returns | | |
| T13 | Self-service / policies / reports / escalations / isolation | | |
| T-Auto | Automated regression suite (16/16 passed 2026-08-08) + migration idempotency + tsc hostel-scope clean | ✅ | See "Automated regression suite" section |
| — | Design conformance | | |
| — | RTL / Arabic | | |
