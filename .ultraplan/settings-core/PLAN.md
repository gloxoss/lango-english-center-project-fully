# Settings core fixes (plan SETTINGS-CORE-FIX-01)

Source: discovery `lango-app/artifacts/product-discovery/DISC-SETTINGS-CORE-01/` (report.md + 18 analysis files, 2026-09-25). Plan author: claude-finance. Executor: **one** agent (AGENT-PROMPT.md). Verifier: a different agent afterwards (VERIFY-PROMPT.md). Enhancements come after verification (section E, not in this run).

## Owner decisions (2026-09-25, final)

| ID | Decision |
|---|---|
| OD1 | **Current school year = manual flag `session_years.is_default`**, plus an "Ouvrir la nouvelle année scolaire" action with a checklist, and a warning banner when today is outside the current year. Atlas is switched to 2026-2027. The dashboard stops using the date rule. |
| OD2 | **Atlas is a multi-campus demo**: `multi-branch` add-on on, `max_branches` = 2. |
| OD3 | **Numbering page is connected to the real counters** (`naming_series`); the unused `numbering_series_definitions` system is retired from the UI. |
| OD4 | **Grading evaluation weights are hidden** until an averaging rule is designed with the school. |

Planner defaults (owner can overturn): pass mark and grading scale are edited only on the Grading page; parent SMS, lateness and alert thresholds move to the Attendance settings page; `/settings/policies` becomes a redirect to Grading; the Translations card and sidebar entry are hidden (page kept, not deleted); the Providers card points to Broadcast → Connexions; the `/settings/jobs` card is hidden (Scheduled tasks is the real one).

## Invariants

1. Tenant filter in every query; capabilities unchanged (the audit proved isolation: keep it proven).
2. **One canonical source per concept**: school year = `session_years`; current year = `is_default` through ONE helper; sequences = `naming_series`; attendance rules = registry keys.
3. Migrations: next free number is **0166** (0165 = branch-scope backfill). Register each in `migrations/meta/_journal.json` with a `when` greater than the last entry. Idempotent. Never bypass a trigger.
4. No deletion of tables or data in this run. Retired features are hidden, not dropped.
5. Every changed behaviour gets a test on `schoolos_audit`. Every changed screen gets a screenshot (FR desktop, 390 px, AR).
6. Do not touch files claimed by other agents (branch-scope `task:bs-*`, attendance reform `IMPL-ATTENDANCE-*`); coordinate through the hub.

## Sections (run in order; one hub item each: `task:scf-NN`)

---

### SCF-01 Matricule generator (green)

<task id="01-01">
  <name>Restore the format regex and pin it with a real test</name>
  <files>lango-app/src/libs/services/matricule.ts, lango-app/src/app/api/__tests__/matricule-prefix.test.ts (new)</files>
  <action>Line 29: `/^(.*D)(d{3,})$/` → `/^(.*\D)(\d{3,})$/`. New DB test on schoolos_audit, no mocks: tenant whose latest student has matricule `ATL-2526-0006` → `currentTenantPrefix` returns `ATL-2526-` and `reserveMatricule` returns `ATL-2526-0007`; tenant with no matricule → `STD-{year}-0001`.</action>
  <verify>New test passes; `grep -n "(.*D)(d" src/libs/services/matricule.ts` → nothing.</verify>
</task>

<task id="01-02">
  <name>One generator for admissions</name>
  <files>lango-app/src/features/students/services/admission-service.ts</files>
  <action>Line ~1202 `STD-${Date.now()...}` → `await reserveMatricule(tx, tenantId)` inside the same transaction. Nothing else.</action>
  <verify>Existing admissions tests pass; one assertion added that an admission-created student gets the tenant's sequential format.</verify>
</task>

### SCF-02 School year: one source, one rule, lifecycle (red)

<task id="02-01">
  <name>One current-year helper, used everywhere</name>
  <files>lango-app/src/libs/services/school-year.ts (new), lango-app/src/features/teachers/server/teacher-service.ts, lango-app/src/libs/services/subject-teacher-assignment.ts, lango-app/src/app/api/dashboard/summary/route.ts</files>
  <action>`getCurrentSessionYear(tenantId)` → the `is_default` row (id, name, startDate, endDate) or null. Replace both `getDefaultSessionYearId` copies with it (keep the old names as one-line re-exports only if other files import them). In dashboard summary, replace the date-window resolution with the helper (OD1). Do NOT rewrite the other ~24 `isDefault` queries in this run; list them in the done note for the enhance phase.</action>
  <verify>Test: dashboard summary and students list resolve the same year when today is outside the default year.</verify>
</task>

<task id="02-02">
  <name>Database guards for years</name>
  <files>lango-app/migrations/0166_session_year_guards.sql, lango-app/migrations/meta/_journal.json</files>
  <action>Partial unique index `session_years(tenant_id) WHERE is_default`; exclusion constraint (btree_gist, already installed) preventing overlapping `[start_date, end_date]` per tenant. Pre-check query in the migration header comment; if any tenant violates it, the migration must fail with a clear RAISE, not fix data.</action>
  <verify>Migrate schoolos_audit twice (second run no-op); test: inserting a second default or an overlapping year fails (23505 / 23P01 → mapped to 409 by errors.ts).</verify>
</task>

<task id="02-03">
  <name>"Ouvrir la nouvelle année scolaire" action + checklist</name>
  <files>lango-app/src/app/api/academics/session-years/open/route.ts (new), lango-app/src/features/academics/ui/academic-calendar-view.tsx, locales/{fr,en,ar}.json</files>
  <action>POST `{ sessionYearId }` (school_admin + `academics.manage`, zod strict): read-only checklist first (GET with `?preview=1`): target year exists and starts after the current one; count of students placed in the target year; published timetable version for the target year (yes/no); fee structures for the target year (count). POST sets it default in one transaction (existing logic in session-years route), audit with before/after year ids. UI: a button on the year row + a dialog showing the checklist and warnings (not blocking).</action>
  <verify>Route tests (preview counts, switch, cross-tenant 404, teacher 403); screenshot of the dialog.</verify>
</task>

<task id="02-04">
  <name>Warning when today is outside the current year</name>
  <files>lango-app/src/components/shared/dashboard-shell.tsx (or the existing header banner slot), locales</files>
  <action>For school_admin only: if today (Africa/Casablanca) is after the current year's end date, show a thin amber banner "L'année scolaire 2025-2026 est terminée. Ouvrir 2026-2027 →" linking to Academic Years. Server-computed; no banner when fine.</action>
  <verify>Screenshot with Atlas before the switch; banner gone after 02-05.</verify>
</task>

<task id="02-05">
  <name>Switch Atlas on dev through the new action</name>
  <files>none (data via the app)</files>
  <action>As the Atlas director on the dev server, use the new action to open 2026-2027. Record the checklist values and the result in the done note. The VPS switch is an owner step after deploy (listed in the report).</action>
  <verify>`/api/academics/session-years` shows 2026-2027 default; dashboard and students list agree.</verify>
</task>

### SCF-03 Organisation page cleanup (yellow)

<task id="03-01">
  <name>School year block becomes read-only</name>
  <files>lango-app/src/features/settings/ui/organization-form-client.tsx, lango-app/src/features/settings/ui/organization-page.tsx, lango-app/src/app/api/settings/route.ts, lango-app/src/features/settings/services/onboarding-completeness.ts</files>
  <action>Show the current session year (name + dates from `getCurrentSessionYear`) read-only with a link "Gérer les années scolaires". Stop sending/writing `academicYear/startDate/endDate` (make them optional in the schema; keep the columns). Completeness reads `session_years`.</action>
  <verify>Screenshot; saving the page no longer changes `school_settings.academic_year`; hub badge still correct.</verify>
</task>

<task id="03-02">
  <name>Repair seeded JSON shapes everywhere (fixes the "0 / 1" toggles on the VPS)</name>
  <files>lango-app/migrations/0167_school_settings_json_shapes.sql, _journal.json, lango-app/src/scripts/seed-full.ts</files>
  <action>Idempotent migration: `languages` JSON array (e.g. `["fr","ar"]`) → `{"francais":bool,"arabe":bool,"anglais":bool}`; `presence_modes` array → object with the 7 known keys (true for listed ones, and for a legacy array without status keys set all statuses true); invalid `document_header_style` → `classique`. Apply the same shapes in `school_settings` and the matching `setting_values` keys. Fix the seed to write the object shapes.</action>
  <verify>Run on schoolos_audit after inserting array-shaped fixtures: shapes fixed, second run no-op; `POST /api/settings` with the GET payload returns 200 (it returned 422 before).</verify>
</task>

<task id="03-03">
  <name>History for legal identity changes</name>
  <files>lango-app/src/app/api/settings/route.ts</files>
  <action>Before the upsert, read the current row; `recordAudit(..., 'school_settings', id, { changed: { field: { before, after } } })` for changed fields only (no values for unchanged ones). Remove `attendanceLateGraceMinutes`/`attendancePeriodStartTime` from this payload (they move to SCF-04; keep schema optional for old clients).</action>
  <verify>Test: changing ICE writes `{changed:{ice:{before,after}}}`.</verify>
</task>

### SCF-04 Attendance settings page (yellow; coordinate with the attendance reform)

<task id="04-01">
  <name>Build the page on the existing registry keys</name>
  <files>lango-app/src/features/settings/ui/attendance-settings-view.tsx, locales, lango-app/src/components/shared/sidebar.tsx, lango-app/src/features/settings/data/settings-hub-config.ts</files>
  <action>Replace the placeholder with a form over existing keys via `GET/PATCH /api/settings/values/[key]`: `attendance.lateGraceMinutes` (0–60), `attendance.periodStartTime` (HH:MM, labelled "utilisé par le scanner QR tant que les cours ne sont pas liés à l'emploi du temps"), `attendance.consecutiveAbsenceThreshold` (2–30), `attendance.repeatedLateThreshold` (2–30), `attendance.smsAlerts` (toggle), `attendance.presenceModes` (toggles with real labels). Validation messages, save button disabled when unchanged, success toast. Add the sidebar entry under Paramètres and a hub card. No new API.</action>
  <verify>Round-trip test per key (save → reload → value); screenshots 3 variants; `libs/api/attendance-flags.ts` picks up a changed threshold (existing tests + one new).</verify>
</task>

<task id="04-02">
  <name>Remove moved fields from the old pages</name>
  <files>organization-form-client.tsx (presence modes block), `/settings/policies` page</files>
  <action>Presence modes: remove from Organisation (now on Attendance). `/settings/policies`: redirect to `/dashboard/academics/grading/policies` (pass mark + scale move there, SCF-05; SMS moved to Attendance). Update the hub card and sidebar link accordingly.</action>
  <verify>`/settings/policies` → 307 to grading; no setting is editable in two places (grep the keys in `features/settings/ui` and `features/grading`).</verify>
</task>

### SCF-05 Grading policies (green)

<task id="05-01">
  <name>Hide weights, remove cosmetic selectors, host the scale</name>
  <files>lango-app/src/features/grading/ui/assessment-policies-client.tsx (+ -view.tsx, -page.tsx if needed), locales</files>
  <action>OD4: remove the weights table, its "Ajouter une règle" and the 100% badge; keep the stored key untouched. Remove the cycle/level/trimester selectors (they scope nothing). Add the grading scale select (/20, /100) next to the pass mark. Keep pass mark, eliminatory mark, mention table, simulator. The amber banner becomes "Les moyennes utilisent les coefficients des matières."</action>
  <verify>Screenshot; saving still writes passThreshold/eliminatoryScore/gradingScale; report-card tests unchanged.</verify>
</task>

### SCF-06 Numbering on real counters (yellow)

<task id="06-01">
  <name>Numbering page lists and edits `naming_series`</name>
  <files>lango-app/src/app/api/settings/numbering/route.ts, lango-app/src/app/api/settings/numbering/[id]/route.ts (or a new `naming-series` sub-route), lango-app/src/app/[locale]/(dashboard)/dashboard/settings/numbering/page.client.tsx, locales</files>
  <action>GET lists the tenant's `naming_series` rows with a human label (INV- → Factures, RC- → Reçus, matricule prefix → Matricules élèves, CAND- → Candidats, EMP- → Employés…) and the next number preview. PATCH may only RAISE `current_val` (never lower; 409 otherwise), under the same advisory lock key used by `reserveMatricule`/`consumeDocumentNumber`. Remove "Nouvelle série" and "Attribuer" from the UI; the old definitions API stays but is no longer linked. Audit with before/after.</action>
  <verify>Tests: list shows real counters; raise works; lower → 409; concurrent raise vs reserve never yields a duplicate number (two Promise.all calls); cross-tenant 404.</verify>
</task>

<task id="06-02">
  <name>Candidate numbers from a real sequence</name>
  <files>lango-app/src/features/assessment/services/exam-master-service.ts</files>
  <action>Line ~126: replace `CAND-{year}-{index}` with `consumeDocumentNumber(tx, { tenantId, prefix: 'CAND-{year}-' })` so numbers are unique across allocation runs.</action>
  <verify>Test: two allocation runs in the same year produce no duplicate candidate numbers.</verify>
</task>

### SCF-07 Branches (green; data + safety)

<task id="07-01">
  <name>Atlas multi-campus (OD2) on dev</name>
  <files>none (data via the super-admin API)</files>
  <action>As super-admin on dev: grant `multi-branch` to Atlas and set `max_branches` = 2 through `/api/super-admin/entitlements` and `/api/super-admin/schools/[id]/branches`. Record the calls. VPS: owner step after deploy.</action>
  <verify>`/settings/branches` renders for the Atlas director; "Campus inclus 2 / 2".</verify>
</task>

<task id="07-02">
  <name>Deactivation impact check</name>
  <files>lango-app/src/app/api/settings/branches/[id]/route.ts (coordinate: branch-scope may hold it; claim first)</files>
  <action>Before deactivating, count active students, classes, pinned staff and active hostels/transport routes on that branch; if any > 0, return 409 `BRANCH_IN_USE` with the counts. No force flag in this run.</action>
  <verify>Tests: branch with students → 409 with counts; empty branch → deactivated.</verify>
</task>

### SCF-08 Custom fields: safe and visible (yellow)

<task id="08-01">
  <name>Reserve core keys and validate values</name>
  <files>lango-app/src/features/settings/services/custom-fields-service.ts</files>
  <action>Refuse definition keys that shadow core fields (matricule, massar, massar_code, cin, name, first_name, last_name, email, phone, birth_date, gender, class, section) with 422 `RESERVED_KEY`. Values: validate against field_type (number, date ISO, boolean) and `options` for select; 422 otherwise.</action>
  <verify>Tests for both rules. Report (do not delete) the existing Atlas `matricule` definition in the done note.</verify>
</task>

<task id="08-02">
  <name>Show and edit student custom fields</name>
  <files>lango-app/src/features/students/ui/student-detail-view.tsx (or its info tab), locales</files>
  <action>A "Champs personnalisés" card listing active student definitions with their value; inline edit through the existing `/api/settings/custom-fields/[id]/values` API (school_admin only; read-only for others with `students.read`). Guardians and employees stay for the enhance phase.</action>
  <verify>Screenshot; round-trip test on one value.</verify>
</task>

### SCF-09 Hub truth and cleanup (green)

<task id="09-01">
  <name>Translations, real completeness, duplicates</name>
  <files>locales/{fr,en,ar}.json, lango-app/src/features/settings/ui/settings-hub-page.tsx, lango-app/src/features/settings/data/settings-hub-config.ts, lango-app/src/components/shared/sidebar.tsx</files>
  <action>Add `Settings.mod_documents_title/desc` (fr/en/ar). Completeness from canonical sources: Organisation = name + ICE + address; School year = a current year that contains today; Security = `security.requireTwoFactorForAdmins` set; Attendance = any attendance key set; Numbering = ≥1 naming_series row; Branches = ≥1 branch and (1 branch or add-on on). Hide the Translations and `/settings/jobs` cards and sidebar entries; Providers card links to Broadcast → Connexions. "Modifications récentes" filters to settings entity types. Remove the unused `aud-1..3` fixtures.</action>
  <verify>Screenshot; test for 3 completeness rules; no MISSING_MESSAGE in the dev console on `/settings`.</verify>
</task>

<task id="09-02">
  <name>Disabled modules hidden; tenant name instead of "Atlas"</name>
  <files>lango-app/src/app/api/settings/addons/route.ts (or its view), lango-app/src/features/communication/ui/sms-reminders-view.tsx, lango-app/src/features/super-admin/ui/super-admin-sms-view.tsx</files>
  <action>The school catalogue excludes `addon_definitions.enabled = false` unless already entitled. SMS preview `{ecole}` → the tenant's display name (already available in the view or via `/api/portal/me`); super-admin fallback `'Atlas International'` → `'—'`.</action>
  <verify>Test: disabled definition absent from `/api/settings/addons`; grep "École Atlas|Atlas International" in src → none.</verify>
</task>

### SCF-10 Audit and DB guards (green)

<task id="10-01">
  <name>Before/after on years and semesters; reasons accepted</name>
  <files>lango-app/src/app/api/academics/session-years/route.ts, lango-app/src/app/api/academics/semesters/route.ts, lango-app/src/features/settings/services/numbering-service.ts, custom-fields-service.ts</files>
  <action>Audit metadata `{ changed: {field:{before,after}} }` on update/delete for years and semesters. Accept optional `reason` (max 500) in the numbering and custom-field PATCH schemas and store it in their versions/audit.</action>
  <verify>Tests assert the metadata shape.</verify>
</task>

<task id="10-02">
  <name>Tenant-wide settings uniqueness in the DB</name>
  <files>lango-app/migrations/0168_setting_values_nulls_not_distinct.sql, _journal.json</files>
  <action>Recreate the unique index `setting_values(tenant_id, branch_id, key)` as `NULLS NOT DISTINCT` (Postgres 17 on dev and VPS). Pre-check for duplicates and RAISE if any (none today).</action>
  <verify>Migrate twice on schoolos_audit; inserting a duplicate tenant-wide key fails.</verify>
</task>

### SCF-11 Self-check before handing over (required)

<task id="11-01">
  <name>Re-run the discovery probes</name>
  <files>none (read the DISC evidence scripts; write results to lango-app/artifacts/product-discovery/SETTINGS-CORE-FIX-01/)</files>
  <action>Re-run `DISC-SETTINGS-CORE-01/evidence/visual.mjs` and `isolation.mjs` against the dev server with the fixed code; save outputs. Walk the 14 checks of `manual-review-guide.md` and record the new result per check. Full `vitest --project unit` on schoolos_audit, `check:types`, `check:isolation`, `check:i18n:keys`, `check:ui`.</action>
  <verify>Report: before/after table for every P1 and P2 item of the discovery report.</verify>
</task>

## Owner steps after deploy (not for the agent)

1. VPS: open 2026-2027 for Atlas with the new button.
2. VPS: grant Atlas `multi-branch` + `max_branches` 2 in super-admin.
3. VPS: delete the `test` addon definition in super-admin.
4. Deploy with `-WithMigrate` (0166–0168).

## Deferred to the enhance phase (section E)

Terms per school year; replacing the remaining ~24 `isDefault` queries with the helper; historical-year browsing; custom fields on guardians/employees and in import/export; translation overrides wired into next-intl (or page removal); evaluation-weight averaging (OD4 follow-up); providers merged into Broadcast; multi-instance-safe schedulers; branch per-setting values.
