# Signalements (attendance alerts) — DISC-ATTENDANCE-01

## Detection (libs/api/attendance-flags.ts `detectAndRecordFlags`)
Runs on every attendance write: manual entry, QR scan, live classrooms.
| Type | Rule | Severity |
|---|---|---|
| UNJUSTIFIED_ABSENCE | an absence without an approved excuse | per SEVERITY_BY_TYPE |
| CONSECUTIVE_ABSENCE | absent on the last 3 instructional days (school days, not calendar) | CRITIQUE |
| REPEATED_LATE | ≥ 5 late marks | per map |
Thresholds are **hardcoded** (not in settings). One OPEN flag per student and type (no duplicates). An approved excuse resolves the matching unjustified flag.

## Lifecycle
Only OPEN → RESOLVED, plus assignedToId and free-text notes (flag detail page), and "contact guardian" via /api/communication/messages. Missing: acknowledged, contacted, dismissed-with-reason, reopened-if-pattern-continues.

## Data on screen
The 12 current alerts are **seeded at random** (seed-full.ts: type/severity picked randomly, 1 in 3 marked resolved) — they were not produced by the detector.

## Answer: Signalements: PARTIAL (real detector, seeded contents, thin lifecycle).

## Recommendation (for review)
Keep the detector; move thresholds into settings; lifecycle detected → assigned → contacted → resolved / dismissed (reason) → auto-reopen; one-click "appeler / SMS au tuteur" logging a follow-up. Regenerate demo alerts from real marks instead of random seed rows.
