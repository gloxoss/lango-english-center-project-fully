# AUD-RECEPTION-01 — Screenshot manifest

Real renders of the running app (`http://localhost:3448`, `schoolos_audit`,
`accueil@atlas.ma`) captured with `scripts/visual-sweep.mjs`. Each set covers
the 12-route list: `/dashboard`, the six reception pages, students (+parents),
transport (+allocations, incidents).

## Before — `screenshots/baseline/` (pre-fix, FR desktop)

| File | What it proves |
|---|---|
| `receptionist-fr-students.png` | Fake `Aucun élève trouvé` + zeroed KPIs while the API 403s (`/api/students` denied) |
| `receptionist-fr-receptionist.png` | Open-handoff row renders raw `high` priority badge |
| `receptionist-fr-receptionist__pickups.png` | Honest forbidden state (by design, unchanged) |
| remaining routes | Pre-fix state |
| `sweep-receptionist-fr.json` | Machine-readable sweep |

## After — `screenshots/final-fr/` (FR desktop)

| File | What it proves |
|---|---|
| `receptionist-fr-receptionist.png` | Home: translated `Haute` priority, real KPIs (3/1/3/1), today's appointments with actions |
| `receptionist-fr-students.png` | 200 students listed, no finance column/KPI, class filter hidden (role cannot read classes) |
| `receptionist-fr-receptionist__visitors.png` | Visitor log with pass/check-in/call-out actions |
| `receptionist-fr-receptionist__appointments.png` | Appointment book + lifecycle actions |
| `receptionist-fr-receptionist__inquiries.png` | Inquiry list + duplicate-aware intake dialog trigger |
| `receptionist-fr-receptionist__handoffs.png` | Handoff board with translated categories/priorities/statuses |
| `receptionist-fr-receptionist__pickups.png` | Honest forbidden state (documented as intended) |
| `receptionist-fr-students__parents.png`, `receptionist-fr-transport*.png` | Guardian directory and transport surfaces |
| `sweep-receptionist-fr.json` | Expected flags only (dashboard redirect, pickups default-deny, students class/section probes, transport key warning) |

## After — `screenshots/final-ar/` (Arabic RTL, 12 routes)

Mirrored layout with Arabic labels: `بوابة الاستقبال`, KPI cards, translated
`عالية` priority, `تسجيل الدخول/إلغاء` actions, sidebar mirrored.

## After — `screenshots/final-phone/` (390×844, FR, 12 routes)

No horizontal scroll reported by the sweep on any route.

## Coverage statement

- Every audited reception route: final desktop FR screenshot. ✅
- Every page with a change (home, students): additionally AR RTL + mobile 390
  via the sweeps. ✅
- Visually reproducible defects: before/after pairs for the students lie
  (baseline vs final) and the raw-enum translation (baseline vs final home). ✅
- Role-specific portal: all shots taken under the real `receptionist` account. ✅
