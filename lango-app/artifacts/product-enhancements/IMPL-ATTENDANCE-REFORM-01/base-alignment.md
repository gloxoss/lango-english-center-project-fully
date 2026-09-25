# Base alignment check — Phase 0 vs release/REL-INTEGRATE-01

Read-only analysis. No rebase, no merge, no Phase 1 work performed.

Requested comparison: `origin/release/REL-INTEGRATE-01`.

> **`origin/release/REL-INTEGRATE-01` does not exist.** The release branch was
> never pushed. Only a local `release/REL-INTEGRATE-01` exists, checked out in a
> worktree, at `8215bb6e`, authored 2026-09-25 00:22. Its configured upstream is
> `origin/student-directory-hardening`, which is unrelated. Everything below
> compares against that local branch. **If this is to become the integration
> base, it is currently unbacked-up and exists on one machine only.**

## SHAs

| | |
|---|---|
| CURRENT PHASE0 HEAD | `7ef7355e` |
| RELEASE HEAD | `8215bb6e` (local only) |
| Phase 0 base | `17945212` |
| Merge base | `34c5ce10` |
| Commits release has, base lacks | 59 |
| Commits base has, release lacks | 6 |
| Files differing base ↔ release | 1204 |

## Touched files overlapping release

Phase 0 touched 14 source files. **Release also changed exactly 2 of them.**

| File | Phase 0 change | Release change | Textual overlap | Semantic overlap | Likely conflict |
|---|---|---|---|---|---|
| `src/libs/finance/today.ts` | Added `casablancaTimeHm()` (wall-clock "HH:MM") immediately after `casablancaTodayIso` | Added `casablancaOffsetMs`, `casablancaWallTimeUtc`, `casablancaDayBoundsUtc` immediately after `casablancaTodayIso` (commit `92c857b9`, AUD-SAFETY-01) | **Same insertion anchor** | **Complementary, not duplicated.** Theirs converts Casablanca wall-clock → UTC instant with DST/Ramadan-correct offsets; mine formats now → wall-clock string. Both are the same helper family | **YES — content. Trivial: keep both** |
| `src/scripts/seed-full.ts` | Replaced the fabricated `attendance_summary` block with `recalculateStudentAttendanceSummary` | 103 insertions / 96 deletions elsewhere in the file (`92c857b9`, AUD-SAFETY-01) | None | **None.** Release still contains the fabricated block verbatim (formula `late * 0.5`, `total = 80`, `ay25!.id`) — it was not fixed there | **NO — merges clean** (confirmed by simulation) |

The other 12 Phase 0 files are **byte-identical** between base and release, so they
transplant cleanly.

## Semantic overlap: zero duplication of the Phase 0 fixes

Each Phase 0 fix was checked for an equivalent already present on release.

| Phase 0 fix | Present on release? | Evidence (grep count on release blob) |
|---|---|---|
| Badge expiry enforced in scanner | **No** | `expiresAt` appears **0** times in `qr/verify-and-stage/route.ts` |
| Badge expiry enforced in time clock | **No** | release `workforce/punches/route.ts` POST is byte-identical to base |
| QR report branch/teacher scope | **No** | `branchId\|teacherUserId\|getTeacherClassSectionIds` = **0** in `libs/attendance/qr-events.ts` |
| `workforce.punch` capability | **No** | **0** occurrences in `libs/api/permissions.ts`; POST still has no capability call |
| Summaries recomputed from marks | **No** | release still has the fabricated block at `seed-full.ts:1726` |
| Missing-register Casablanca / version / ended | **No** | `casablanca\|timetableVersions\|endedSlots` = **0** in `audit-summary/route.ts` |
| `isCredentialExpired` helper | **No** | **0** in `libs/api/badge-service.ts` |

**All six Phase 0 fixes are still needed on the release base.** Nothing would be
lost or re-done.

## Dependencies are stable

Every module Phase 0 depends on is byte-identical between base and release:
`teacher-scope.ts`, `attendance-aggregate.ts`, `attendance-summary.ts`,
`school-day.ts`, `badge-crypto.ts`, `attendance-qr-schema.ts`, `Schema.ts`,
`errors.ts`, `context.ts`. No API drift to absorb.

## What release already contains that Phase 1+ needs

This is the strongest argument for transplanting, and it is not about Phase 0 at all.

**AUD-TEACHER-01 (`2cc5ea9b`) already did most of Phase 2's core requirement**,
which is "switch `/api/teacher/me/timetable` and `/api/teacher/me/home` away from
legacy `timetable_slots` onto canonical timetable data":

| Route | Base | Release |
|---|---|---|
| `teacher/me/timetable` | 10 refs to legacy `timetableSlots` | 0 — delegates to `features/teacher/server/teacher-portal.ts` |
| `teacher/me/home` | 11 refs to legacy `timetableSlots` | 0 |

`teacher-portal.ts` reads canonical `classScheduleSlots`, resolves
`timetableVersions`, and already uses `weekdayNameFor`, `casablancaTodayIso` and
`getTeacherClassSectionIds` — the same primitives Phase 0 and Phase 2 need.

Also on release: `AUD-HR-01` touched `hr/employees/[id]/payroll-attendance` and
`workforce/payroll/payslips` (relevant to phase 9), and `AUD-SAFETY-01` added the
rigorous Casablanca timezone machinery my `casablancaTimeHm` should be aligned
with rather than sit beside.

## Actionable note for Phase 0.5 if transplanted

Release's `teacher-portal.ts` already implements the "published version effective
on a date" resolution that Phase 0.5 hand-rolled inline. There is **no shared
helper** — every module resolves it inline (`teacher-portal`, `payroll-runs`,
`homework-service`, `portal-home`, …). So the inline pattern is the codebase
convention and Phase 0.5 is consistent with it; extracting a shared helper is a
reasonable follow-up, not a blocker.

## Recommendation

**TRANSPLANT PHASE0 ONTO RELEASE BASE BEFORE PHASE1.**

Three independent reasons:

1. **Phase 2 is largely already done there.** Staying on `17945212` means
   re-implementing the teacher-portal migration against legacy `timetable_slots`,
   then reconciling with `2cc5ea9b` later. That is duplicated work and a
   guaranteed conflict.
2. **Transplant cost is low and known.** 2 of 14 files overlap, 12 are identical,
   every dependency is stable, and all six Phase 0 fixes are still needed on
   release. Exactly one conflict is expected (`today.ts`, same insertion anchor,
   keep-both resolution). `seed-full.ts` merges clean.
3. **Phase 0 verification is cheap to repeat.** The tests are database-backed and
   self-provisioning; re-running them on the new base is a single command.

The one thing to settle first: **`release/REL-INTEGRATE-01` is local-only.** If it
becomes the base for this campaign, it should be pushed to origin so Agent A
reviews the same commit everyone else has.

## Prepared Phase 0 commit list — NOT executed

To be run only on approval, from the worktree, after pushing `release/REL-INTEGRATE-01`:

```
# 1. Record the current tip as a recovery point
git branch phase0-base-17945212 7ef7355e

# 2. Replay the three Phase 0 commits onto the release base
git rebase --onto release/REL-INTEGRATE-01 17945212 enhancement/agent-b/IMPL-ATTENDANCE-REFORM-01

# expected: content conflict in lango-app/src/libs/finance/today.ts only
#   resolution: keep BOTH function groups (theirs = wall-time -> UTC, mine = now -> "HH:MM")

# 3. Re-verify on the new base
npm run check:types
npx vitest run <attendance/qr/workforce suites>   # DATABASE_URL overridden to schoolos_audit
```

Commits to be replayed:

| SHA | Subject |
|---|---|
| `cd894414` | fix(attendance): phase 0 safety + data truth (1/2) |
| `4653cd31` | fix(attendance): phase 0 missing-register truth (2/2) |
| `7ef7355e` | docs(attendance): phase 0 artifact package |

If `emergency/agent-a`'s Phase 0 review returns findings, fold those fixes into
the same replay rather than making a second transplant.
