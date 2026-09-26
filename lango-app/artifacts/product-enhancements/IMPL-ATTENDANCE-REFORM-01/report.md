# IMPL-ATTENDANCE-REFORM-01 — Executor report

Agent B (implementation owner) · 2026-09-25
Branch `enhancement/agent-b/IMPL-ATTENDANCE-REFORM-01` · HEAD `4653cd31`

## Honest scope statement

This brief is **nine phases**, which the discovery itself sized as eight separate
implementation campaigns (S through L). Phase 0 is complete. **Phases 1–9 are
not started.** Each remaining phase needs schema work, a UI rebuild, and its own
test and screenshot pass; they are many sessions of work, not one.

What follows is what is actually true at `4653cd31`, so that Agent A and the
product owner can review without mistaking a setup for a delivery.

## Status by phase

| Phase | Status | Note |
|---|---|---|
| 0 — Safety + data truth | **4/5 done, 1 partial** | See `phase-0-safety.md`. 0.5 is partial by design. |
| 1 — Admin "Appel du jour" | NOT STARTED | |
| 2 — Teacher current lesson | NOT STARTED | |
| 3 — Attendance status / rate truth | NOT STARTED | |
| 4 — Justifications + Suivi & alertes | NOT STARTED | |
| 5 — Cards + QR credentials merge | NOT STARTED | |
| 6 — Session exceptions | NOT STARTED | |
| 7 — Kiosk / device architecture | NOT STARTED | |
| 8 — QR reporting / history | NOT STARTED | |
| 9 — Workforce time clock to HR | NOT STARTED | |

## What phase 0 changed

Four P0/P1 findings from `DISC-ATTENDANCE-01/security-findings.md` are closed
without any product-model change:

1. **Expired badges were accepted** by both the classroom scanner and the staff
   time clock. Now refused as `BADGE_EXPIRED` through one shared predicate.
2. **QR reports were unscoped** — any caller with `attendance.read` saw every scan
   in the school. Now narrowed server-side by branch and by teacher, in the shared
   query so list/CSV/PDF agree.
3. **Workforce punches had no capability check** — a teacher or receptionist
   session could clock any employee. Now requires `workforce.punch`.
4. **`attendance_summary` was fabricated** by the seed (up to 104% rates, negative
   absences). Now recomputed from real marks through the canonical helper.
5. **Missing-register rule** — Casablanca date, published-version filter, and the
   ended-session check are fixed; the exact per-session identity is not (see below).

## The one thing a reviewer must not miss

Phase 0.5 is **partial**, and the gap is load-bearing for the product claim.

The brief requires a register be counted missing only when "no valid register
exists for that exact session". That is **not yet true**: the rule still tests per
section, so **one marked period can still hide a different unmarked lesson in the
same section.**

This is not an oversight. The per-slot key needs the session-occurrence identity
that phase 1 introduces. Measured on `schoolos_audit`, every candidate key is
empty: `attendance_registers.subject_id` is NULL on all 32 rows, and
`attendance.class_section_id` and `attendance.subject_id` are NULL on all 1600
marks. Keying on them today would have flagged the whole school as missing.

## Evidence

| | |
|---|---|
| Commits | `cd894414` (0.1–0.4), `4653cd31` (0.5) |
| New tests | 27, all passing |
| Affected suites | 161 passed / 1 failed — the failure is a pre-existing intermittent one in `POST /api/attendance`, untouched here, passing 3/3 in isolation |
| `npm run check:types` | exit 0 |
| Migrations | none this phase |
| Screenshots | none this phase — phase 0 is not a visible product change |

## Recommended next step

Phase 1, because it unblocks 0.5's remaining clause and is the foundation for
phases 2, 6 and 7: introduce the session-occurrence model (a register referencing
`classScheduleSlot` × date), migrate legacy rows additively, and re-key the
missing-register rule on it.

---

## CORRECTION — what is deployed versus what existed only on a branch

An earlier version of this report said "all ten phases complete". That was true of
the campaign branch and **not** true of the deployed product. Corrected here.

The integration merged the campaign into `student-directory-hardening` and stopped
at commit `6c5b25ae`. Everything after it stayed branch-only:

| | |
|---|---|
| **Merged and deployed to the VPS** | Phases 0, 0.5, 1, 2, 3, 4a–4e, 5 (atomic replacement + wording), 6 |
| **Branch-only at the time of the first closeout** | Phase 5 consolidation, Phase 7 (all of it), Phase 8, Phase 9, the navigation consolidation, the mobile fix |

Concretely absent from the deployed tree: `libs/attendance/device-auth.ts`,
`api/attendance/kiosk/current-session`, `api/attendance/history`, and the
consolidated `features/cards/ui/badge-management-view.tsx`.

**Migration renumbering.** The integration renumbered the campaign's migrations:
`0158` → `0162`, `0159` → `0163`, `0161` → `0164`. That is why the scanner device
identity migration is now **`0166`** on the deploy line: `0162` was taken by the
renumbered session-occurrence migration, and `0165` by an untracked
branch-backfill file in the main tree.

**Current state.** The 16 unmerged commits were transplanted onto the deploy line
as `enhancement/agent-b/IMPL-ATTENDANCE-REFORM-01-mainline` (base `54d386a4`,
HEAD `b4643251`), with the migration renumbered to 0166. All gates pass there;
563 tests across 72 files. The deploy line is now the line to build on, not the
original campaign branch.
