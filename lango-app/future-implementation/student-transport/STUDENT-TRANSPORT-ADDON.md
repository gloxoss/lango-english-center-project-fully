# Student Transport Addon Plan

Status: planned optional addon, not built  
Addon ID: `transport`  
Scope: Route Master, Vehicle Master, Stoppage, Assign Vehicle, Allocation Report and live supervision

## Product decision

Lango owns school transport planning, student allocations, trips, boarding, guardian experience and safety workflows. GPS ingestion/routing/maps are provider adapters, not hard-coded infrastructure.

Static plans and actual operations are separate: route versions define intended stops/times; each service day creates trip instances and immutable operational events. “Current vehicle status” is a projection, never the only history.

## Pages

### Route Master

- Route identity, branch/depot, direction (`pickup`, `dropoff`, `shuttle`), service calendar, active version and assigned vehicle template.
- Ordered stop editor on a map, planned arrival/departure, dwell time, pickup side/safety notes, capacity forecast and route geometry.
- Draft/publish/archive versions; future edits never rewrite historical trips.
- Route duplication and optimization preview with before/after distance/time and explicit operator acceptance.

### Vehicle Master

- Registration, internal code, type, seated/standing capacity policy, make/model/year, ownership/vendor, GPS device reference, accessibility and active status.
- Compliance documents/expiry, insurance, inspection, permit, fuel/energy, odometer, maintenance plan and out-of-service state.
- Assigned drivers/attendants use staff/HR IDs; licenses and expiry belong to restricted staff/compliance records.

### Stoppage

- Canonical stop with name/code, coordinates, address, radius/geofence, landmark, accessibility and safety notes.
- Map pin plus geocoding confidence and manual verification.
- Stops are reusable; route versions own ordering and planned time.

### Assign Vehicle and crew

- Effective-dated vehicle/driver/attendant assignment to route/service, substitute workflow and conflict detection.
- Block double-booked vehicle/crew and capacity/compliance violations.
- Daily dispatch board supports substitutions without rewriting the route master.

### Student allocation

- Student, guardian-approved pickup/drop stops, effective period, direction, days, special assistance, status and fare reference.
- Capacity preview by route segment, not only total route count, because riders leave at different stops.
- Sibling suggestions and nearby-stop candidates are advisory and never silently change guardian choice.

### Allocation Report

- Route/vehicle/stop/student rosters, segment loads, unused/over capacity, unassigned students, pickup/drop exceptions and fee reconciliation.
- Driver/attendant manifest minimizes personal data and supports offline encrypted caching/expiry.

### Live Operations and Tracking

- Dispatch dashboard: not started, boarding, en route, delayed, paused, completed, cancelled, incident.
- Live map with last update age/accuracy, route adherence, ETA confidence and stale-device warning.
- Student boarding/alighting via QR/NFC/manual; duplicate/impossible sequences become review exceptions.
- Guardian view: their child's route/trip only, vehicle approach/ETA, boarded/alighted notification and delayed/cancelled notices.
- Incident/SOS workflow, breakdown replacement, missed stop/no-show, guardian acknowledgement and resolution log.
- Historical trip playback is restricted, time-limited and audited.

### Maintenance and compliance

- Service tasks, odometer/date schedules, defects, work orders, costs and downtime.
- Expiry dashboard blocks dispatch for configured critical compliance failures.
- Pre-trip/post-trip checklist with defects and acknowledgement.

## Data model

- `transportStops`: tenant/branch, coordinate/geofence, verified state, safety/accessibility metadata.
- `transportRoutes`: stable identity and service purpose.
- `transportRouteVersions`: immutable draft/published geometry, distance/duration and service calendar.
- `transportRouteStops`: version, stop, sequence, planned times, pickup/drop flags and dwell.
- `transportVehicles`: tenant/branch, capacity, attributes, compliance/status and external GPS device reference.
- `transportVehicleDocuments`, `transportMaintenancePlans`, `transportMaintenanceEvents`, `transportDefects`.
- `transportCrewQualifications` or references to HR addon documents.
- `transportServiceAssignments`: effective route/version, vehicle, driver, attendant and recurrence.
- `transportStudentAllocations`: student, route, pickup/drop stop, effective dates/days/directions, assistance and state.
- `transportTrips`: service date/direction, route-version snapshot, vehicle/crew snapshot, planned/actual lifecycle.
- `transportTripEvents`: immutable start/arrive/depart/delay/breakdown/complete/cancel events.
- `transportRiderEvents`: trip, student, stop, event (`boarded`, `alighted`, `absent`, `manual_correction`), source and actor/device.
- `transportPositionRefs`/summaries: external provider position ID or bounded normalized samples according to retention.
- `transportIncidents`, actions and notification acknowledgements.
- `transportNotificationOutbox`: event-driven delivery with idempotency and per-channel status.
- `transportFareLinks`: references core fee/invoice records.

## Tracking architecture

- Define `TrackingProvider`: provision/link device, fetch latest position, fetch bounded history, normalize webhook/event, verify signature and health.
- Recommended first provider: separately deployed Traccar. Lango stores its own vehicle-device mapping and normalized safety/business events; Traccar remains GPS protocol/telemetry infrastructure.
- Use signed webhooks/polling with idempotent external event IDs, replay protection, queue/retry and dead-letter repair.
- Map matching and ETA use a `RoutingProvider` adapter; route planning remains usable if routing/GPS is offline.
- Positions include provider time, receive time, accuracy and source. Never pretend stale GPS is live.
- Raw high-frequency location has short configurable retention; retain compact trip summaries/safety events longer.

## Logic and safety invariants

- Route changes create a new version; published/historical trip manifests do not mutate.
- One active assignment cannot double-book a vehicle or crew for overlapping service windows.
- Allocations validate stop membership and segment capacity transactionally.
- Only eligible active students and linked guardians can access trip information.
- Boarding events enforce trip/roster/stop relationships; manual correction appends an event with reason.
- “Bus arrived” alerts require geofence plus direction/state and hysteresis to prevent GPS jitter spam.
- No-show escalation distinguishes not allocated, approved absence, missed pickup and scan failure.
- Vehicle critical compliance/out-of-service blocks dispatch with a permissioned emergency override and reason, if policy permits.
- Driver interfaces are minimal, large-touch, offline capable and must not encourage interaction while driving; attendant handles scans where possible.
- Live location is shown only during relevant trip windows plus a short grace period.

## Creative differentiators

- Guardian “ready” signal before pickup, shown as advisory to attendant—not a dispatch blocker.
- Stop-level safe handoff policy for younger students: authorized receiver, one-time handoff code or staff confirmation.
- Segment capacity heatmap and “what-if” allocation preview.
- ETA confidence bands and transparent “last updated” rather than false precision.
- Route adherence and chronic delay heatmaps using aggregated/anonymized history.
- Offline encrypted trip manifest with queued scans and conflict reconciliation.
- Vehicle replacement wizard transferring the active manifest/crew while preserving both vehicle timelines.
- Emergency share link for authorized school responders, short-lived and fully audited.

## Implementation phases

### Phase 0 - safety/privacy/operations ADR

- Define consent, tracking visibility, retention, driver-device policy, handoff, no-show, SOS, compliance, mapping data and notification rules.
- Validate Morocco/local transport, employment, child-safety, insurance and data-protection requirements professionally.

### Phase 1 - route and fleet master

- Add addon gating, stops, versioned routes, vehicles, crew qualifications/references, service calendars, CRUD/maps and archive rules.
- Add Map/Routing provider interfaces with deterministic fake providers for tests.

### Phase 2 - assignments and allocations

- Add effective vehicle/crew assignments, student allocations, segment capacity, conflict previews, reports and finance references.
- Build dispatch-ready manifests and guardian allocation confirmation.

### Phase 3 - trips and rider events

- Generate idempotent daily trips, lifecycle/dispatch board, offline manifest, QR/NFC/manual boarding, corrections, no-show and notifications.

### Phase 4 - live GPS and guardian experience

- Integrate Traccar adapter, verified event ingestion, live map, geofences, ETA/routing, guardian self-scope, delay/breakdown/replacement and position retention.

### Phase 5 - fleet operations and intelligence

- Add inspections, maintenance/compliance, costs, utilization, route adherence, delay/safety analytics, optional OR-Tools optimization preview and operational runbooks.

## Acceptance criteria

- Concurrent allocations/assignments cannot exceed segment capacity or double-book fleet/crew.
- Route edits cannot change past or active trip snapshots.
- A guardian can see only linked children and only relevant active trips.
- Stale/spoofed/duplicate GPS and scan events are handled visibly and idempotently.
- Offline scans reconcile without duplicate boarding or lost corrections.
- Critical compliance policy blocks unsafe dispatch and records overrides.
- Tracking retention/purge, access logs and emergency-link expiry are tested.
- Finance/tracking/routing outages do not corrupt route/allocation/trip state.
- Disabling Transport leaves core students, attendance, finance and guardians intact.

