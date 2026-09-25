# Checkpoint — IMPL-ATTENDANCE-REFORM-01

Agent: claude-agentb (Agent B, implementation owner)
Updated: 2026-09-25

## Where the work lives

| | |
|---|---|
| **Active branch** | `enhancement/agent-b/IMPL-ATTENDANCE-REFORM-01-integrated` |
| **HEAD** | `690ab331` |
| **Worktree** | `.worktrees/IMPL-ATT-INTEGRATED` |
| **Base (release)** | `origin/release/REL-INTEGRATE-01` = `8215bb6e` |
| Original pre-integration branch | `enhancement/agent-b/IMPL-ATTENDANCE-REFORM-01` @ `383dc542` (Agent A reviewed `7ef7355e`) |
| Dev port claimed | `3470` |
| Test database | `schoolos_audit` |

Continue on the **integrated** branch. Do not return to the pre-integration branch.

## Commit history on the integrated branch

| SHA | Phase | Summary |
|---|---|---|
| `0ded9df3` | 0.1–0.4 | Expired credentials, QR report scope, `workforce.punch`, seed summaries recomputed |
| (cherry-pick) | 0.5 | Missing-register: Casablanca date, published version, ended-only |
| (cherry-pick) | docs | Phase 0 artifact package |
| `de63af39` | 0.5 corr. | Date classified before the clock; calendar fixture fixed; rebuild tool |
| `15edc4fd` | **1 (backend)** | Session-occurrence identity; migration 0158; phase 0.5 limitation closed |
| `690ab331` | docs | Phase 1 artifact |

## Phase status

| Phase | Status |
|---|---|
| 0 — Safety + data truth | **COMPLETE** (see `phase-0-safety.md`) |
| 1 — Appel du jour | **BACKEND DONE, UI NOT BUILT** (see `phase-1-admin-attendance.md`) |
| 2 — Teacher current lesson | NOT STARTED |
| 3 — Business truth / metrics | NOT STARTED |
| 4 — Justifications + Suivi & alertes | NOT STARTED |
| 5 — Cards + credentials | NOT STARTED |
| 6 — Session exceptions | NOT STARTED |
| 7 — Kiosk + devices | NOT STARTED |
| 8 — Registers, history & QR reporting | NOT STARTED |
| 9 — HR Temps & Pointeuse + navigation | NOT STARTED |

## Next concrete step

Finish phase 1's UI, which is the only thing standing between the landed backend
and a working Appel du jour:

1. `GET /api/attendance/day?date=` returning `listSessionOccurrences` results with
   `occurrenceState` per lesson.
2. The screen at `/dashboard/attendance`: chronological session cards
   (`08:00–08:55 · Mathématiques · 1ère A · Mme X · Salle B12`), status chips,
   past = view-only, today = operational, future = preview.
3. `Corriger le registre` reusing the existing REOPENED / reason / before-after
   audit path with a mandatory reason.

Then phase 2, which shares the same resolver and should be mostly UI.

## Environment facts worth carrying forward

- **The app's dev database is `schoolos` on `localhost:5433`** — a native
  Postgres, *not* the `lango_postgres` container (which publishes no host port).
  Tests must target `schoolos_audit`; override `DATABASE_URL` explicitly.
- `lango_postgres` was **exited** at campaign start and was started by hand.
- `.env` in each worktree is copied from the main checkout and points at
  `schoolos`, so every test run must override `DATABASE_URL` to `schoolos_audit`.
- Worktree `node_modules` are **junctions** to the main checkout (symlinks need
  elevation on this machine).
- `npx drizzle-kit migrate` exits 1 against `schoolos_audit` without an error
  message: that DB has **163** applied migrations against a **160**-entry journal.
  Pre-existing, unrelated to 0158.

## Test baseline at this checkpoint

- Attendance/QR/teacher/workforce/audit-summary suites: **265 passed / 28 files**
- Integrated regression (teacher + safety + HR included): **375 passed / 52 files**
- `npm run check:types` exit 0
- `npm run check:isolation` PASS

No screenshots captured yet — phase 1's UI does not exist, and the screenshot set
in the brief is a closeout deliverable.
