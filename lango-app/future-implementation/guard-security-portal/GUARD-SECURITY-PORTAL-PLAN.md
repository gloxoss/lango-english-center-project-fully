# Guard and Security Portal — Future Implementation Plan

## Goal

Provide a minimal, mobile-first gate workspace for expected arrivals, verified pickup, visitor check-in/out and incidents without exposing school records.

## Core journeys and pages

- **Gate home:** shift/location, expected visitors, authorized pickups, transport arrivals, active incidents and emergency contacts.
- **Visitor check-in/out:** lookup invitation/appointment or create controlled walk-in request, verify host approval, issue pass and record departure.
- **Student pickup/release:** scan/search student, show only authorized pickup people and restrictions, require verification and record release evidence.
- **Badge/QR scanner:** validate signed/revocable visitor, employee or student credentials through owning modules; display photo/name/purpose only after server verification.
- **Transport/hostel handoff:** optional arrival/departure roster and exception acknowledgement when those add-ons are enabled.
- **Incident:** category, severity, location, concise notes, attachments where permitted, escalation and resolution handoff.
- **Emergency mode:** current procedures/contact list and accountable broadcast acknowledgement; activation restricted to authorized leadership.

## Security rules

- Guard role receives no student academic, attendance history, finance, medical detail, guardian directory, staff HR or reporting access.
- Device/location assignments are explicit; shared kiosk sessions auto-lock, prohibit browser persistence and support rapid sign-out.
- Verification failures reveal minimal information. Offline mode, if built, uses encrypted expiring manifests and reconciliation—never a full directory.
- `/api/guard/me/shift|gate|expected|incidents`, `/api/gate/credentials/verify`, all device/location/tenant scoped.

## Delivery

1. Role scope, assigned gate/device and expected visitor list.
2. Visitor check-in/out and host approval.
3. Pickup authorization/release.
4. QR, incidents and optional transport/hostel handoffs.
5. Offline resilience and emergency drills.

## Done when

- Lost/shared device, expired assignment, fake/replayed QR and cross-branch tests fail safely.
- Every person admitted/released has an auditable authorization and time trail.
- The portal never becomes a searchable school directory.

