# Student Transport Add-on Implementation Plan

## 1. Current-State Inventory
- Core DB schema (`src/models/Schema.ts`):
  - `students`, `guardians`, `studentGuardians`, `users`, `branches`, `invoices`, `fee_structures`, `fee_assignments`, `receivables_ledger`, `notifications`, `tenants`, `addon_entitlements`.
- HR Add-on schema (`src/features/hr/models/hr-schema.ts`):
  - `hr_employees`, `hr_employee_profiles` (drivers and attendants derive from active HR employees).
- Security & Guard Portal schema (`src/features/guard/models/guard-schema.ts`):
  - Gate check-in, pickup release, incident logging.
- Attendance & QR Credentials (`src/features/attendance/models/attendance-qr-schema.ts`):
  - QR credentials and scan verification infrastructure.
- Attachments System (`src/features/attachments/models/attachments-schema.ts`):
  - Vehicle compliance document attachments and incident media attachments.
- Add-on system (`src/addons/registry.ts`, `src/libs/api/entitlements.ts`):
  - Addon ID: `transport`. Enabled toggle and entitlement check (`requireAddon(tenantId, 'transport')`).

## 2. Dependency Map
- **Core Students & Guardians**: Links student allocations and projects authorized guardians.
- **HR & Employees**: Provides driver/attendant identity without exposing sensitive HR fields (salary, national ID, bank details).
- **Finance Subsystem**: Integrates transport fees via `fee_structures` / `invoices` without duplicating accounting ledgers.
- **Attachments System**: Stores vehicle insurance, inspection, and permit document files.
- **QR / Attendance Credentials**: Verifies student identity badges for bus boarding/alighting.

## 3. Schema Plan (`src/features/transport/models/transport-schema.ts`)
- `transport_vehicles`: Fleet management, registration, capacity, status, compliance expiries.
- `transport_vehicle_documents`: Insurance, inspection, permit links to attachments.
- `transport_stops`: Canonical pickup/drop stops, coordinates, geofence, safety notes.
- `transport_routes`: Route identity, direction, active version, vehicle template, branch.
- `transport_route_versions`: Immutable route geometry, distance, duration, service calendar.
- `transport_route_stops`: Stop ordering, planned arrival/departure, dwell times per version.
- `transport_crew_assignments`: Effective-dated driver & attendant vehicle/route assignments.
- `transport_student_allocations`: Student route & stop allocations, directions, effective dates, segment capacity.
- `transport_trips`: Daily service instances, planned vs actual timing, vehicle/driver snapshots, status lifecycle.
- `transport_trip_roster_snapshots`: Immutable roster of allocated students per trip instance.
- `transport_rider_events`: Boarding and drop-off scans/edits, timestamp, stop, verification method, exception notes.
- `transport_incidents`: Transport delays, breakdowns, missed pickups, unauthorized pickups, resolution log.
- `transport_incident_actions`: Audit log of actions taken for each transport incident.
- `transport_fare_links`: Reference links to core finance invoices and fee structures.
- `transport_policies`: Transport policies and capacity margin configurations.

## 4. Migration Strategy
- File: `migrations/0082_student_transport.sql`
- Journal: `migrations/meta/_journal.json` -> entry `idx: 83`, `tag: "0082_student_transport"`.
- Idempotent DDL with `CREATE TABLE IF NOT EXISTS` and enum handling.

## 5. Permission & Entitlement Matrix
Addon ID: `transport`
Capabilities:
- `transport.read`
- `transport.route.manage`
- `transport.vehicle.manage`
- `transport.driver.manage`
- `transport.assignment.read`
- `transport.assignment.manage`
- `transport.trip.read`
- `transport.trip.manage`
- `transport.boarding.manage`
- `transport.incident.read`
- `transport.incident.manage`
- `transport.safeguarding.read`
- `transport.report`
- `transport.export`
- `transport.policy.manage`

Roles:
- `school_admin`, `super_admin`: Full access
- `teacher`: `transport.read`, `transport.trip.read`, `transport.boarding.manage`
- `receptionist`: `transport.read`, `transport.assignment.read`, `transport.incident.read`
- `guard`: `transport.read`, `transport.boarding.manage`, `transport.incident.manage`
- `parent`, `student`: Self-service identity-scoped queries (no staff permissions required).

## 6. Security & Threat Model
- Tenant isolation: Every table has `tenant_id`. API handlers validate both path resource ID and any foreign body IDs (`WHERE id = ? AND tenant_id = ?`).
- Role-based capabilities: Protected by `requireRequestContext`, `requireTenant`, `requireAddon`, and `requireCapability`.
- Self-service privacy: Guardians only see linked children; students only see their own assignments/trips. No other student data or driver PII leaked.
- Idempotent events: Scan events, trip state transitions, and finance charges use idempotency keys.

## 7. State Machines
- **Vehicle Status**: `active` -> `maintenance` -> `out_of_service` -> `retired`
- **Route Status**: `draft` -> `active` -> `suspended` -> `archived`
- **Allocation Status**: `active` -> `suspended` -> `cancelled` (with waitlist support)
- **Trip Status**: `scheduled` -> `boarding` -> `in_progress` -> `completed` / `cancelled` / `failed`
- **Incident Status**: `open` -> `investigating` -> `resolved` -> `closed`

## 8. Phased Implementation Strategy
- Step 1: Permissions & Addon Registry (`src/addons/registry.ts`, `src/libs/api/permissions.ts`, `src/libs/api/portal-manifest.ts`, `src/components/shared/sidebar.tsx`).
- Step 2: Drizzle Schema & Hand-written Migration (`src/features/transport/models/transport-schema.ts`, `src/models/Schema.ts`, `migrations/0082_student_transport.sql`).
- Step 3: Core Domain Helpers & Pure Validation Logic (`src/features/transport/services/transport-service.ts`).
- Step 4: Staff & Operational API Routes (`/api/transport/*`).
- Step 5: Self-Service API Routes (`/api/transport/self-service/*`).
- Step 6: UI Dashboard Pages (`/dashboard/transport/*`, `/dashboard/transport/guardian`, `/dashboard/transport/student`).
- Step 7: Automated Test Suite & Acceptance Verification (`scripts/test-student-transport.ts`, `scripts/check-tenant-isolation.ts`, `npx tsc --noEmit`).
- Step 8: Documentation & Manual Testing Guide (`future-implementation/student-transport/MANUAL-TESTING.md`).

## 9. Shared-File Collision Avoidance
Inspect shared files immediately before modifying:
- `src/models/Schema.ts` (barrel export only)
- `migrations/meta/_journal.json` (append entry idx 83)
- `src/libs/api/permissions.ts` (add permission keys & role mappings)
- `src/libs/api/portal-manifest.ts` (add nav item)
- `src/components/shared/sidebar.tsx` (add sidebar menu)
- `src/addons/registry.ts` (set `enabled: true` for `transport`)
