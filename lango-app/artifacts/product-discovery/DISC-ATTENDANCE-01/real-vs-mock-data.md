# Real vs mock data — DISC-ATTENDANCE-01

"Real DB" = the screen reads live rows through an API. "Seed" = those rows were inserted by `src/scripts/seed-full.ts`, not produced by using the app. Evidence: `evidence/db-truth.txt` (read-only queries on db `schoolos`, 2026-09-25).

| Page | Widget | Source | Real DB | Seed-origin | Hardcoded | Derived correctly | Evidence |
|---|---|---|---|---|---|---|---|
| Saisie | roster, statuses, register state | /api/attendance, /registers | yes | yes (1 602 marks, 9 days 2026-09-01..12; 32 registers all LOCKED) | Période 1–8 list is hardcoded | yes | db-truth rows 1–3, 7 |
| Saisie | per-student rate | /api/attendance/summary → attendance_summary | yes | **fabricated** (all 200 rows disagree with real marks) | — | **no** | db-truth "summary total_sessions != real rows = 200" |
| Badges QR | badge list, prefixes ATL-STU-0170 | /api/identity-badges | yes | yes; **prefix format ATL-STU-NNNN never produced by code** (code makes LANGQR-STU-<hex>) | "HMAC-SHA256 Chiffrement Actif" label | n/a | badge-service.ts:18-19; db-truth badges row |
| QR reports | events table, filters, CSV/PDF | /api/attendance/qr/events → libs/attendance/qr-events.ts | yes | yes (40 events) | — | yes, but no branch/teacher scope | qr-events.ts |
| QR reports | "terminaux appairés" KPI | scanner_devices | yes | yes (4 rows, last_seen = seed time) | — | cosmetic: devices never authenticate | pair/route.ts |
| Scanner | live journal | /api/attendance/qr/scanner-sessions + events | yes | 3 seeded sessions | "Caméra WebRTC + Douchette USB" copy | — | — |
| Scanner | onsite headcount | /api/attendance/onsite | yes | — | — | fixed in S-20 | — |
| Pointeuse | punch list ENTRÉE/SORTIE | /api/workforce/punches | yes | **20 rows, all with the identical timestamp 2026-09-11 22:51:31.826** | — | no state machine | db-truth punches row |
| Justificatifs | list, statuses | /api/attendance/excuses | yes | 14 seeded | — | approval flow real | excuses/route.ts:271+ |
| Signalements | alert list | /api/attendance/flags | yes | **12 seeded at random** (type/severity picked randomly, not detected) | — | real detector exists for new data | seed-full.ts ~1732; libs/api/attendance-flags.ts |
| Audit & Alertes | overall rate, students at risk | avg(attendance_summary.rate) | yes | **fabricated seed summary** | — | no | audit-summary/route.ts:36-44 |
| Audit & Alertes | open alerts by type | attendance_flags | yes | seeded | — | yes | route.ts:46-51 |
| Audit & Alertes | missing registers today | class_schedule_slots minus sections with any mark today | yes | 60 seeded slots | — | **wrong rule** (see audit-alerts-analysis.md) | route.ts:53-103 |
| Audit & Alertes | Envoyer un rappel | sendSmsMessage | yes | — | — | real; says "simulation" honestly when no provider | route.ts:122-164 |
