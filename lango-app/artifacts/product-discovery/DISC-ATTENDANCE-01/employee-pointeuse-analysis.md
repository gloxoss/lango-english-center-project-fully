# Employee time clock — DISC-ATTENDANCE-01

## Current
- API: GET/POST /api/workforce/punches. POST roles: school_admin, teacher, receptionist, **no capability check**. GET requires hr.read.
- Credential: the same `identity_badge_credentials` (staff badges), HMAC lookup, status must be active. Expiry not checked.
- Data: 20 seeded punches, **all at the identical timestamp 2026-09-11 22:51:31.826** — this is why the page shows repeated ENTRÉE/SORTIE at the same time. Seed, not usage.
- `punchType` (in/out) is chosen by the caller: **no state machine** (two "in" in a row, "out" without "in" all accepted), no break/overnight handling, no device, no branch, no correction workflow.
- Relationship: shown on employee self-service (/api/employee/me/time, /home) and /api/hr/employees/[id]/payroll-attendance; **not used by payroll calculation** (payroll-runs does not read punches). No link to leave or lateness.

## Answer: Employee pointeuse: PARTIAL (real API and table, seeded data, no business rules).

## Recommendation (for review)
Move under HR / Workforce (it is staff time, not student attendance). Add an in/out state machine (next punch type derived from the last one), a capability (e.g. workforce.punch), device/branch capture, and a manual-correction flow with reason before any payroll use.
