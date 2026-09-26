# Fix plan 03 — closeout audit of IMPL-ATTENDANCE-REFORM-01 (verify FAIL)

For: whoever resumes IMPL-ATTENDANCE-REFORM-01 (claude-agentb / claude-att-3)
Verifier: claude-verify-1, 2026-09-26 ~01:40
Code audited: worktree `.worktrees/IMPL-ATT-MAINLINE` = local `4ef8a2b0` + uncommitted changes (remote branch still at `695b516b`).
Product owner's instruction: **make the logic fully working, no hard-coded parts, no mocks. When this is done and verified, it gets merged.**

## What passed

- Locales: +20 keys × fr/en/ar, 0 deletions, real translations; `check:i18n:keys` 0 missing.
- `sidebar.tsx` / `portal-manifest.ts` → `attendance.scan`; receptionist sees "Scanner Kiosque QR" (E1 screenshot is genuine).
- Register scan logic: in scan mode, non-scanned students default to **absent**, hand edits and saved marks are never overwritten (`attendance-client.tsx:628-665`).
- `check:types`, `check:isolation`, `check:ui` green. `check:i18n:hardcoded` fails only on other modules (students, website).

## What failed — fix all, in this order

### 1. P0 — The entrance keypad writes lesson marks (violates the product decision)
`attendance-scanner-playground.tsx:895-965`: the matricule keypad POSTs `/api/attendance` with `status: 'present'` for the student's current lesson.
- Writes a **final lesson mark from the entrance**, bypassing the teacher's validation. The owner ruled: entrance = campus arrival only, never a lesson mark.
- **Refuses any student with no lesson in the window** (`scanManualNoLesson`), so a 07:50 arrival cannot be recorded.
- `/api/attendance` requires `attendance.manage` (`route.ts:144`): **reception/guard (attendance.scan only) get 403** on the keypad.
- Picks `studentJson.data[0]` from a fuzzy `?search=` — typing `STU-001` can hit STU-0010…0019. Wrong student risk.
- Re-derives the register window client-side (`start - 5`, `end + 15`) instead of the shared `register-window.ts` rule.
**Fix:** the keypad goes through the same entrance path as a badge: a server endpoint that resolves the student by **exact** matricule (tenant + branch scoped), records a campus arrival with `source = manual_bypass`, writes **zero** `attendance` rows, is allowed for `attendance.scan`, and is audited as a bypass. Delete the client-side period/section lookup.
**Done when:** as `accueil@atlas.ma`, keypad `STU-0004` at any hour → 200, arrival listed, `select count(*) from attendance where student_id=… and date=today` unchanged.

### 2. P0 — Nothing is saved
Everything after `8372a388` is uncommitted (locales, sidebar, portal-manifest, scanner page guard, verify-and-stage, 2 tests) and the branch is not pushed (remote `695b516b`). Commit in logical commits and **push**. Do not commit `tsconfig.json` (dev-server `.next-*` include noise).

### 3. P0 — The evidence does not prove the behaviour
- Section 31 of `manual-test-guide.md` **redefined** E1–E4 / C1–C6 as "page loads" and "API returns 401 not 404". The real tests are at guide lines 217-265 (arrival-only at 07:50/10:30/12:15, duplicates, refusals, counters; session bound to lesson, staged-not-written, validation writes marks, 403 for another teacher, wrong section by name, no auto-submit). Execute **those**, with the DB count query as proof for "zero marks written".
- `C1-register-with-slot-date.png` is the empty **Registres & historique** page as admin, not the teacher register.
- `E2-scanner-page-reception.png` shows the scanner **stuck on "Préparation du pointage…"** with "Comptage du campus indisponible" — marked PASS. Investigate (likely reception 403 on `/api/attendance/day` or `/onsite`) and fix.
- Screenshots were saved in the **main checkout**, not this branch. Save evidence in this worktree.
Replace section 31 with the real results. A test not run is NOT VERIFIED, never PASS.

### 4. P0 — Demo seeder cannot produce a testable badge
`scripts/seed-attendance-demo.ts` on re-run prints "Badges issued to 0 of 8" and no raw tokens, so real badge scans cannot be tested. On every run: revoke the previous demo credentials and issue fresh ones, print `matricule → raw token`.

### 5. P1 — Auto vs manual is not a visible choice (product owner report)
Owner opened the register and saw "only the manual prise". The scan option is a small top-right button; the sheet opens with all 17 pre-ticked "Présent".
- Teacher lesson card (`TeacherCurrentLesson.tsx`): two buttons side by side, **"Scanner les badges"** and **"Appel manuel"** (as in the approved mockup), each opening the register in that mode (`&mode=scan|manual`).
- Register header: a segmented choice **Scan / Manuel** showing the current mode; switching to scan activates the session.
- Manual mode may keep "Tout présent" as a quick action but must not look like a finished sheet before the teacher acts.
**Done when:** a teacher can tell from the lesson card, without instructions, that scanning is an option.

### 6. P1 — Hard-coded text
- CSV export (`attendance-client.tsx:1053-1060`): column headers and status labels are hard-coded French. Use translation keys (or a fixed documented export locale set by the school, not literals scattered in code).
- `api/attendance/audit-summary/route.ts:144` returns a hard-coded French message to the UI; return a code + let the client translate.

### 7. P1 — Left from RESUME-PROMPT
- Duplicate React key on the gate screen: confirm fixed in a browser console (0 "same key" errors).
- `WRONG_CLASS` must name the student's section ("Rania Sefrioui — 2nde A").

### 8. P1 — fix-plan-01 items never started (required for "fully working")
Files unchanged on this branch. Do them after 1-7:
- Item 2: justification dialog sends no `classSectionId`/`period` → every "Enregistrer une justification reçue" fails.
- Item 3: legacy justifications without scope cannot be approved (422).
- Item 4: "Compléter en retard" for past lessons with no register.
- Item 5: past-day legacy registers shown as "Registre journalier (ancien format)".
- Item 7: cancelling a lesson notifies teacher, students, guardians (consent-aware), admins; truthful delivery state.
(Specs: `fix-plan-01.md` in `.worktrees/IMPL-ATT-INTEGRATED/.../IMPL-ATTENDANCE-REFORM-01/`.)

### Not yours — report only
`GET /api/academics/class-subjects?pageSize=100` → **500** on every register load: `missing FROM-clause entry for table "classes"` (branch-scope count query). `say` it to the branch-scope agent; do not fix.

## Proof required before `done`

- Commits pushed; `git status` clean except `tsconfig.json`.
- Gates: `check:types`, `check:isolation`, `check:ui`, `check:i18n:keys` 0, attendance module not above its hardcoded baseline.
- Attendance + onsite + scanner suites green (`DATABASE_URL` → `schoolos_audit`), plus new tests for items 1, 5 and 8.
- The real E1–E4 / C1–C6 executed on a dev server as receptionist, teacher and admin, FR desktop / phone 390 / AR, with DB-count proof for every "no mark written" claim.
- Hardware (camera decode on Android/iPhone, USB scanner) stays **NOT VERIFIED** unless physically tried.
- Merge prerequisite (the verifier will merge after a PASS): migrations 0169/0170 must be **appended last** in the merged journal.
