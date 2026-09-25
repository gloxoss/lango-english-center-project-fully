# Implementation campaigns (proposed, NOT started) — DISC-ATTENDANCE-01

| # | Campaign | Content | Size | Needs decision |
|---|---|---|---|---|
| IMPL-ATT-0 | Safety fixes (small, no product change) | check badge expiry on scan and punch; branch + teacher scope on QR reports; capability on punches; menu permissions aligned with page guards; recompute summaries from marks and stop the seed writing them; missing-register rule = ended sessions of the published version, per slot, Casablanca date | S | none |
| IMPL-ATT-1 | Timetable-driven "Appel du jour" (admin) | session-of-day from class_schedule_slots (+ version by date); registers keyed on slot+date; teacher portal switched off legacy timetable_slots | M | date/correction rules |
| IMPL-ATT-2 | Teacher current-session view | auto-select current session; window rules; "aucun cours" state | M | window lengths, substitutes |
| IMPL-ATT-3 | Sessions exceptions | cancellations, substitutions, room changes (new table) | M | policy |
| IMPL-ATT-4 | Credentials merged into Cards | one "Cartes & badges" area; wording fix; transaction on reissue | S–M | merge approval |
| IMPL-ATT-5 | Kiosk context | scanner takes session from device + room + timetable; device authentication with hashed secret, heartbeat; JS QR decoder fallback for desktop browsers (library choice) | M–L | adopt fixed kiosks? |
| IMPL-ATT-6 | Alerts lifecycle + settings | thresholds in settings; statuses assigned/contacted/dismissed/reopened; guardian contact actions | M | thresholds |
| IMPL-ATT-7 | Justifications UX | admin "enregistrer une justification reçue"; parent notification on decision | S | — |
| IMPL-ATT-8 | Pointeuse to HR | move menu; in/out state machine; corrections; later payroll hours | M | payroll use |

Order recommended: 0 → 1 → 2 → 6/7 → 4 → 3 → 5 → 8.
