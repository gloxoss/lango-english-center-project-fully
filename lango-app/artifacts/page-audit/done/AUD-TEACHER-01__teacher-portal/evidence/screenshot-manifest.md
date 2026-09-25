# AUD-TEACHER-01 — Screenshot manifest

All shots are real renders of the running app against `schoolos_audit`
(`http://localhost:3447`), captured with `scripts/visual-sweep.mjs` plus three
interaction shots. Naming: `<role>-<locale>[-phone]-<route-slug>.png`; the
interaction shots carry their own state suffix.

## Before (baseline, branch HEAD before fixes) — `screenshots/baseline-prof07/`

Teacher `prof.07@atlas.ma`, French, 1440×900, 16 routes. Proves:
legacy-timetable home ("1 séance", 1 class), teacher-schedule float/order
defects, students finance leak, no visible change elsewhere.

| File | What it proves |
|---|---|
| `teacher-fr-teacher.png` | Home before: 1 séance (legacy), 1 classe, 17 élèves |
| `teacher-fr-academics__teacher-schedule.png` | `10.999999999999998h`, unordered Monday (10:00, 11:00, 8:00, 9:00) |
| `teacher-fr-students.png` | Finance KPI `905 500 MAD` + "Statut Financier: À jour" column visible to teacher |
| `teacher-fr-{attendance,academics__results,students__parents,reports,transport,transport__trips,transport__boarding,academics__grades__entry,academics__assessment__marksheet,academics__assessment__homework,academics__teacher-availability,academics__live-class,academics__live-class-reports}.png` | Remaining audited routes, pre-fix |
| `sweep-teacher-fr.json` | Machine-readable sweep (redirects, hscroll, failed APIs, text defects) |

## After — `screenshots/final-prof07/` (French, desktop)

| File | What it proves |
|---|---|
| `teacher-fr-teacher.png` | Home after: 12 classes / 200 élèves from subject assignments; no lone dash |
| `teacher-fr-home-timetable-tab.png` | Canonical weekly timetable, Monday-first, ordered |
| `teacher-fr-home-classes-tab.png` | All 12 sections with real rosters |
| `teacher-fr-academics__teacher-schedule.png` | `11h de cours par semaine`, Monday 8:00→11:00 ordered |
| `teacher-fr-results-picker-open.png` | Picker lists only the teacher's 4 SVT subjects (was 43) |
| `teacher-fr-students.png` | Finance KPI and finance column gone for teacher |
| remaining `teacher-fr-*.png` | Every audited route final state |
| `sweep-teacher-fr.json` | Sweep report (only flag: expected `403 /api/teachers` fallback) |

## After — `screenshots/final-prof07-ar/` (Arabic RTL, 16 routes)

Mirrored layout, Arabic labels, home empty state `لا توجد أي حصة مبرمجة اليوم`,
`أقسامي` with 12 sections. `sweep-teacher-ar.json`.

## After — `screenshots/final-prof07-phone/` (390×844, French, 16 routes)

No horizontal scroll on any route (`sweep-teacher-fr-phone.json`).

## After — `screenshots/final-prof01/` (sparse teacher, French, 16 routes)

`prof.01` (homeroom only): honest `Aucune séance prévue aujourd'hui.`, 1 class,
"SVT"-less class card shows only `17 élève(s)` (S-47 fixed), student directory
without finance. `sweep-teacher-fr.json`.

## Coverage statement

- Every audited route: at least one final desktop FR screenshot. ✅
- Every page with a visual change (home, schedule, results picker, students):
  additionally mobile 390 + Arabic RTL (home/schedule/results/students:
  final-prof07-phone + final-prof07-ar). ✅
- Visually reproducible defects fixed: before (`baseline-prof07`) + after
  (`final-prof07`) of the same states for the home, schedule, students page and
  results picker. ✅
- Role-specific portal screenshots captured under the real intended role
  (`teacher` for both prof.07 and prof.01). ✅
