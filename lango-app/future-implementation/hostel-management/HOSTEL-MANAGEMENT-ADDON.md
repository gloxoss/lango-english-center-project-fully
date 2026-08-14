# Hostel Management Addon Plan

**STATUS: IMPLEMENTED** — see `future-implementation/_tracker/PLANS-AUDIT-AND-PROGRESS.md`
(#28) for verified details. Migration `0076`, `hostel-schema.ts` (16 tables), full API
+ 15 UI views, allocation/eligibility/escalation/tonight services, `hostel-audit.test.ts`
(482 lines), addon `enabled:true` in `src/addons/registry.ts`. Phases 0–3 done; visitors,
incidents, inspections, maintenance (phases 4–5) deferred by design, not gaps.
Addon ID: `hostel`  
Scope: Hostel Master, Hostel Room, Category, Allocation Report, resident supervision and operations

## Product decision

Build a student-residence operations system, not only a room list. Its source of truth is an effective-dated bed allocation plus immutable movement/events. Current occupancy is derived from active allocations; it is never a manually edited counter.

The addon is independent from Transport. It reuses core tenants, branches, students, guardians, staff, audit, communication and finance through IDs and APIs, without duplicating their records.

## Pages

### Hostel Master

- Residences/buildings with branch, code, address, gender/age policy where legally and operationally appropriate, manager/warden, emergency contacts, capacity, active state and rules.
- Floors/wings/zones, curfew/roll-call policy, visitor hours, charge policy and emergency assembly point.
- Occupancy dashboard: available/reserved/occupied/out-of-service beds, arrivals/departures, overdue returns, open incidents and maintenance blockers.

### Hostel Room and bed board

- Rooms with building/floor/wing, category, capacity, accessibility, facilities, status and responsible staff.
- Explicit numbered beds; room capacity equals usable beds, not a free-form number.
- Visual floor/room board with occupancy, reserved, cleaning, maintenance and isolation/out-of-service states.
- Bed detail: allocation timeline, inspections and maintenance—never expose another resident's sensitive notes.

### Category

- Room/bed categories such as single/shared/accessibility, default capacity, amenities, eligible cohort, base charge, deposit, priority and active state.
- Referenced categories are archived, not deleted.

### Allocation workspace/report

- Search eligible students, requested dates/category/preferences, guardian contacts and conflicts.
- Capacity-safe reserve/check-in/transfer/check-out flow with preview and reason.
- Filters by session, building, category, class, status, date and fee state.
- Reports: occupancy/utilization, vacancy, allocation history, arrivals/departures, transfer history, demographic distribution only when lawful and necessary, charge reconciliation and exception lists.

### Resident supervision additions

- Nightly roll call/check-in with present, approved leave, late, missing, sick and excused states.
- Leave/return passes with guardian approval policy, destination, expected return, actual return and escalation.
- Visitor pre-approval/check-in/out with host resident, identity-minimized record and deny/watch rules with strict permissions.
- Welfare/incident cases with severity, safeguarding flag, assigned staff, actions, guardian-contact log and resolution. Sensitive notes use separate permissions.
- Inspections and maintenance requests with photos/files, priority, SLA, assignment and room/bed downtime.
- Announcements and emergency muster list with offline printable/exportable snapshot.

## Data model

- `hostels`: tenant, branch, identity/address, policy snapshot, warden, capacity cache, status.
- `hostelZones`: building/floor/wing/zone hierarchy.
- `hostelRoomCategories`: tenant policy, defaults, charges and eligibility.
- `hostelRooms`: hostel/zone/category, room code, status and attributes.
- `hostelBeds`: room, unique bed code, status and accessibility attributes.
- `hostelApplications`: student, requested period/category, preferences, priority, decision and reason.
- `hostelAllocations`: student, bed, effective start/end, state (`reserved`, `checked_in`, `checked_out`, `cancelled`), source application, operator and charge snapshot.
- `hostelAllocationEvents`: immutable reserve/check-in/transfer/check-out/cancel/correct events.
- `hostelRollCalls` and `hostelRollCallEntries`.
- `hostelLeavePasses`, approvals and return events.
- `hostelVisitors` and `hostelVisits` with retention policy.
- `hostelIncidents`, `hostelIncidentActions` and restricted safeguarding notes.
- `hostelInspections`, checklist responses and defects.
- `hostelMaintenanceRequests`, assignments, SLA events and downtime.
- `hostelChargeLinks`: references core fee/invoice lines; accounting remains in Finance.

Use database exclusion/transaction logic so one bed cannot have overlapping active/reserved allocations and one student cannot occupy multiple beds for overlapping dates unless an explicit transfer transaction closes the old allocation.

## Logic and safeguards

- Capacity and eligibility checks run at preview and commit under transaction/locking.
- Transfers create one atomic event: end current allocation, open destination allocation, preserve both histories.
- Check-out cannot silently erase unpaid/damage information; finance and incident references remain but do not block emergency departure.
- Bed/room out-of-service blocks new allocation and identifies affected residents before activation.
- Roll call never becomes academic attendance; it can create a supervision alert but remains a separate register.
- Missing/overdue workflows use configurable escalation tiers, acknowledgement and closure reason; SMS remains log-only until a real provider exists.
- Health, disability and safeguarding information is minimized, purpose-specific, encrypted where appropriate and access logged.
- Minors' visitor and leave flows require school-defined guardian consent; no universal legal assumption is hard-coded.
- Bulk allocation uses preview, deterministic rules, per-student outcomes and idempotency.

## Creative differentiators

- “Tonight” command center: expected residents, approved leave, overdue returns, unconfirmed roll call and staffing coverage.
- Capacity forecast by week/session with confirmed, reserved and forecast demand.
- Fair allocation explanation: show applied priority rules and manual overrides rather than opaque scoring.
- Room readiness checklist connecting check-out, inspection, maintenance and cleaning before the next resident.
- Guardian-safe portal showing only their child's allocation, leave requests, approved visitor/arrival events and notices.
- Resident self-service for maintenance, leave request and quiet-hours feedback without exposing roommates.
- QR badge scanning as an optional accelerator; manual/offline fallback is always available.

## Implementation phases

### Phase 0 - policy and safeguarding ADR

- Define residence eligibility, consent, visitor/leave, roll-call escalation, retention, charges, safeguarding access and emergency processes with school operators/legal counsel.
- Map integration to the planned session-scoped academic placement model.

### Phase 1 - physical inventory

- Add addon gating, hostel/zone/category/room/bed schema, CRUD, archive/status rules, tenant/branch scoping, audit and capacity board.

### Phase 2 - allocation lifecycle

- Add applications, effective-dated allocations, preview/commit, check-in/out, transfer, bulk allocation, conflict constraints and allocation reports.
- Integrate optional fee-structure/invoice references without implementing accounting inside Hostel.

### Phase 3 - daily supervision

- Add roll call, leave/return, overdue escalation, guardian approvals and Tonight dashboard with offline/print fallback.

### Phase 4 - welfare and facilities

- Add visitor log, incidents/restricted notes, inspections, maintenance/downtime, room readiness and Attachments Book references when enabled.

### Phase 5 - analytics and optimization

- Add utilization/forecasting, SLA/safety trends, anonymized planning insights, data export/retention jobs, restore tests and mobile/PWA scanning.

## Acceptance criteria

- Concurrent requests cannot overbook a bed or double-allocate a student.
- Transfers/check-in/out preserve a complete reproducible timeline.
- Branch and tenant isolation cover lists, exports, scans and attachments.
- Guardian/resident views cannot reveal roommate, visitor, welfare or incident data.
- Out-of-service transitions identify/relocate affected allocations safely.
- Roll-call escalation is idempotent and auditable.
- Finance references reconcile but Finance failure does not corrupt occupancy.
- Disabling Hostel leaves student, guardian, finance and attendance core workflows intact.

