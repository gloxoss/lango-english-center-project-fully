# RESUME PROMPT — IMPL-ATTENDANCE-REFORM-01 / fix-plan-02 (scanning model)

Copy everything below the line into a fresh session. It is self-contained.

---

You are continuing **IMPL-ATTENDANCE-REFORM-01** on branch
`enhancement/agent-b/IMPL-ATTENDANCE-REFORM-01-mainline`, worktree
`.worktrees/IMPL-ATT-MAINLINE` of `lango-english-center-project-fully`.
The spec is `lango-app/artifacts/product-enhancements/IMPL-ATTENDANCE-REFORM-01/fix-plan-02-scanning.md`
(its item 1 prerequisite, fix-plan-01 item 1, is already done).

## Read first, in this order
1. `../.agent-hub/PROTOCOL.md` and `../.agent-hub/CONTEXT.md` (multi-agent rules).
2. This file.
3. `fix-plan-02-scanning.md`.
4. `lango-app/CLAUDE.md`.

## The one thing to understand before touching anything
A badge scan **must not** write a lesson mark. It stages. The teacher validating
the register is what writes marks, and closing the session links each staged scan
to the mark it became. This is the whole reform; do not "fix" it back.

## State: what is done and verified

Commit `8372a388` on the branch holds the verified engine and both screens.

- **Migration 0170** adds `scanner_sessions.class_schedule_slot_id` + `date`.
  Set = CLASSROOM session bound to one occurrence; null = ENTRANCE session.
  **Migration 0169** is the device-identity change (renumbered; see traps).
  Both applied to `schoolos_audit` and idempotent.
- **`verify-and-stage`** stages in both modes, writes zero `attendance` rows.
  Classroom takes its lesson from the SESSION, not the clock. Entrance accepts
  any student at any hour and returns `arrivalOnly`.
- **`scanner-sessions`** has GET (is a session open?) and POST (open/reuse), with
  two modes and the permission rules.
- **`close`** links staged scans to the marks the validation wrote.
- **Gate screen** rebuilt: no class picker, no "Ouvrir la Session", working
  matricule keypad, no invented guardian/SMS block, no fake emergency toggle,
  two separately-labelled counter blocks.
- **Teacher register** has the scan panel: activate, staged arrivals in three
  groups, "Badge oublié", validation, then close.

Evidence I ran myself (do not take anyone's word, including this file):
- `vitest run src/app/api/__tests__/attendance` + onsite + scanner-device-auth
  → **26 files, 186 tests passed**.
- Full suite → **3592 passed, 3 failed** (see traps).
- `check:types` exit 0. `check:isolation` passed. `check:ui` ratchet held.
- **Live end-to-end over HTTP**: teacher logged in, session opened, badge
  scanned, and the database showed **zero marks created** — the pre-existing mark
  for that student was period 1, created hours earlier by another teacher.
- Screenshots in `artifacts/.../after/`: gate screen FR desktop, AR RTL, FR phone.
  The AR one was verified visually: RTL, header reads "وضع البوابة — جميع التلاميذ".

## Blocked: two files another agent holds. Do not force them.

1. **`src/components/shared/sidebar.tsx`** held by `claude-scf-2` (`task:scf-04-01`).
   Line ~488, change `permission: 'attendance.manage'` → `'attendance.scan'`.
   `attendance.scan` already exists, is granted to reception+guard, and both QR
   routes already accept those roles — verified 83/83 permission tests green.
   Without this line, **reception cannot open the gate screen at all** (measured:
   307 redirect from the page, 403 from the API), even though the screen is done.
2. **`locales/{fr,en,ar}.json`** held by `antigravity-grc-1`
   (`task:live-class-detail-ux`). The teacher register references **20 Attendance
   keys that exist in no locale**, so `check-missing-i18n-keys.mjs` exits 1 with
   **60 missing** for the whole repo. The 20: `scanActivateBtn, scanActivateHint,
   scanActiveTitle, scanArrivedAtSchool, scanArrivedCount, scanCloseError,
   scanForgotBadgeBtn, scanGroupLate, scanGroupMissing, scanGroupScanned,
   scanLateTag, scanLinkedNotice, scanManualTag, scanOnTimeTag,
   scanRefusalsHeading, scanResumeCameraBtn, scanStopCameraBtn, scanValidateBtn,
   scanWindowBeforeHint, scanWindowClosedHint`. Reuse the gate agent's existing
   `scan*` wordings where they mean the same thing (list is in
   `attendance-scanner-playground.tsx` / the hub log at 22:0x) so the two screens
   read as one product. Locales are pure CRLF and round-trip byte-identical.

**These two must change together** (nav permission and page guard): changing one
alone fails `src/libs/api/__tests__/nav-page-guard-parity.test.ts` and bounces
real users out of the app. Granted: the capability exists; remaining:
`sidebar.tsx:488` and `attendance/scanner/page.tsx:15`.

## Remaining work, in order
1. The two blocked edits above (needs their holders — ask, do not take).
2. Write the 20 keys ×3 locales, then `node scripts/check-missing-i18n-keys.mjs` must exit 0.
3. Teacher register screenshots: FR desktop, phone 390, AR RTL. Note the register
   URL needs `?slot=<slotId>&date=<YYYY-MM-DD>`; `attendance-page.tsx` renders
   `AttendanceClient` only when both are present, otherwise Appel du jour.
4. Fix the duplicate React key on the gate screen (a console error the sweep
   caught: "Encountered two children with the same key").
5. Execute guide tests **E1–E4** (entrance) and **C1–C6** (classroom) in
   `manual-test-guide.md`, in FR desktop, phone 390 and AR RTL. They are written,
   never executed.
6. `WRONG_CLASS` names the student but not their section. The plan's example is
   "Rania Sefrioui — 2nde A". The route must return the section for that.
7. Final honest report: PASS / FAIL / NOT VERIFIED. Hardware stays NOT VERIFIED.

## Traps that cost time here
- **Run hub commands with cwd = the repo root.** `.worktrees/IMPL-ATT-MAINLINE/.agent-hub`
  is a stale duplicate; a subagent's claims went there and were invisible. The
  live board is the repo root's.
- **Migration journal order.** Drizzle applies in journal ARRAY order, not `when`
  order. On merge, 0169/0170 must be APPENDED LAST (after 0168), or 0167/0168 are
  silently skipped on deploy. The journal also carries 5 pre-existing
  non-ascending entries (idx 45, 88, 92, 96, 102) and 2 duplicate `when` values —
  all long-applied, unreachable, not a hazard, none mine.
- **`next dev` rewrites `tsconfig.json`.** Do not commit it.
- **`visual-sweep.mjs` prefixes the locale itself.** A routes file must contain
  `/dashboard/attendance/scanner`, NOT `/fr/dashboard/...`, or you get `/fr/fr/...`
  → a 404 page that the tool still reports as "ok". **Read the PNG before you
  believe it.** That mistake cost me a full screenshot pass.
- **The sweep's defect patterns do not include a 404**, so it will happily
  screenshot an error page and say nothing.
- **Clock-boundary tests.** `dashboard-formatters.test.ts` and
  `hostel-date-boundaries.test.ts` fail across midnight ("Aujourd'hui" vs
  tomorrow's date). They are not regressions.
- **`recordAudit` is fire-and-forget** — poll for the audit row, do not assert
  immediately (claude-scf-2's note).
- **`attendance.subject_id` FKs the legacy `courses` table.** The client sends
  `'all'` deliberately. Do not "fix" it.
- **`attendance.period` still has a DB-level `default(1)`.** Unreachable from
  current insert paths, but any new insert that omits it reproduces the original
  bug. Deserves its own migration.

## Environment
- Worktree `lango-app`, dev server on **port 3480** (`task:port-3480`), started with:
  `NEXT_DIST_DIR=.next-agentb BETTER_AUTH_URL=http://localhost:3480 NEXT_PUBLIC_APP_URL=http://localhost:3480 DATABASE_URL='postgresql://schoolos:local_dev_password_change_me@localhost:5433/schoolos_audit' ./node_modules/.bin/next dev -p 3480`
  Use the **local binary**, never `npx next`. Never run `npm run build`.
- DB: container `schoolos-db` on 5433. Tests/dev data touch **`schoolos_audit` only**.
- Logins (`Admin123!`): `y.elamrani@atlas.ma` admin, `prof.05@atlas.ma` teacher
  (owns the demo lesson), `accueil@atlas.ma` receptionist, `etudiant.0001@atlas.ma` student.
- Demo data so the flows are live at any hour: `npx tsx scripts/seed-attendance-demo.ts`
  (add `--remove` to take it out). It places one lesson in prof.05's own CAMPUS —
  it must be their campus or the scan is refused with "other campus".
- Tests: `DATABASE_URL='postgresql://schoolos:local_dev_password_change_me@localhost:5433/schoolos_audit' ./node_modules/.bin/vitest run <pattern>`

## Rules
Never `git stash`, `git reset --hard`, `git checkout -- <file>`, `git clean`;
never commit another agent's files. Claim files in the hub before editing. Report
honestly: run every check you claim, and mark anything you could not do as NOT
VERIFIED rather than leaving it out.
