# AUD-RECEPTION-01 — Route inventory (receptionist / front desk)

Derived from `src/libs/api/portal-manifest.ts` (`FULL_NAVIGATION` +
`filterByPermission`) and the receptionist default capabilities in
`src/libs/api/permissions.ts` (`DEFAULT_ROLE_PERMISSIONS.receptionist`,
lines 360-389), cross-checked against the page guards.

Teacher-style nav filtering: the `reception` group is `portalHome: true` and
is the only portal home the receptionist matches, so `getPortalManifest`
drops the generic `dashboard` item and `resolveLandingPath` lands the role on
`/dashboard/receptionist`.

## Tier 1 — reception portal proper (the campaign core)

| # | Route | Capability gate (page = nav) | APIs used | Purpose |
|---|---|---|---|---|
| 1 | `/dashboard/receptionist` | `reception.portal.use` | `/api/reception/me/home`, `appointments`, `visitors`, `handoffs`, `lookup`, `verifications` | Front-desk home: KPI counters, today's appointments (check-in/complete/cancel), on-site visitors, quick lookup, open handoffs |
| 2 | `/dashboard/receptionist/inquiries` | `reception.inquiry.manage` | `/api/reception/inquiries` (+`/[id]/follow-ups`) | Walk-in/phone inquiry intake with duplicate detection |
| 3 | `/dashboard/receptionist/appointments` | `reception.appointment.manage` | `/api/reception/appointments` (+ transitions, reschedule, `[id]` history), `/api/reception/staff` | Appointment book and lifecycle |
| 4 | `/dashboard/receptionist/visitors` | `reception.visitor.manage` | `/api/reception/visitors` (+ check-in/out/pass), `/api/reception/gates`, `/api/reception/staff` | Visitor sign-in, pass issuance, gate check-in/out |
| 5 | `/dashboard/receptionist/pickups` | `reception.portal.use` (page) / `reception.pickup.release` (data+actions) | `/api/reception/pickups/*` | Student release at the front desk — default-deny by design (see findings) |
| 6 | `/dashboard/receptionist/handoffs` | `reception.handoff.manage` | `/api/reception/handoffs` (+ acknowledge/resolve/cancel) | Front-desk task handoffs to admissions/finance/teacher/admin/security |

## Tier 2 — receptionist nav outside the portal (guard truth verified)

| Route | Gate | Result |
|---|---|---|
| `/dashboard/students` | `students.read` | FIXED — GET was 403 for the role (nav+guard promised it); now lists with a least-privilege projection |
| `/dashboard/students/parents` | `guardians.read` | Loads (200) |
| `/dashboard/transport` | `transport.read` + addon | Loads |
| `/dashboard/transport/allocations` | `transport.assignment.read` | Loads; React key warning logged (transport lane, out of scope) |
| `/dashboard/transport/incidents` | `transport.incident.read` | Loads |
| `/dashboard` | no permission | Redirects to `/dashboard/receptionist` (correct landing) |

## Deep links reachable by capability but not in the nav (spot-checked)

- Hostel front-desk ops (`hostel.read`/`hostel.supervision.*`): API-level access
  exists; no nav entry, not deep-audited (hostel lane).
- Inventory counter sales (`inventory.sell`), broadcast read (`broadcast.read`):
  not in the manifest nav; not deep-audited (their lanes).
- `/dashboard/receptionist/pickups` children (`authorizations/[id]/cancel`,
  `release`, `students*`) all require `reception.pickup.release` (default-deny).

## Runtime inventory verification (schoolos_audit, accueil@atlas.ma)

Sidebar renders: Élèves & Profils, Parents & Tuteurs, Accueil & Réception
(Accueil du portail, Renseignements, Rendez-vous, Visiteurs, Retraits,
Transferts & tâches), Transport Scolaire. No finance/HR/academics entries.

Forbidden probes (all correctly denied): `/api/finance/invoices`,
`/api/hr/employees`, `/api/guard/me/gate`, `/api/teachers`.
