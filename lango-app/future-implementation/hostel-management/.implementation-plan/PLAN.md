# Hostel Management — Implementation Plan

Read the shared context, `HOSTEL-MANAGEMENT-ADDON.md`, and the reference-solutions document. Build natively; external systems are behavioral references only.

## 1. Dependencies and scope

Phase 1 can begin after HR exposes stable employee/warden IDs. Allocation work must use the current session-scoped academic placement resolver. Finance remains authoritative for charges; Attachments Book remains authoritative for files when enabled.

Version 1 includes policy/ADR, physical inventory, allocation lifecycle and essential nightly supervision. Welfare/facilities and analytics follow only after allocation is live-proven.

## 2. Policy ADR before code

Record configurable decisions for eligibility, gender/age restrictions, consent, visitor/leave approval, roll-call escalation, retention, safeguarding access, emergency departure and charges. Rules are tenant settings—not universal legal assumptions.

## 3. Model

Create a feature schema containing hostels, zones, categories, rooms, beds, applications, allocations and immutable allocation events. Add roll-call registers/entries and leave passes/approval/return events for v1. Later tables cover visits, incidents/restricted notes, inspections, maintenance/SLA/downtime and charge links.

Use PostgreSQL range/exclusion guarantees plus transactions so:

- one bed has no overlapping reserved/checked-in allocations;
- one student has no overlapping active allocations;
- a transfer closes source and opens destination atomically.

Current occupancy is derived from allocations and usable bed status. Cached counts are projections only.

## 4. Services, APIs and UI

APIs under `/api/addons/hostel/` for master data, beds/board, applications, allocation preview/commit, check-in/out/transfer, roll call, leave/return, Tonight view and reports. Every operation validates tenant, branch, entitlement and referenced student/employee ownership.

Pages under `/dashboard/hostel/`:

- Tonight command center
- Hostels and zones
- Room/bed board
- Categories
- Applications and allocation workspace
- Allocation/history reports
- Roll call
- Leave/return passes
- Later: visitors, incidents, inspections, maintenance and analytics

Resident/guardian self-service must return only the requesting person's/child's records and never roommate or safeguarding details.

## 5. Delivery

0. Policy/safeguarding ADR and permission matrix.
1. Hostel/zone/category/room/bed inventory and capacity board.
2. Applications, allocation preview/commit, transfer, check-in/out and reports.
3. Roll call, leave/return, escalation and Tonight dashboard.
4. Visitor/welfare/facilities integrations.
5. Forecasting, retention/export jobs and PWA/offline work.

Agents should stop after phase 3 for v1 unless phase 4/5 is explicitly authorized.

## 6. Acceptance

- Real concurrent allocation tests prove bed and student overlap prevention.
- Failed transfer rolls back both sides; successful transfer preserves a complete timeline.
- Out-of-service changes enumerate affected residents before confirmation.
- Roll-call and overdue escalations are idempotent and separate from academic attendance.
- Emergency checkout is never blocked by Finance failure.
- Guardian/resident APIs cannot expose roommates, other visitors or welfare data.
- Disabling Hostel leaves student, guardian, Finance and attendance workflows intact.
- Two-tenant/branch sweep, migration rerun, Docker build/migrate, TypeScript and isolation checks pass.

