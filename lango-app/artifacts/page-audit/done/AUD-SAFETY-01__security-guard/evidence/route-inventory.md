# AUD-SAFETY-01 — Route & API inventory (Security / Guard / Entry Operations)

Discovered from `src/libs/api/portal-manifest.ts`, the route tree, page guards,
`src/libs/api/permissions.ts` and `src/features/guard/**`. No route names were
assumed: the module is substantial (7 pages, 35 API route files, 9 services,
16 tables), so the campaign proceeded.

## Pages (7) — `src/app/[locale]/(dashboard)/dashboard/portals/guard/**`

| # | Route | Page guard | Portal nav entry | Notes |
|---|---|---|---|---|
| 1 | `/dashboard/portals/guard` | `allowedRoles:['guard']` + `guard.portal.use` | guard-home (roles: guard) | Duty station home: shift/gate, expected visitors, active pickups, recent incidents |
| 2 | `/…/guard/scanner` | `allowedRoles:['guard']` + `guard.portal.use` | guard-scanner (roles: guard) | Kiosk shell: session, scan, live flow |
| 3 | `/…/guard/visitors` | `allowedRoles:['guard']` + `guard.visitors.manage` | guard-visitors (roles: guard) | Visitor sign-in, invitations, passes, check-in/out |
| 4 | `/…/guard/pickups` | `allowedRoles:['guard']` + `guard.pickup.release` | guard-pickups (roles: guard) | Student release with safeguarding |
| 5 | `/…/guard/incidents` | `guard.incidents.manage` | guard-incidents | Incident report/trail/escalation/attachments |
| 6 | `/…/guard/emergency` | `guard.portal.use` | guard-emergency | Procedures, contacts, activation, ack |
| 7 | `/…/guard/config` | `guard.gates.manage` | guard-config | Gates, shifts, effective-dated assignments |

Role-filtering result: a `guard` sees 1-6 (no config, no admin modules);
`school_admin` sees 5-7 plus the group, and is bounced from 1-4 by design
(duty stations are guard-only).

## Guard APIs (35 files under `src/app/api/guard/**`)

- Duty station: `me/shift`, `me/gate`, `me/expected`, `me/incidents`
- Kiosk: `kiosk-sessions` (POST), `kiosk-sessions/[id]/close|lock`
- Scan evidence: `scans` (GET, `guard.evidence.read`)
- Badge verification: **`/api/gate/credentials/verify`** (POST, `guard.portal.use`) — the single scan entry point
- Visitors: `visits` (+`[id]/check-in|check-out|pass`), `visitor-invitations` (+`[id]/approve|reject`)
- Pickups: `students/search`, `students/[id]/pickups`, `pickup-authorizations` (GET guard; POST admin/receptionist), `pickup-authorizations/[id]/cancel`, `pickups/release`
- Incidents: `incidents` (+`[id]`, `[id]/actions`, `[id]/attachments`, `[id]/attachments/[attachmentId]`)
- Emergency: `emergency/procedures` (GET), `emergency/activate` (leadership-only), `emergency/[activationId]/acknowledge`, `emergency/[activationId]/end` (leadership-only)
- Config: `gates` (+`[id]`), `shifts` (+`[id]`), `assignments` (+`[id]`) — all `school_admin` + `guard.gates.manage`

## Services (`src/features/guard/services/`)

`home-service`, `kiosk-service`, `credential-adapter`, `visitors-service`,
`release-service`, `incidents-service`, `emergency-service`, `gates-service`,
`handoffs` (static deferred adapter — hostel/transport handoffs intentionally
disabled).

## Tables (16, `guard-schema.ts`)

`guard_gates`, `guard_shifts`, `guard_assignments`, `guard_kiosk_sessions`,
`guard_visitor_invitations`, `guard_visits`, `guard_pickup_authorizations`,
`guard_release_events`, `guard_gate_scan_events`, `guard_incidents`,
`guard_incident_actions`, `guard_incident_attachments`,
`guard_emergency_procedures`, `guard_emergency_contacts`,
`guard_emergency_activations`, `guard_emergency_acknowledgements`
(+ shared `identity_badge_credentials`, `scanner_devices`).

## Ownership / boundaries

- Reception (inquiries, appointments, receptionist handoffs, reception visitor
  CRUD) belongs to AUD-RECEPTION-01 — not re-audited. Guard-owned visitor and
  pickup endpoints were audited here.
- Transport is frozen (AUD-OPS-01); only the transport evidence direction values
  were checked for consistency (none in scope).
- Other domains (finance, HR, attendance, academics, admissions, comms,
  support) were only probed for denial boundaries.
