# AUD-TEACHER-01 — Checkpoint (resume file)

> Persisted per the Continuous Executor Rule. A fresh invocation must resume from this file — do not restart discovery.

## State

- Executor: Agent B (opencode-1)
- Branch: `audit/agent-b/AUD-TEACHER-01`
- Worktree: `C:\Users\OMEN\AppData\Local\Temp\opencode\agentb-teacher`
- Branch HEAD: `f42c2bc41cb2386afed52244c5355c31c8a91f96`
- Target: `origin/student-directory-hardening` = `f42c2bc…` (fetched this run — NOT advanced)
- Hub claim: **not claimed yet** (claim with exact files once the route inventory is final)
- Code changes: **0** (nothing edited yet)
- Done folder: `lango-app/artifacts/page-audit/done/AUD-TEACHER-01__teacher-portal/`

## Discovery completed (do not redo)

### Manifest inventory (partial — `portal-manifest.ts` is 464 lines; lines 55–184 read)

Teacher-effective nav = manifest entries whose `permission`/`addonId` the teacher role holds. Entries observed (with their gates):
- `students` → `/dashboard/students` (`students.read` — teacher holds it; scope-filtered server-side)
- `teachers` → `/dashboard/teachers` (`teachers.read` — admin surface, expect filtered out)
- `academics` children: `classes` (`academics.manage`, structure browser), `subjects`/`schedule` (`academics.manage` — excluded for teacher by capability), **`teacher-schedule` → `/dashboard/academics/teacher-schedule` (`academics.read` — the purpose-built teacher view)**, `session-copy`/`assignments`/`promotions`/`readiness` (`academics.manage`)
- `attendance` → `/dashboard/attendance` (`attendance.read` — teacher holds)
- `grading` → `/dashboard/academics/results` (`grading.read`; entry itself is `grading.manage` and is reached separately)
- `finance`, `guardians`, `communication` (`communication.send`), `reports` (addon advanced-reporting), `hr` (addon human-resources; `hr-self-service` child has **no permission key** = always visible when addon on), … (lines 185–464 not yet read)
- Still to read in the manifest: remaining sections (likely library, live-classrooms, settings, portals/librarian, etc.) and the exact filter function in the `/api/portal/manifest` route.

### Additional discovery

1. `/dashboard/portals/teacher` **does not exist** (AGENTS.md is stale on this).
2. Teacher navigation architecture: teachers do **not** render the admin capability nav — staff roles (teacher/accountant/receptionist/guard/librarian) render the **server-owned manifest nav** from `GET /api/portal/manifest` (already capability- and addon-filtered) **plus** a self-service item. Source comment: `src/components/shared/sidebar.tsx` ~line 865 ("Self-service portal for teachers…", `teacherPortalNav` → `/dashboard/teacher`) and ~line 918 ("Nav selection: admin roles keep the existing capability-filtered school nav; staff-ish roles render the server-owned manifest nav…").
3. Teacher home route exists: `src/app/[locale]/(dashboard)/dashboard/teacher/page.tsx` (no subpages under it).
4. `src/libs/api/portal-manifest.ts` is the canonical teacher inventory source (partially read above).

## Next exact actions (in order)

1. Read `src/libs/api/portal-manifest.ts` completely (all entries + the role/capability filtering logic in the `/api/portal/manifest` route, `src/app/api/portal/**` if present) and extract the **effective teacher page list**. Cross-check each entry against the teacher's default capability set in `src/libs/api/permissions.ts` (teacher role block).
2. Confirm each discovered route against its `page.tsx` `requireServerPage` guard and its APIs.
3. Build the final route inventory (expected candidates: `/dashboard/teacher`, `/dashboard/academics/teacher-schedule`, `/dashboard/academics/grades/entry`, `/dashboard/academics/assessment/marksheet`, `/dashboard/academics/assessment/homework`, `/dashboard/attendance`, `/dashboard/students`, `/dashboard/academics/live-class`(addon live-classrooms), `/dashboard/academics/teacher-availability`, `/dashboard/hr/self-service`, `/dashboard/library/me`).
4. Claim `task:AUD-TEACHER-01` in the Hub with the exact files/pages.
5. Per page: audit (purpose, data source, API→service→DB trace, tenant/branch scope, cross-teacher/cross-class IDOR, loading/empty/error/forbidden, dead controls, FR/EN/AR + RTL, 390px), fix safe in-scope defects, add focused regression tests for logic/security fixes, capture screenshots (desktop FR every page; mobile 390 + Arabic RTL for changed/important; before/after where visually fixed) into `screenshots/` with route-tied names.
6. Runtime proof with a real teacher account (seeded `prof.01@atlas.ma` / `Admin123!` on `schoolos_audit`) — dev server pattern: `NEXT_DIST_DIR=.next-agentb DATABASE_URL=...schoolos_audit npx next dev -p 3447 --webpack`; sweeps via `node scripts/visual-sweep.mjs teacher <routes-file> artifacts/...`.
7. Static gates: `npm run check:types`, `check:isolation`, `check:i18n` + `node scripts/check-missing-i18n-keys.mjs`, `check:ui`, eslint on touched files; focused vitest suites for touched domains; one full suite only at campaign end if budget allows.
8. Fill `report.md` from `C:\Users\OMEN\.agents\skills\shared\REPORT_TEMPLATE.md`; fill `evidence/` (inventory, account used, test/gate output, security probes, API/data notes, frozen contradictions, screenshot manifest).
9. Commit, push `audit/agent-b/AUD-TEACHER-01`, Hub `done` with proof, release claim. **No verify, no merge, no next task.**

## Findings so far

- None product-side yet (audit not started). Reference only: the **Attendance onsite timezone** frozen contradiction is already CONFIRMED and logged separately (route `src/app/api/attendance/onsite/route.ts`; Node +01 vs Postgres tzdata +00 window shift). Reproduce if encountered; **do not modify** (frozen).

## Frozen-module reminders

- Attendance Core (P1–P7 entities/services: canonical aggregate, summary, registers, session/year truth, QR canonical path) — read/test only.
- Academic domain logic frozen where it is canonical (timetable generator/solver semantics; do not change domain behavior; teacher-portal integration/UI fixes are in scope).

## Budget note

Checkpoint written at platform context limit. Resume by reading this file and executing "Next exact actions" from step 1 — do not re-run discovery.
