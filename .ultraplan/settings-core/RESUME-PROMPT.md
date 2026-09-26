# RESUME PROMPT — SETTINGS-CORE-FIX-01, from here to the end, no stopping

Paste everything below this line into a fresh session.

---

TASK: Finish SETTINGS-CORE-FIX-01. A previous agent completed 8 of 24 tasks and stopped. Your job is the remaining 16, end to end, without stopping to ask.

Repo root: `C:\Users\OMEN\OneDrive\Documents\projects\lango-english-center-project-fully` (app in `lango-app/`). Branch `student-directory-hardening`. Other agents edit this tree right now.

## 0. Read these first, in this order

1. `AGENTS.md` (repo root) and `lango-app/CLAUDE.md`
2. `.agent-hub/PROTOCOL.md` and `.agent-hub/CONTEXT.md`
3. `.ultraplan/settings-core/PLAN.md` — THE spec. Owner decisions OD1–OD4, invariants, and every section SCF-01..SCF-11 with its tasks. Where this file and PLAN.md disagree, PLAN.md wins.
4. `.ultraplan/settings-core/AGENT-PROMPT.md` — the operating rules (hub usage, hard rules, report format)
5. `lango-app/artifacts/product-discovery/DISC-SETTINGS-CORE-01/report.md` + the analysis file named in each section you work on

## 1. Join the hub before you touch anything

```
node .agent-hub/hub.mjs join --agent <tool>-scf-2 --tool <tool> --note "SETTINGS-CORE-FIX-01 resume"
```

One identity for the whole run. One hub item per section: `task:scf-NN`.

**A previous agent (`claude-scf-1`) still holds these claims.** Its session is over. Either ask it to release, or take them over — the hub frees a claim whose agent has been silent past the 45-minute TTL, and `--force` works for a dead holder:

- `task:scf-02` — `libs/services/school-year.ts`, `features/teachers/server/teacher-service.ts`, `libs/services/subject-teacher-assignment.ts`, `libs/api/teacher-scope.ts`, `app/api/dashboard/summary/route.ts`, `app/api/__tests__/dashboard-summary.test.ts`
- `task:scf-03` — `features/academics/ui/academic-calendar-view.tsx`, `components/shared/dashboard-shell.tsx`, `locales/{fr,en,ar}.json`, `app/api/__tests__/session-year-open.test.ts`, `scripts/seed-full.ts`
- `task:scf-04` — `app/api/settings/route.ts`, `features/settings/services/onboarding-completeness.ts`, `features/settings/ui/organization-form-client.tsx`, `features/settings/ui/organization-page.tsx`
- `task:port-3491` — `lango-app/.next-scf1`

Claim every file before editing. Exit 3 means someone holds it: read `.agent-hub/PROTOCOL.md` §3, then `say --to <owner>`.

## 2. Exact state of the tree (2026-09-25, late evening)

All of this is **uncommitted**. Nothing was committed, pushed or deployed — and you must not either (see §7).

### 2.1 Done, tested, logged (8 tasks)

| Task | What landed | File(s) |
|---|---|---|
| SCF-01-01 | Matricule regex `/^(.*D)(d{3,})$/` → `/^(.*\D)(\d{3,})$/`; also repaired a silent bug where `reserveMatricule` probed its own driver with `db.insert(namingSeries).values()` (no args), Drizzle throws on zero args, the catch swallowed it and the follow-up UPDATE matched 0 rows — so a new prefix never got its `naming_series` row and the counter never advanced | `libs/services/matricule.ts` |
| SCF-02-01 | New canonical resolver; replaced **three** duplicate `getDefaultSessionYearId` copies (the plan lists two — `teacher-scope.ts` is the third); dashboard summary no longer resolves the year from today's date (OD1) | `libs/services/school-year.ts` (new), `teacher-service.ts`, `subject-teacher-assignment.ts`, `teacher-scope.ts`, `api/dashboard/summary/route.ts` |
| SCF-02-02 | Migration 0166: partial unique index `(tenant_id) WHERE is_default` + `EXCLUDE USING gist` non-overlapping `daterange`. Pre-checks and RAISEs, idempotent | `migrations/0166_session_year_guards.sql` |
| SCF-02-04 | Amber "year ended" banner, server-computed, school_admin only, `role="status"` | `components/shared/dashboard-shell.tsx` (+`banner` prop), `app/[locale]/(dashboard)/layout.tsx` |
| SCF-03-02 | Migration 0167: `languages`/`presence_modes` arrays → objects, `document_header_style 'classic'` → `'classique'`; seed fixed | `migrations/0167_school_settings_json_shapes.sql`, `scripts/seed-full.ts` |
| SCF-03-03 | Legal-identity before/after audit on the fields printed on official documents | `app/api/settings/route.ts` |
| SCF-08-01 | Core keys refused on create AND update (`422 RESERVED_KEY`); values validated against `field_type` and `select` options | `features/settings/services/custom-fields-service.ts` |
| SCF-10-02 | Migration 0168: `setting_values` unique index recreated `NULLS NOT DISTINCT` | `migrations/0168_setting_values_nulls_not_distinct.sql` |

Tests written (7 files, all in `lango-app/src/app/api/__tests__/`): `matricule-prefix.test.ts`, `school-year-single-source.test.ts`, `session-year-guards.test.ts`, `session-year-open.test.ts`, `settings-shapes-and-uniqueness.test.ts`, `settings-legal-history.test.ts`, `custom-fields-guards.test.ts`. **52/52 pass, 10 files** when run together.

Screenshots taken (3): `lango-app/artifacts/product-discovery/SETTINGS-CORE-FIX-01/screenshots/school_admin-{fr,ar}-home.png` + `school_admin-fr-phone-home.png`.

### 2.2 Partial (3 tasks)

- **SCF-02-03** — the API is done and tested (`app/api/academics/session-years/open/route.ts`: `GET ?preview=1&sessionYearId=…` returns the checklist, `POST { sessionYearId }` switches in one transaction and audits `previousDefaultYearId`/`newDefaultYearId`). **The UI does not exist**: no button on the year row, no dialog.
- **SCF-03-01** — the route stopped writing `academicYear`/`startDate`/`endDate`, and `onboarding-completeness.ts` now reads `session_years` via `getCurrentSessionYear`. **The Organisation page still renders an editable year block** in `organization-form-client.tsx` / `organization-page.tsx`.
- **SCF-10-01** — only the custom-field `reason` half. Years and semesters have no before/after audit.

### 2.3 Declined with proof (1 task)

**SCF-01-02** — the plan says replace `STD-${Date.now()}...` at `admission-service.ts:1202` with `reserveMatricule`. That line is the `user` row **primary key**, not a matricule: line 1199 already calls `reserveMatricule` for the matricule and line 1211 writes it. Applying it literally would set the PK to a matricule while the matricule column held a different, separately reserved number. The assertion the task asks for already exists at `admissions-workflow.test.ts:471-481`. **Do not do this task.** Report it as declined if you report at all.

### 2.4 Not started (12 tasks)

`02-05`, `04-01`, `04-02`, `05-01`, `06-01`, `06-02`, `07-01`, `07-02`, `08-02`, `09-01`, `09-02`, `11-01`. Specs are in PLAN.md; read each section as you reach it. Highlights:

- **04-01** — build the Attendance settings page (`features/settings/ui/attendance-settings-view.tsx`) over the existing registry keys via `GET/PATCH /api/settings/values/[key]`. No new API. Add a sidebar entry and a hub card.
- **04-02** — remove presence modes from Organisation; make `/settings/policies` a 307 redirect to `/dashboard/academics/grading/policies`.
- **05-01** — remove the weights table + "Ajouter une règle" + 100% badge from `features/grading/ui/assessment-policies-client.tsx`; remove the cosmetic cycle/level/trimester selectors; add the grading-scale select; keep pass mark, eliminatory mark, mention table, simulator.
- **06-01** — rewire `app/api/settings/numbering/route.ts` (+ sub-route) onto `naming_series` with a human label and next-number preview; PATCH may only RAISE `current_val` (409 otherwise) under the same advisory-lock key as `reserveMatricule`.
- **06-02** — `CAND-{year}-{index}` in `features/assessment/services/exam-master-service.ts:126` → `consumeDocumentNumber(tx, { tenantId, prefix: 'CAND-{year}-' })`. **NOTE: this file is held by `claude-bs-1` under `task:bs-w3`. Coordinate first.**
- **07-01** — dev data only, via `/api/super-admin/entitlements` + `/api/super-admin/schools/[id]/branches`: grant Atlas `multi-branch`, set `max_branches` = 2.
- **07-02** — `app/api/settings/branches/[id]/route.ts`: before deactivating, count active students/classes/pinned staff/active hostels+routes on that branch; any > 0 → 409 `BRANCH_IN_USE` with the counts. No force flag.
- **08-02** — "Champs personnalisés" card in `features/students/ui/student-detail-view.tsx`, inline edit via the existing `/api/settings/custom-fields/[id]/values` API.
- **09-01** — real completeness per card from canonical sources; hide the Translations and `/settings/jobs` cards + sidebar entries; point the Providers card at Broadcast → Connexions; filter "Modifications récentes" to settings entity types; remove the unused `aud-1..3` fixtures.
- **09-02** — hide `addon_definitions.enabled = false` from `/api/settings/addons` unless already entitled; SMS preview `{ecole}` → the tenant display name; super-admin fallback `'Atlas International'` → `'—'`.
- **11-01** — re-run the discovery probes and produce the before/after table for every P1/P2 item.

## 3. Environment facts (verified — do not rediscover these)

**Database.** `psql` is NOT on PATH. The Postgres runs in the Docker container `schoolos-db` on host port 5433.

- Ad-hoc SQL: `docker exec schoolos-db psql -U schoolos -d schoolos_audit -c "…"`
- Tests, always: `DATABASE_URL=postgresql://schoolos:local_dev_password_change_me@localhost:5433/schoolos_audit npx vitest run --project unit <pattern>`
- vitest hard-fails if `DATABASE_URL` names any database other than `schoolos_audit`. Write test data only there.
- `schoolos` (dev) = the app's dev DB, Atlas tenant + demo data. `schoolos_audit` = the seeded audit copy, 37 logins, password `Admin123!` (`y.elamrani@atlas.ma` = director).

**Migrations.** 0166, 0167, 0168 are written, registered in `migrations/meta/_journal.json` (idx 167/168/169, `when` 1790380000000 / 1790390000000 / 1790391000000) and **applied to both `schoolos_audit` and dev `schoolos`** (dev is now at 170 applied). Applying to dev also ran 0165, which dev was missing; it succeeded.

- **Any new migration's `when` must exceed 1790391000000**, or drizzle silently skips it on any DB where 0168 is applied. Drizzle tracks the highest applied `when`.
- Apply with `DATABASE_URL=… npm run db:migrate` (override the env var; dotenv does not).
- Migrations must be idempotent, register in `_journal.json`, fail loudly on bad data (RAISE, never repair), never bypass a trigger, never delete data.

**Dev server.** Port 3111 belongs to `claude-finance` (active) — do not touch it or its process. Start your OWN on a fresh port, claiming it first:

```
node .agent-hub/hub.mjs claim task:port-<n> --agent <you> --files lango-app/.next-<tag>
cd lango-app && NEXT_DIST_DIR=.next-<tag> BETTER_AUTH_URL=http://localhost:<n> NEXT_PUBLIC_APP_URL=http://localhost:<n> npx next dev -p <n>
```

**Login works on any port**, because `src/libs/auth.ts` builds `trustedOrigins` from approved tenant domains *plus* better-auth's own `baseURL` (`BETTER_AUTH_URL`). The old claim that login only works on 3111 is wrong.

Screenshots (login is handled for you):

```
cd lango-app
printf '/dashboard\n' > /tmp/routes.txt
AUDIT_BASE=http://localhost:<n> VIEWPORT=desktop LOCALE=fr node scripts/visual-sweep.mjs school_admin /tmp/routes.txt artifacts/product-discovery/SETTINGS-CORE-FIX-01/screenshots
```

Repeat with `VIEWPORT=phone` and `LOCALE=ar`. Every changed screen needs all three (PLAN invariant 5).

## 4. Traps discovered the hard way — read before you write tests

1. **`recordAudit` is fire-and-forget** (returns `void`, inserts in the background). Any test that asserts on audit output must POLL for the specific row it needs; asserting immediately, or taking `.find()` of whatever landed first, gives flaky results under parallel load. Three suites were flaky for exactly this reason.
2. **Every query on a tenant table needs `eq(table.tenantId, …)`** — including in tests. `schoolos_audit` holds several tenants, so an unscoped `select()` passes alone and fails alongside other suites. This bit three separate tests. Grep your own tests for it.
3. **Drizzle wraps pg errors**: the thrown error is a `DrizzleQueryError` and the pg `code` is on `.cause`. `apiErrorResponse` in `libs/api/errors.ts` unwraps it — assert through that, not on `error.code`.
4. **`migrations/meta/_journal.json` is CRLF-sensitive in diff terms** — parse it, push an entry, and write it back with `JSON.stringify(j, null, 2)` to keep the diff minimal.
5. **`locales/{fr,en,ar}.json` are CRLF.** Non-obvious ones are the string values themselves; ICU placeholders use `{name}`. Match `\r?\n` and re-emit with `\r\n` preserved, and check for duplicate keys before writing.
6. **`user.id` is `text`, no default** — every insert supplies one. Existing series: `STU-${Date.now()}`, `STU-${Date.now()}-${i}`. Several tables have NOT NULL FKs you must satisfy in fixtures (`class_sections.medium_id`, `timetable_versions.created_by` → `user.id`).
7. **`DashboardShell` / layout work is server/client split**: date logic goes in `app/[locale]/(dashboard)/layout.tsx` (async server), presentation in `components/shared/dashboard-shell.tsx` (`'use client'`), connected by the `banner` prop.
8. **The tree currently has one unrelated `tsc` error**: `src/app/api/academics/online-exams/[examId]/questions/[questionId]/route.ts`. Not yours. Verify types over YOUR file set and report the rest as pre-existing.
9. **`src/app/api/finance/invoices/[id]/cancel/cancel-race.test.ts` fails 3/3** even in isolation: the route now calls `assertStudentBranchScope` (`libs/api/portal-scope.ts:100`), which calls `db.select(...)`, but that test's `vi.mock('@/libs/DB')` has no `select`. Not yours.

## 5. Known blockers and how to route around them

- **`claude-bs-1` holds `task:bs-w3`**, which covers `src/app/api/academics/session-years/`, `.../semesters/`, `.../online-exams/`, `.../exam-halls/` and `src/libs/services/exam-master-service.ts`. That blocks **SCF-06-02** and **SCF-10-01** (years/semesters audit). Message them for a subpath exclusion, or do those two last.
- **Do not re-force-release the locale files** unless they are actually locked again; the previous take-over is done and `claude-finance` has said the owner asked to skip translations for their own work.
- **`fee_structures` has no `session_year_id`** (it scopes by program / academic term / branch), so the plan's "fee structures for the target year (count)" checklist item is not implementable. The existing route returns the tenant's ACTIVE count and flags `activeFeeStructuresScope: 'tenant'`. Leave it, or ask the owner to re-scope.
- **SCF-11 cannot be self-verified** — the plan forbids it and the hub's `verify` requires a different agent. Produce the evidence and the before/after table; leave the stamp to someone else.

## 6. Order of work

`02-03 UI → 02-05 → 03-01 UI → 04-01 → 04-02 → 05-01 → 06-01 → 07-01 → 07-02 → 08-02 → 09-01 → 09-02 → 10-01 → 06-02 → 11-01`

(06-02 and 10-01 sit last because of the `bs-w3` conflict; 11-01 is last because it verifies everything else.)

After EVERY section:

1. Run that section's tests, then `npm run check:types`, `npm run check:isolation`, `npm run check:ui`, and `node scripts/check-missing-i18n-keys.mjs` when locales changed.
2. Screenshots of every changed screen: FR desktop, 390px, AR — into `lango-app/artifacts/product-discovery/SETTINGS-CORE-FIX-01/screenshots/`.
3. `node .agent-hub/hub.mjs done task:scf-NN --agent <you> --summary "…" --files a,b --verify "<exact command> -> <real result line>"`

`done` refuses without summary, files and verify. Never mark done something you did not run. Heartbeat every ~20 minutes.

## 7. Hard rules (from AGENT-PROMPT.md — none of these bend)

- Tenant filter in every query. Capabilities unchanged. Your tests must keep proving isolation: cross-tenant 404, wrong role 403.
- **One canonical source per concept** (PLAN invariant 2). Never add a new store for something that already has one. Reuse `getEffectiveValue`/`setSettingValue`, `reserveMatricule`, `consumeDocumentNumber`, `recordAudit`, `getCurrentSessionYear`.
- Migrations 0166–0168 only as written; new ones need owner approval and a `when` above 1790391000000.
- DB tests only on `schoolos_audit`.
- Dev data changes (Atlas year switch, Atlas multi-branch) only through the app's own APIs/screens, logged in the done note.
- Retired features are **hidden, not deleted**.
- New text only through next-intl keys in fr/en/ar.
- **No git commit, push, merge, stash, reset, checkout, restore, switch or clean. No deploys. Nothing on the VPS.**
- Never verify your own work. Never use a second identity.
- Never run `git add -A`. Never kill a process you did not start.
- Do not fix things outside the plan; list them at the end.
- Smallest diff that satisfies the task. Done means the task's verify passes, not that the code looks right.

## 8. Report when finished

- Per section: files, exact test command → real result, screenshot paths.
- The SCF-11 before/after table for every P1/P2 item of the discovery report.
- Migrations applied (numbers) on `schoolos_audit` and dev.
- The list of the ~24 remaining `isDefault` queries (search the tree; the plan defers them to the enhance phase).
- Anything you could not do and why; owner steps still needed.
- Claim nothing the hub events and command output do not show.
