# Current business logic — DISC-ATTENDANCE-01

## Statuses
present / absent / late / excused, stored in `attendance.status`, one row per (student, date, period, section, subject) — no duplicates found in the dev DB (0). Mutually exclusive by construction. Changes are updated in place with an audit-log entry (before/after); rows can be voided (`isVoided`, `voidReason`), not deleted. Registers: OPEN → LOCKED, correction via REOPENED with reason (`reopenReason`, `correctionNote`).

## Rate
`libs/api/attendance-aggregate.ts`: rate = (present + late + excused) / recorded × 100; NULL when nothing recorded; voided rows and other session years excluded. "Excused" counts as attended — a product choice to confirm.

## Lateness
Manual entry: teacher sets late + minutes. QR: late if scanned after `attendance.periodStartTime` (default 08:00) + `attendance.lateGraceMinutes` — the same threshold for every lesson of the day.

## Alerts
See signalements-analysis.md (3 hardcoded rules, run on every write).

## Justifications
See justifications-analysis.md (approval rewrites the mark to excused, resolves alert, recalculates totals).

## Cross-module chains
| Chain | Where it holds | Where it breaks |
|---|---|---|
| Timetable → session → teacher/kiosk → register → status → justification → alert → communication → reporting | register, status, justification, alert, SMS reminder | timetable → session (no link); kiosk class is picked by hand; reporting reads a fabricated summary |
| Student → matricule → card/credential → QR → scanner | credential per student, hash lookup, revoke/reissue | badge page separate from Cards; expiry ignored; manual matricule bypasses credential |
| Employee → credential → pointeuse → work hours → HR/payroll | staff badge lookup, punch rows | no state machine, no hours computation, not read by payroll |
