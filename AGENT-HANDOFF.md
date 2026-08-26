# SchoolOS — Full Agent Handoff Document

> **Stale flag (2026-08-03):** this file, `schoolos-app/AGENT-HANDOFF.md`, and
> `schoolos-app/MASTER_ROADMAP_AND_TRACKER.md` all claim to be the canonical
> status doc and disagree with each other and with the code (e.g. this file
> doesn't reflect the Phase 2-7 work landed since 2026-08-02). Don't trust
> any of them blind — check `git log` and run the test suite for ground
> truth. Consolidating into one doc is an open task, not done yet.

> **Purpose:** Give this entire file to any AI coding agent so it can continue work with zero context loss. This supersedes every previous version of this file — the prior version (dated 2026-06-15, "Antigravity") predates `PRODUCT-TRUTH.md` and Phases 2–4; do not use it.
>
> **Last updated:** 2026-07-31, this session. A full-app audit (`FULL-APP-AUDIT.md`, this directory) enumerated all 83 pages and 33 API routes live (not just typechecked) and found 3 unauthenticated routes, several miswiring bugs, 31 orphaned dead-tree duplicate pages, and — the largest bucket — real authorized backends sitting unused behind static UI. A remediation plan (`~/.claude/plans/whimsical-painting-turtle.md`, sections 1-8) was executed through section 7; section 8 (super-admin platform) and a handful of explicitly-scoped-out items remain. See §3a below for exactly what changed.
>
> **Working directory:** `c:\Users\oussama\oussama\OneDrive - 雪玲团队\Documents\schoolos\schoolos-english-center-project-fully\schoolos-app` (this is the real, active codebase — not the sibling `schoolos-app` at the `schoolos/` root, which is a separate, unrelated, currently-broken prototype; see §9).

---

## 1. Read these four files first, in this order

1. **`c:\Users\oussama\oussama\OneDrive - 雪玲团队\Documents\schoolos\PRODUCT-TRUTH.md`** — dated 2026-07-26, explicitly overrides every other document in the repo tree, including this one where they conflict. States: *"The existing codebase is mostly a throwaway prototype... nothing in it should inform design decisions."* Defines the actual v1 scope (K-12 school management: students, classes, attendance, grades, fees, staff, timetable, documents, SMS communication), the v1 role matrix (director/school-admin, teacher, accountant — **not** the older 7-role list), and product decisions (Moroccan `/20` grading, configurable academic calendar, flexible fee structures, French+Arabic+English at launch, SMS-first communication).
2. **`c:\Users\oussama\oussama\OneDrive - 雪玲团队\Documents\schoolos\schoolos-english-center-project-fully\schoolos-app\task_plan.md`** — the living phase tracker. Phases, checkboxes, decisions made, errors encountered, and a running Notes log of every non-obvious thing done in each slice. **Update this file when you finish a slice** — that is its explicit convention.
3. **`c:\Users\oussama\oussama\OneDrive - 雪玲团队\Documents\schoolos\schoolos-english-center-project-fully\schoolos-app\MIGRATION-NOTES.md`** — every stopgap column that exists in the schema, why, and its removal condition. Read before touching `user`, `guardians`, or the academic-structure tables.
4. **`c:\Users\oussama\oussama\OneDrive - 雪玲团队\Documents\schoolos\schoolos-english-center-project-fully\schoolos-app\findings.md`** — the original gap inventory (Phase 1) against the ESchool reference and the PHP codebase.

The project's `CLAUDE.md` (same directory) mandates using ESchool SaaS v1.6.0 as the *business-logic reference*, not code to copy verbatim:
- `c:\Users\oussama\oussama\OneDrive - 雪玲团队\Documents\schoolos\insperations\eschool_saas_full_schema.sql` — full MySQL schema, 48 tables.
- `c:\Users\oussama\oussama\OneDrive - 雪玲团队\Documents\schoolos\insperations\ESCHOOL_SAAS_DATABASE_SCHEMA.md` — human-readable summary of the same.
- `c:\Users\oussama\oussama\OneDrive - 雪玲团队\Documents\schoolos\insperations\eschool-saas-codebase\` — the actual PHP models/controllers/repositories.

---

## 2. Architecture & tech stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 16.2.6, App Router | React 19 |
| Language | TypeScript, strict | |
| ORM | Drizzle ORM 0.45, `drizzle-kit` | Schema in `src/models/Schema.ts` |
| Database | **PostgreSQL** | Not SQLite, not MySQL, not PGLite in production — see §8 for the history of why this matters |
| Auth | Better Auth 1.6 | `src/libs/auth.ts`; email+password only, sign-up disabled (admin-provisioned accounts) |
| Validation | Zod 4 | `src/libs/api/validation.ts` |
| Styling | Tailwind CSS 4 + shadcn/ui | |
| i18n | `next-intl` | French primary; Arabic RTL and English also required by `PRODUCT-TRUTH.md` |
| Testing | Vitest | `src/app/api/security.test.ts` is the only real test file so far |
| Container | Docker, multi-stage | `Dockerfile` (deps → migrator/builder → runner), `docker-compose.yml` (db → migrate → app) |

### Multi-tenancy model
Every tenant-scoped table has a `tenant_id` FK to `tenants`. There is **no** row-level security at the Postgres level — isolation is enforced entirely in application code via `requireTenant()` (see §4). Every query must filter by `tenantId`; there is no other safety net.

### The `user` table is polymorphic
There is no separate `students`/`staffs`/`guardians`-as-users table. A single `user` table (Better-Auth-compatible: `id`, `email`, `name`, session/account tables alongside it) carries a `role` enum (`super_admin`, `school_admin`, `teacher`, `accountant`, `student`, `parent`, `receptionist`, `guard`) plus a growing set of role-conditional columns (see `MIGRATION-NOTES.md`). This was an established pattern before this session and was continued rather than replaced, to avoid three competing architectures in one schema. `guardians` is a separate real table (not a `user` role) with its own `guardian_students` join table.

---

## 3. What exists and is real (verified live, not just typechecked)

| Domain | Route(s) | State |
|---|---|---|
| Auth | `/api/auth/*`, `/api/auth/me` | Real Better Auth sessions, real tenant/role context. `/api/auth/me` was already correct this session (a stale finding said otherwise). |
| Students | `/api/students` | Real `user` rows (`role='student'`), tenant-scoped, paginated, audited, Zod-validated. `classSectionId` is the real FK (this session); `level`/`className` are deprecated fallback text. |
| Staff/teachers | `/api/teachers` | Real `user` rows (`role='teacher'`). Assignments (`subjects`, `assignedClasses`) now computed from real join tables (this session), falling back to deprecated arrays. `teachers-manage-view.tsx` UI wired to fetch real data. `/api/teachers/import` is still fake — see §7. |
| Guardians | `/api/students/parents` | Real `guardians` table. `guardian_students` linking exists as a table but nothing populates it yet — see §7. |
| Users (staff/admin directory) | `/api/users` | Real, same pattern as above. |
| **Academic structure** | `/api/academics/{session-years,semesters,mediums,sections,streams,shifts,classes,class-sections,subjects,class-subjects,class-teachers,subject-teachers}` | 12 routes, real ESchool-aligned tables, full CRUD (except the two join-record routes, which are create+delete only by design). See §6 for the full design. All 10 corresponding UI views are now wired (were static as of the previous handoff version; fixed this session). |
| Finance | `/api/finance/{invoices,payments,expenses,fee-structures}` | Real, tenant-scoped, authorized. Invoice/payment list + detail pages, payment-entry form, expenses CRUD, and a (simplified) fee-structures CRUD are all wired to real data. |
| Attendance | `/api/attendance` | Real, tenant-scoped. UI wired (was previously built but never called by its own page — fixed this session). |
| Students (extended) | `/api/students` (`?id=` detail, `?classSectionId=` filter), `/api/students/{admissions,transfers,promotions,matricules,import}` | Profile page, admissions kanban, transfers, promotions, matricules, and CSV import are all real and wired. `/api/students/photos` is authenticated but still has no real file-storage backend (deliberately deferred, see §7). |
| Teachers (extended) | `/api/teachers` (`?id=` detail), `/api/teachers/import` | Profile page and CSV import are real (the import route no longer returns a hardcoded `71` — it was a fake stub, now fixed). |
| Settings | `/api/settings`, `/api/settings/access-reset` | Both are now authenticated and tenant-scoped (were previously wide open — a real security fix, not just a wiring gap). `settings` persists to a real `schoolSettings` table (was an in-memory object shared across every tenant). `access-reset` is still backed by mock request data server-side (no real credential-reset flow exists) but is no longer callable by an anonymous user. |
| Analytics | `/api/analytics` | New route, real 6-month enrollment/revenue trend + attendance rate, reusing `/api/dashboard/summary`'s aggregate-query pattern. |
| Not built, explicitly deferred | assessments/grading, optional-subjects, communication (SMS), documents/generator (PDF report cards), students/photos storage, super-admin platform | See §7 — each needs a real design decision first, not just a missing route. |

### Security foundation (Phase 2, complete)
- `src/libs/api/context.ts` — `requireRequestContext(request, allowedRoles?)` returns `{ userId, tenantId, role, name, email }`, throws `ApiError(401, 'UNAUTHENTICATED', ...)` if no session, `403 ACCOUNT_DISABLED` / `403 TENANT_DISABLED` / `403 ROLE_NOT_ALLOWED` / `403 FORBIDDEN` as appropriate. `requireTenant(context)` throws if the user has no tenant (only `super_admin` may lack one).
- `src/libs/api/errors.ts` — `ApiError` class + `apiErrorResponse(error)` catch-all. **As of this session**, it also translates raw Postgres constraint violations into clean responses: SQLSTATE `23505` (unique) → `409 ALREADY_EXISTS`, `23503` (FK) → `409 IN_USE`. **Important gotcha**: Drizzle wraps the real pg error under `.cause` (`DrizzleQueryError`), not on the outer thrown object — the code checks both (`pgErrorCode()` helper). This bit us once already this session; do not "simplify" it back to checking only `error.code`.
- `src/libs/api/validation.ts` — one Zod `.strict()` schema pair (`xCreateSchema`/`xUpdateSchema`) per resource, rejecting mass-assignment. `parseJson(request, schema)` is the shared entry point, throws `422 VALIDATION_ERROR` on failure.
- `src/libs/api/pagination.ts` — `parsePagination(searchParams)` → `{ page, pageSize, limit, offset }`, defaults 1/20, cap 100.
- `src/libs/api/audit.ts` — `recordAudit(context, action, entityType, entityId, metadata?)`, fire-and-forget (a logging failure must never fail the request), writes to `audit_logs`.
- `src/app/api/security.test.ts` — 8 tests, mocks `@/libs/auth`'s session lookup, runs against a **real** Postgres (`describe.skipIf(!process.env.DATABASE_URL)`). Covers 401/403/tenant-isolation/422/409-self-delete/cross-tenant-delete-noop. Wired into CI (`.github/workflows/CI.yml`'s `unit` job, with a Postgres service container).

**The pattern every new route must follow** (copy `src/app/api/students/parents/route.ts` or `src/app/api/teachers/route.ts` as the template): `requireRequestContext(request, ['school_admin'])` → `requireTenant` → Zod `.strict()` validate → tenant-scoped query with `parsePagination` on GET → `recordAudit` on every mutation → `apiErrorResponse` catch-all.

---

## 4. CI/CD and Docker (fixed this session, verified working)

- **The CI workflows lived at `schoolos-app/.github/workflows/` and had never run once** — GitHub only reads `.github/workflows/` at the git repo root, which is `schoolos-english-center-project-fully/`, one directory up. Moved. `.github/workflows/CI.yml` now has `build`, `static`, `unit` (Postgres service container), and `docker` (build-only, no push) jobs, all working with `defaults.run.working-directory: schoolos-app`.
- **`Dockerfile`**: multi-stage (`base` → `deps` → `migrator`/`builder` → `runner`). Node 24 (matches `package.json` `engines`). `.npmrc` sets `legacy-peer-deps=true` (a real, load-bearing peer conflict: `react-day-picker@8` wants `date-fns@2||3`, repo runs `date-fns@4` — upgrade path is `react-day-picker@9`, not a workaround to remove casually) and retry settings (a cold `npm ci` install is ~9–15 min; a slow registry connection has already timed out a build once). The builder stage passes build-only env sentinels (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`) so Next can collect route metadata without a real database; CI verifies the sentinels never leak into the standalone output.
- **`docker-compose.yml`**: `db` (Postgres 17) → `migrate` (one-shot, `target: migrator`, runs `drizzle-kit migrate`, `restart: "no"`) → `app` (gated on `migrate` completing successfully). No host port on `db` (security). Requires a local `.env` with `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET` (32+ chars) — **there is no `.env.example` committed; write one before handing this off if it doesn't exist**, since compose will hard-fail on the `?:` required-var syntax without it.
- **Full verification loop used throughout this project** (repeat this for every schema change): spin up a throwaway Postgres container → `drizzle-kit migrate` → `drizzle-kit generate` must report *"No schema changes, nothing to migrate"* → `docker compose up -d --build` → build the `builder` stage separately and run `npx tsx src/scripts/seed.ts` against the compose network to seed demo data → log in via `/api/auth/sign-in/email` → hit routes with `curl` for real 200/401/403/422/409 behavior. Typecheck (`tsc --noEmit`) and lint (`eslint --fix`) alone are not sufficient — two real bugs this session (below) were only caught by this live loop.

**Seeded demo login** (via `src/scripts/seed.ts`, requires `SCHOOL_ADMIN_SEED_PASSWORD` env var at seed time): `y.elamrani@atlas.ma` / whatever password you set, tenant "Groupe Scolaire Atlas".

---

## 5. Two real bugs found by live testing this session — do not reintroduce

1. **Postgres error codes live under `error.cause`, not `error`.** Drizzle-orm throws a `DrizzleQueryError` wrapping the real `pg` error. `apiErrorResponse`'s constraint-translation originally checked only the outer `error.code` and silently never matched, turning every unique/FK violation into an unhelpful 500. Fixed in `src/libs/api/errors.ts` (`pgErrorCode()` checks both). If you add new error-translation logic anywhere, check `.cause` too.
2. **`docker compose up -d --build` run in the background/piped through `tail` can report success while the running container is still the old image.** This session hit it twice: Docker Desktop crashed mid-rebuild once and silently auto-restarted the *previous* container on recovery (the `restart: unless-stopped` policy in `docker-compose.yml` did that, not a fresh build); separately, a backgrounded `docker compose up -d --build` call reported exit code 0 while the container stayed ~7 hours stale for reasons that were never fully diagnosed. **The reliable sequence**: run `docker compose build app` in the *foreground* (not backgrounded, not piped through `tail -N` which can hide the real error) and read its full output — if there's a real TypeScript error, this is where it surfaces (see bug 3 below), not in a standalone `tsc --noEmit`. Only after a clean `Image schoolos-app-app Built` line, run `docker compose up -d` separately. Verify freshness by hitting a route that only exists in the new code and confirming it's not 404 — don't trust the container's reported "Up N minutes" or "Created" timestamp, both were misleading during this session's incidents.
3. **`npx tsc --noEmit` does not always agree with `next build`'s internal type-check, even against the same `tsconfig.json`.** Concretely: `const [header, ...rows] = someStringArrayArray` was typed as `header: string[] | undefined` inside `next build`'s check (destructuring the first element of an array type isn't guaranteed non-empty) but `tsc --noEmit` run standalone did not flag it across several runs in this session. Root cause not fully pinned down. **Practical rule**: `tsc --noEmit` is a fast pre-check, but the actual gate before rebuilding the container is `docker compose build app`'s TypeScript step — this matches what `CLAUDE.md` already said (`npx next build` after significant edits) and should have been followed literally instead of substituting a plain `tsc` pass.
4. **`onDelete('cascade')` on reference-data foreign keys silently destroys unrelated data.** `classes.mediumId`, `classSections.sectionId`/`mediumId`, `subjects.mediumId`, `classSubjects.subjectId`, `subjectTeachers.subjectId` were originally written with `.onDelete('cascade')` (copied reflexively from the tenant-scoping FK pattern used everywhere else). This meant deleting one "medium" (e.g. "Français") would cascade-delete every class, section, subject, and assignment built on it — and it silently defeated the intended `409 IN_USE` behavior on those DELETE routes. Fixed via migration `0008_restrict_academic_reference_deletes` (no `onDelete`, defaults to `RESTRICT`). **The rule going forward**: a FK from a structural row to its true parent (e.g. `classSections.classId` → `classes`) may cascade; a FK from a structural row to shared *reference/configuration* data (mediums, sections, streams, shifts, subjects, semesters) must **not** cascade — it should block deletion so the API can return a clean `IN_USE` error instead.

---

## 6. Academic structure — full design (this session, plan-approved)

**Why this exists:** the user asked whether the students/teachers work "follows the logic from ESchool." It partially didn't — teacher-subject-class assignment and student class placement were free-text/array stopgaps on `user` because no classes/sections/subjects tables existed. This session built them.

**A landmine that was checked and avoided**: the schema already contained an unrelated `programs`→`courses`→`studentGroups`→`programEnrollments`/`courseEnrollments`→`timetableSlots`/`rooms` chain, leftover from the original Next.js "saas-boilerplate" template (course/LMS-shaped, not K-12-shaped). **Confirmed dead — grep shows zero files in `src/` read or write it.** Do not build on it, do not "clean it up" either (out of scope, not asked for). The UI's own `src/features/academics/ui/*` views are already named with ESchool's exact K-12 vocabulary (`mediums-view.tsx`, `classes-view.tsx`, etc.), confirming the *intended* target was always the ESchool-shaped model.

**Tables added** (`src/models/Schema.ts`, migration `0007_add_academic_structure` + `0008` for the FK fix):
- Tier 1, plain tenant-scoped reference tables (schools configure their own — matches `PRODUCT-TRUTH.md` §11 "configurable per school"): `sessionYears`, `semesters`, `mediums`, `sections`, `streams`, `shifts`.
- Tier 2: `classes` (→ medium required, shift/stream optional), `classSections` (class × section, `mediumId` always derived server-side from `classId`, never client-supplied).
- Tier 3: `subjects` (→ medium), `classSubjects` (class × subject, no DB unique constraint — see code comment on why; duplicate-assignment prevention is at the API layer, scoped per semester).
- Tier 4: `classTeachers`, `subjectTeachers` — pure join tables, `teacherId` → `user.id` directly (no separate `staffs` table, matching the established `user`-is-polymorphic pattern). **No PUT route** for either — reassignment is delete + recreate.
- Tier 5: `user.classSectionId` (nullable FK, `onDelete('set null')`).

**Two enums added**, and *only* these two — everything else is a plain table: `subjectType` (`theory`/`practical`), `classSubjectType` (`compulsory`/`elective`). These are fixed business categories, not school-configurable lists.

**Consumer changes**: `studentCreateSchema`/`studentUpdateSchema` dropped `level`/`className`, added `classSectionId`. `teacherCreateSchema`/`teacherUpdateSchema` dropped `subjects`/`assignedClasses` entirely — assignment now only happens via `POST /api/academics/class-teachers` / `subject-teachers`. Both routes' response mappers fall back to the deprecated columns only when a row has no real linkage yet (pre-migration data).

**Deliberately not built** (see `task_plan.md` and `MIGRATION-NOTES.md` for the full reasoning): UI wiring for the 13 static `academics/ui/*` views, elective subject groups, admissions/enrollment fields on students (`admission_no`/`roll_number`/session-year linkage), teacher-scoped object-level access (a teacher seeing only their own classes), attendance/grading/timetable (separate Phase 4 bullets), dropping the now-deprecated stopgap columns (needs a verified-empty-usage audit first, not safe to do blind).

---

## 7. Known, explicitly-deferred gaps (do not silently "fix" without discussing scope — each is genuinely a separate, larger effort)

*(This table was rewritten this session — most of the previous version's entries, e.g. `guardian_students` linking, the 13 static academics views, admissions/transfers/promotions, are now done. See `FULL-APP-AUDIT.md` for the full page-by-page history if you need it.)*

| Gap | Why it's deferred |
|---|---|
| Assessment/grading system (`gradingScales`→`assessmentCriteria`→`assessmentPlans`→`assessmentPlanCriteria`→`assessments`→`assessmentResults`→`assessmentResultDetails`) | This is a full weighted-rubric grading engine with zero existing UI, API, or seed data. **More importantly: `assessmentPlans`/`assessments` have no column linking them to a class or subject at all** (`assessmentPlans.courseId` points at the dead LMS `courses` table, not the real `classSubjects`) — "which class is this assessment for" isn't answerable from the current schema. Needs a schema decision (likely a `classSubjectId` column added to `assessmentPlans`) before any route can be written. Blocks grade entry, report-card generation, and the "moyenne générale" stats that several other pages want to show. |
| `optional-subjects` (electives) | No dedicated schema beyond the `classSubjectType` enum (`compulsory`/`elective`) already on `classSubjects`. What "optional subjects" should model (student choice, capacity limits, elective groups) needs a real product decision, not inference from the fully-fake UI that exists today. |
| Communication (SMS reminders/templates) | No schema (templates, send-log) *and* no chosen SMS provider/gateway. Needs both decided before a route is meaningful. |
| Documents/generator (Massar-style report-card PDF) | Blocked on the assessment-schema gap above (needs real grades to render) plus a PDF-generation approach (no library installed). |
| `students/photos` real storage | Route is authenticated and tenant-scoped but has no real backend — needs a file-storage decision (S3-compatible bucket vs. local disk + served route) as its own small design pass. |
| Super-admin / platform-SaaS surface (10 pages: schools, subscriptions, sms, reports, support, platform settings) | Entirely static, zero API, zero schema (no `subscriptions`/`billing`/`platform_*` tables exist). Only the `role === 'super_admin'` layout guard is real. This is a from-scratch SaaS-ops build, not a wiring task — treat as its own project with its own plan. |
| Root `schoolos-app/` at the `schoolos/` root (sibling, **different** codebase) | 32 UI packages imported in `src/` but never added to `package.json`, 169 TypeScript errors, CI red. Entirely separate from everything above — do not confuse the two `schoolos-app` directories. |

---

## 8. History worth knowing (so you don't repeat investigation already done)

- The Postgres/Drizzle/Docker setup did not exist at the start of this multi-session effort — it began as a SQLite prototype (`better-sqlite3`, inline table creation in `src/lib/db.ts`) with zero auth. That file and pattern are gone now; if you see any reference to it, it's stale.
- A prior agent session (before this one) built the security foundation (Phase 2: Better Auth wiring, `requireRequestContext`, RBAC, Zod validation, `students`/`users`/`guardians` initial ports) using a "persistent migration planning" methodology — `task_plan.md`, `findings.md`, `progress.md` are its artifacts, and this session continued updating them rather than starting fresh ones. Keep doing this.
- `migrations/meta/0003_snapshot.json` was once missing (a migration was hand-written without running `drizzle-kit generate`), which silently corrupted every subsequent `generate` call into re-emitting an already-applied enum change. It was repaired. **Always run `drizzle-kit generate` after any hand-edit to a migration file**, and always do the fresh-DB-then-generate check described in §4 before considering a migration done.

---

## 9. Immediate next steps, in priority order

1. **Assessment/grading schema design** — the single highest-leverage remaining item. Unblocks grade entry, report cards, and several stats other pages already have placeholder UI for. Needs a product decision (how does an assessment link to a class/subject?) before any code.
2. **Communication (SMS) schema + provider decision** — needed before `communication/reminders`/`communication/templates` can become real.
3. **Super-admin platform** — scope as its own project (subscriptions/billing schema from scratch), not bundled with anything else.
4. **`students/photos` file storage** — small, self-contained infra decision (S3-compatible bucket vs. local disk).
5. Root `schoolos-app/` dependency fix — separate codebase, unrelated to the above, entirely your own call on priority.

Do not start any of these without re-reading `task_plan.md`'s current `Status` lines and `~/.claude/plans/whimsical-painting-turtle.md` (sections 7.5/7.6 and 8) first — they may have moved since this document was written.

---

## Note on other files in this directory

`AGENT-TASK-LOG.md` (repo root) is a separate, older, append-only convention from the pre-`PRODUCT-TRUTH.md` era ("Antigravity" + a planner/coder agent pair). It has not been used or updated during this session's work — `task_plan.md`/`findings.md`/`progress.md` (inside `schoolos-app/`) are the actively-maintained logs. Don't mix conventions; update those three, not this one, unless the user asks otherwise.
