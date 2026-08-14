# Guard & Security Portal — Implementation Plan

Read the shared context and source specification first. The existing `src/features/crm/ui/guard-portal-view.tsx` is a fully hardcoded decoy UI and must be replaced, not extended with more mock arrays.

## 1. Boundary and dependencies

Guard Portal is a least-privilege operational surface, not a directory. Reuse:

- existing `guard` role and capability system;
- HMAC identity badge credentials, scanner devices/sessions and server-side verification;
- student/guardian pickup relationships from the owning student domain;
- employee identities from Advanced HR;
- Hostel handoff APIs only when Hostel is enabled;
- Attachments Book/blob scanning for incident evidence.

Do not create another badge format or expose academic, Finance, medical, HR or full guardian records.

## 2. Model

Add gates/locations, guard assignments, device assignments, shifts, visitor invitations, visit records/passes, pickup authorizations, release events, gate scan events, incidents/actions, emergency procedures/activations/acknowledgements, and optional handoff references.

Store verification evidence snapshots (credential ID/version, authorizer, method, timestamp), not raw secrets or excessive identity data. Assignments are effective-dated. Shared kiosk sessions expire and bind to tenant, branch, gate, device and operator.

## 3. API

- `/api/guard/me/shift`, `/gate`, `/expected`, `/incidents`
- visitor invitation/walk-in approval/check-in/check-out/pass routes
- pickup lookup/verify/release routes
- `/api/gate/credentials/verify` as a purpose-aware adapter over owning badge services
- incident creation/escalation/resolution
- emergency procedure/acknowledgement routes
- optional transport/hostel handoff adapters

Responses use safe projections. Failed scans must not disclose whether a person exists. A release transaction locks the authorization and prevents replay/double release.

## 4. UI

Replace the fake CRM view with a mobile-first feature under `src/features/guard/` and keep `/dashboard/portals/guard` unless a route migration is deliberately documented. Provide Gate Home, Visitor flow, Pickup/Release, Scanner, Incidents and Emergency mode. Large touch targets, immediate lock/sign-out, no browser storage of manifests or identities.

## 5. Delivery

1. Gate/device/shift assignments and real expected list.
2. Visitor invitation, host approval, pass, check-in/out.
3. Pickup authorization and release evidence.
4. QR verification, incidents and optional Hostel handoff.
5. Offline encrypted expiring manifest and emergency drills only after online workflows pass.

## 6. Acceptance

- Expired shift/device assignment, wrong gate, revoked/fake/replayed QR and cross-branch/tenant attempts fail safely.
- Guard responses never contain forbidden academic, Finance, medical, HR or unrelated guardian fields.
- Every admission/release has immutable authorizer/operator/device/gate/time evidence.
- Concurrent/replayed release requests produce one release.
- Search requires narrow identifiers and cannot enumerate the school population.
- Kiosk auto-lock and rapid sign-out work after restart and session expiry.
- Optional integrations degrade safely when their add-ons are disabled.
- Live device/session tests, adversarial response-field audit, two-tenant sweep, Docker build/migrate, TypeScript and isolation checks pass.

