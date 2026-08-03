# Receptionist Portal — Future Implementation Plan

## Goal

Give front-desk staff a fast workspace for inquiries, appointments, arrivals, authorized contact lookup and handoff without broad academic/finance access.

## Core journeys and pages

- **Front desk home:** expected visitors/appointments, open inquiries, callbacks, pickups, incidents and announcements.
- **Inquiry/admission intake:** create/search lead, deduplicate, capture consent/source/interest, assign follow-up and schedule visit; conversion remains authorized admissions work.
- **People lookup:** minimal student/guardian/employee contact and branch/class context required to route a request; sensitive fields masked.
- **Appointments/meetings:** create/check-in/reschedule/cancel, notify host and record outcome.
- **Visitor and pickup desk:** verify visit purpose/host/guardian pickup authorization, issue badge/pass and check out; depends on a future visitor-management workflow.
- **Payments:** optionally hand off to cashier or collect only with explicit finance/cashier assignment; receptionist role alone has no payment authority.
- **Communication:** approved templates for confirmations/directions; no bulk campaigns or raw contact export.
- **Handoffs/support:** create task/ticket for admissions, finance, teacher, administrator or security with status trail.

## Rules and APIs

- Search returns purpose-limited projections and is rate-limited/audited to prevent directory browsing.
- Identity verification method and outcome are recorded without storing unnecessary document copies.
- Pickup authorization is explicit/effective-dated and never inferred from “primary contact.”
- `/api/reception/me/home|appointments|handoffs|lookup`, scoped Lead CRM/Event/meeting/visitor adapters.

## Delivery

1. Scoped home, minimal lookup and inquiry intake.
2. Appointments and notifications.
3. Visitor/pickup workflow with Guard portal integration.
4. Handoffs, reporting and optional cashier assignment.

## Done when

- Front-desk search cannot enumerate or reveal sensitive records.
- Visitor/pickup events have complete arrival/departure/authorization trails.
- Finance actions remain impossible without a separate active cashier capability.

