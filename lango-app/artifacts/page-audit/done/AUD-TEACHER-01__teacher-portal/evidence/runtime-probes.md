# AUD-TEACHER-01 — Runtime probes (API) and reconciliation

Environment: worktree dev server `http://localhost:3447`
(`NEXT_DIST_DIR=.next-agentb`, `DATABASE_URL=…/schoolos_audit`).
Accounts: `prof.07@atlas.ma` (Jihane Sekkat, 12 subject assignments, 1 homeroom),
`prof.01@atlas.ma` (Mouna Chraibi, homeroom only — sparse), `y.elamrani@atlas.ma`
(school_admin). Password `Admin123!`. Probes authenticate through the real
better-auth session cookie; no test bypass.

## 1. Cross-class IDOR on `/api/academics/class-results` (F-02)

### BEFORE (baseline, same branch)

```
teachable probe loop over every class-subject returned by the picker:
class-results readable 43/43, forbidden 0
readable: 1ère/Mathématiques, 1ère/EPS, 1ère/Français, 1ère/Éducation Islamique,
1ère/Anglais, 1ère/SVT, 1ère/Arabe, 1ère/Informatique, 1ère/Espagnol,
1ère/Physique-Chimie, 1ère/Histoire-Géographie, 2nde/Arabe, …, Terminale/Histoire-Géographie
```

`prof.07` teaches SVT only; the endpoint returned names, averages and mentions
for all 43 class-subjects of the tenant.

### AFTER (fix in this branch)

```
class-subjects?100      {"status":200,"len":4,"total":4}   (own SVT only)
class-results readable 4/4
foreign class-results   403 "Vous ne pouvez consulter que les résultats de vos propres matières."
admin class-subjects    {"status":200,"total":43}          (school_admin unchanged)
admin foreign results   200                                (school_admin unchanged)
```

## 2. Teacher portal timetable source (F-01/F-03/F-05)

### BEFORE

`/api/teacher/me/home` and `/api/teacher/me/timetable` read `timetable_slots`,
the legacy table only `scripts/seed-full.ts` writes (the teacher detail screen
itself labels it `legacy_timetable_slots`, `teacher-service.ts:741`). The
canonical published timetable lives in `class_schedule_slots` (used by the
generator, conflicts solver, room registry and the teacher-schedule page).

Runtime proof of the contradiction, same teacher, same DB:

```
/dashboard/teacher  (before) → "1 séance(s) aujourd'hui", Mes classes = 1ère A · 17 élèves
/dashboard/academics/teacher-schedule → 12 slots Mon-Wed (SVT across 12 sections)
```

### AFTER

```
HOME widgets: {"classesToday":0,"myClasses":12,"students":200}
HOME classes : 1ère A/B/C, 2nde A/B/C, 3ème A/B/C, Terminale A/B/C — SVT · 16-17 each
TIMETABLE days with slots: ["monday:4","tuesday:4","wednesday:4"]
TIMETABLE monday order: ["8:00","9:00","10:00","11:00"]   (was 10:00, 11:00, 8:00, 9:00)
CLASSES rosters: 12 sections with student names
```

Thursday (probe day) shows `classesToday: 0` and the honest "Aucune séance
prévue aujourd'hui." — the seed has Mon/Wed slots only. No fake filler.

## 3. Students directory finance gate (F-10)

```
prof.07 → /api/students?pageSize=5 → stats.totalOverdueMAD = 0, overdueStudentsCount = 0
y.elamrani (school_admin) → stats.totalOverdueMAD = 1000 (the seeded overdue invoice)
```

UI: `screenshots/baseline-prof07/teacher-fr-students.png` shows the
"Impayés échus 905 500 MAD · 46 élèves · 46 familles" card and a "Statut
Financier" column reading "À jour" for every student (amounts were zeroed for
teachers but the school aggregate and the lie stayed). After:
`screenshots/final-prof07/teacher-fr-students.png` has neither.

## 4. Tenant / branch / forbidden probes

| Probe | Result |
|---|---|
| unauthenticated `/api/students` | 401 (existing security suite) |
| teacher `/api/teachers` | 403 FORBIDDEN (correct) |
| teacher `/api/transport/allocations` | 403 FORBIDDEN (correct) |
| teacher `/api/academics/class-results` foreign subject | 403 (new) |
| teacher class picker | 4 own subjects (new) |
| teacher `students` export CSV | no "Situation Financiere" column (new) |
| teacher cross-tenant (id from another tenant) | class-results 404 via tenant-scoped lookup; students/teachers tenant-scoped (existing suites) |

## 5. Sweeps

`node scripts/visual-sweep.mjs teacher <routes> <out>` against 16 routes:

- baseline (prof.07, pre-fix): all pages load; 1 flag — `403 /api/teachers` on
  `/dashboard/academics/teacher-availability` (expected, self-service fallback).
- final (prof.07 desktop FR / AR RTL / phone 390): same, no horizontal scroll,
  no text defects (NaN/undefined/raw keys), no redirects.
- final (prof.01 sparse teacher): same, honest empty states.

JSON reports: `screenshots/baseline-prof07/sweep-teacher-fr.json`,
`screenshots/final-prof07/sweep-teacher-fr.json`,
`screenshots/final-prof07-ar/sweep-teacher-ar.json`,
`screenshots/final-prof07-phone/sweep-teacher-fr-phone.json`,
`screenshots/final-prof01/sweep-teacher-fr.json`.
