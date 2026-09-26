# SETTINGS-CORE-FIX-01 — execution report

Everything below was produced against the uncommitted working tree on branch
`student-directory-hardening`, dev server `http://localhost:3537`
(`NEXT_DIST_DIR=.next-scf3`, dev DB `schoolos`), DB tests on
`postgresql://schoolos:...@localhost:5433/schoolos_audit`.
Executor: `claude-scf-3` (took over the dead `claude-scf-2` session), 2026-09-26.

Evidence in this folder: `screenshots/` (targeted proofs, FR desktop / FR 390px /
AR desktop), `isolation-after.json` + `isolation-scf3.mjs` (probe re-run),
`visual-scf3.mjs` + `visual-results-after.json` (full settings sweep),
`scf-02-03-02-05-evidence.json`, `apply-locales-scf3-*.mjs` (locale key sets),
`TRANSLATIONS-NEEDED.md`.

## Gates

| Gate | Result |
|---|---|
| `npx vitest run` (full unit suite, schoolos_audit) | **293 files, 3667 tests passed, 0 failed** (`full-suite-after.txt`) |
| `npx vitest run <SCF files>` | 111 tests passed across 21 files (see per-section proof) |
| `npm run check:isolation` | PASS — 844 files, 790 tenant-scoped, no client-bound tenantId |
| `npx tsc --noEmit` | 0 errors in `src/`; the only 5 errors are the pre-existing `scripts/check-branch-parity.ts` ones owned by claude-bs-2 |
| `node scripts/check-missing-i18n-keys.mjs` | 27 missing, all `Parent.grades*` + `Navigation.parentGrades` owned by GRADES-CANONICAL-01; 0 from SETTINGS-CORE-FIX-01 after the locale pass |
| `npm run check:ui` | PASS — ratchet holding; unlinked pages raised 21→23 deliberately (hidden Translations/jobs pages, documented in `scripts/ui-reality-baseline.json`) |
| Live screens | 36 targeted screenshots + full sweep (41 routes × FR desktop / FR 390px / AR), 0 API 5xx, 0 horizontal overflow |

### Two full-suite failures found and repaired by the self-check

The first full-suite run after all sections surfaced two fixture tests that had
not caught up with this plan's rules:

1. `features/live-classrooms/services/live-classrooms-db.test.ts` inserted a
   second `session_years` row with the same date range as the tenant's existing
   year — migration 0166 (`session_years_no_overlap`) correctly refused it
   (23P01). The fixture now reuses the tenant's existing year (falling back to
   an insert when the block runs alone). 59/59 pass, including the file's own
   "exactly one wins, the other gets 23P01" test.
2. `features/settings/__tests__/onboarding-flow.test.ts` still asserted the old
   completeness rule (logo + address + `school_settings.academic_year`).
   SCF-03-01 moved the year to `session_years.is_default`, so the test now
   creates a real default year before expecting `true`. 4/4 pass.

A third load-sensitive test was hardened afterwards:
`src/app/api/__tests__/settings-legal-history.test.ts` test 3 read all audit
rows of the shared tenant although `recordAudit` is fire-and-forget, so under
full-suite concurrency a straggler from tests 1–2 could commit after the
`beforeEach` delete. It now runs on its own tenant and waits for both of its
saves (`task:scf-legal-history-flake`). Unrelated load-sensitive suites outside
this plan (`student-transfers-domain.test.ts`, `license-expiry-worker.test.ts`)
pass in isolation and the final full-suite artifact is green.

## Before / after per discovery finding

### P1

| # | Finding (DISC report) | Status | After, with evidence |
|---|---|---|---|
| 1 | Two "current school years": 26 files `is_default`, dashboard used today's date | FIXED | One helper `libs/services/school-year.ts getCurrentSessionYear`; dashboard summary resolves through it (test `school-year-single-source`: 4 passed). Atlas switched to 2026-2027 via the new action (evidence `scf-02-03-02-05-evidence.json`); calendar shows 2026-2027 « Par défaut » (`scf02-05-calendar-*`) |
| 2 | School year stored twice (Organisation page had its own copy) | FIXED | Organisation year block is read-only from `session_years` + « Gérer les années scolaires » (`scf03-01-organization-*`); `POST /api/settings` no longer writes `academic_year/start_date/end_date` (test `settings-legal-history` #2: a contradictory body leaves the row untouched) |
| 3 | Matricule regex lost its backslashes; new students got `STD-…` | FIXED | `matricule.ts:29` `/^(.*\D)(\d{3,})$/`; `matricule-prefix.test.ts` (verified by claude-finance 20:48) |
| 4 | Numbering page edited a store nothing consumed | FIXED | Page lists/raises the real `naming_series` (`numbering-series-raise` 5 passed; raise-only, lower → 409); live page shows « Matricules élèves ATL-2526 → ATL-25260201 » and « Factures INV-2026- → INV-2026-0201 » (`scf06-01-numbering-*`). Classification bug found live (INV-2026- labelled as matricule) fixed and pinned |
| 5 | Attendance settings page was a placeholder | FIXED | Real page over the 6 registry keys with round-trip test (`attendance-settings-roundtrip` 2 passed) and threshold-at-runtime coverage (`attendance-calendar-p0` G12.6b) |
| 6 | Seeded JSON shapes wrong; "0 / 1" toggles; POST rejected 422 | FIXED | Migration 0167 rewrites array shapes in `school_settings` + `setting_values`, seed writes objects (`settings-shapes-and-uniqueness` 1–3). Dev fixed; VPS applies with the deploy |
| 7 | Branches unreachable for Atlas (2 campuses, no add-on) | OWNER STEP | Not done: needs super-admin 2FA (`task:scf-07-01`). 07-02 impact check shipped (`branch-deactivation-guard` 4 passed). Until the owner grants `multi-branch`, `/settings/branches` stays gated by design |

### P2

| # | Finding | Status | After |
|---|---|---|---|
| 8 | Grading weights saved but unused; cosmetic selectors | FIXED | Weights table, "Ajouter une règle", 100% badge and cycle/level/trimester selectors removed; grading scale select added; amber banner = coefficients note (`scf05-01-grading-policies-*`; `grading-policies-route` 7 passed, report-card tests unchanged) |
| 9 | Custom fields rendered nowhere; `matricule` shadows core | FIXED (display) / REPORTED | Card on the student page lists active student fields and edits them inline (`student-custom-fields-roundtrip` 3 passed: admin writes, teacher read-only 403, cross-tenant 404). Reserved-key guard + value-type validation in `custom-fields-service`. The Atlas `matricule` definition still exists as reported — not deleted (plan: report, do not delete) |
| 10 | Translations edits never reach the app | FIXED (hidden) | Card + sidebar entry hidden (page kept). Wiring into next-intl or removal is deferred to the enhance phase |
| 11 | Hub missing keys; heuristic badges; shallow conformity | FIXED (keys+badges) | `Settings.mod_documents_*` exist and `Settings.mod_attendance_*` added (x3). Badges now computed from canonical facts (`settings-hub-completeness` 5 passed). Cards hidden: Translations, jobs. Conformity % is still CNDP+PCG-based (unchanged; out of this plan's scope) |
| 12 | Pass mark editable on two pages | FIXED | `/settings/policies` redirects to grading; live check final URL `/fr/dashboard/academics/grading/policies` (`scf04-02-policies-redirect-fr.png`) |
| 13 | Years/semesters audit without before/after; no legal history | FIXED | `settings-audit-metadata` 4 passed: update/delete write `{changed:{field:{before,after}}}` for years and semesters; legal identity history `settings-legal-history` #1 |
| 14 | Disabled "test" module shown to schools | FIXED in catalogue | `addon-catalog-visibility` 3 passed (unbuilt/disabled definitions hidden from `/api/settings/addons`); deleting the "test" definition on the VPS is an owner step |
| 15 | Providers duplicates Broadcast; two jobs pages | FIXED (pointers) | Providers card → Broadcast → Connexions (live href verified); jobs card + sidebar entry hidden; full "providers merged into Broadcast" deferred (enhance) |
| 16 | DB gaps: single default year, overlapping years, tenant-wide uniqueness, candidate numbers | FIXED | 0166 partial-unique + btree_gist (guards test 4 passed); 0168 NULLS NOT DISTINCT (`settings-shapes-and-uniqueness` 4–5); CAND numbers from `consumeDocumentNumber` (`exam-seat-candidate-numbers`: two runs, no duplicate). Semesters-per-year stays deferred |
| 17 | Hard-coded "École Atlas" / "Atlas International" | FIXED | 09-02: SMS preview uses the tenant display name, super-admin fallback "—"; grep clean (`addon-catalog-visibility` + grep) |

## Manual review guide (14 checks, re-run on :3537)

| # | Check | Before (discovery) | After (this run) |
|---|---|---|---|
| 1 | Hub untranslated card | `Settings.mod_documents_title` raw | keys present; no `Settings.*` raw key on the page (`scf09-01-settings-*`, console has 0 MISSING_MESSAGE for Settings after the key pass) |
| 2 | Two school years | Organisation 2025-2026 vs calendar 2026-2027 | Organisation shows 2026-2027 read-only + link; identical to calendar |
| 3 | Active year vs today | 2025-2026 « Par défaut » although ended | 2026-2027 « Par défaut » (Atlas switched through the new dialog); banner logic covered |
| 4 | Languages "0 / 1" | array shapes | object shapes on dev and audit (0167) |
| 5 | Branches gated | redirect to Modules | unchanged by design until the owner grants the add-on (OD2 owner step) |
| 6 | "test" module | VPS only | catalogue excludes disabled definitions; VPS deletion = owner step |
| 7 | Attendance settings | « Fonctionnalité à venir » | real form (6 keys), 3 variants screenshot |
| 8 | Grading weights | saved, unused | weights hidden; coefficients note only |
| 9 | Pass mark in two places | same store, two pages | one page (`/settings/policies` 307) |
| 10 | Numbering has no effect | definitions store, 0 consumers | real counters, raise-only (`scf06-01-numbering-*`) |
| 11 | Matricule format split | STD-… instead of ATL-2526-… | regex fixed + test; sequence continues (`matricule-prefix`) |
| 12 | Custom fields not shown | nowhere | card on the student page (screenshot `scf08-02-student-custom-fields-*`) |
| 13 | Isolation | no leak found | re-run: all cross-tenant probes refused, `langoSeesAtlasIds: no` everywhere (`isolation-after.json`); the only intentional change is teacher/reception/accountant may READ custom fields (SCF-08-02 read-only card) |
| 14 | Mobile + Arabic | no overflow, RTL | full sweep results in `visual-results-after.json`: 41 routes × 3 variants, 0 overflow, `dir=rtl` on `/ar`, 0 API 5xx, 18 intentional redirects (incl. `/settings/policies` → grading) |

### Sweep caveat (dev overlay)

The Next dev error overlay appears on every dashboard page because
`Navigation.parentGrades` is missing from the locales — 366 console errors in
this sweep (one per dashboard render). That key belongs to GRADES-CANONICAL-01
and is the same 27-key residue reported by `check-missing-i18n-keys`; it is not
a settings regression. Before the fix the overlay showed only on `/dashboard/settings`
because `Settings.mod_documents_title/desc` were missing; those keys now exist,
and the SCF-08-02/09-01 key batch was applied on 2026-09-26 10:55 (the locale
claim had become stale), so a re-shot `/settings` reports
`distinct MISSING_MESSAGE keys: Navigation.parentGrades` only, and the student
card title renders as « Champs personnalisés » in FR (`scf08-02-*`).

## What is left for the owner

1. **Atlas multi-branch (OD2)**: grant `multi-branch` + `max_branches` 2 via super-admin 2FA (dev and VPS).
2. **VPS**: open 2026-2027 for Atlas with the new button; delete the `test` addon definition; deploy with `-WithMigrate` (0166–0168).
3. **Attendance scanner for reception/guard**: the atomic `attendance.scan` change (capability + nav entry + scanner page guard + QR-route role/capability allowlist) belongs to the IMPL-ATTENDANCE-REFORM-01 worktree; nothing of it is left half-applied in this tree (see below).
4. **Enhance phase (deferred, per PLAN.md)**: providers merged into Broadcast; terms per school year; remaining ~24 `isDefault` queries; historical-year browsing; custom fields for guardians/employees; translation overrides wired or page removed; evaluation-weight averaging.

## Note: the `attendance.scan` detour was reverted

While SCF-04-01 was being logged, claude-att-2 asked for one extra atomic change
in this tree: a new `attendance.scan` capability, the scanner nav entry switched
to it, and the scanner page guard switched to it (their half — the QR-route
allowlist — lives in `enhancement/agent-b/IMPL-ATTENDANCE-REFORM-01-mainline`).
That half was applied, then **fully reverted on 2026-09-26** once it was clear
the IMPL side had not landed and that a guard-only flip would let reception/guard
open a page whose APIs still answer 403: `permissions.ts`, `permissions.test.ts`,
the sidebar scanner entry and the scanner page guard are back to
`attendance.manage`, so nav, page guard and APIs agree again
(`permissions + nav-page-guard-parity + guard-nav-role-visibility -> 22 passed`
after the revert). The IMPL branch carries its own copy of the capability and
should land the complete change together.

## Locale keys landed (2026-09-26 10:55)

`StudentDetail.customFields*` (11) + `Settings.mod_attendance_title/desc` (2)
were inserted in fr/en/ar with `apply-locales-scf3-*.mjs` once the holding claim
went stale; the guard now tolerates a trailing newline added by an editor while
still refusing any reformatting. `node scripts/check-missing-i18n-keys.mjs`
returns exactly the 27 pre-existing `Parent.grades*` + `Navigation.parentGrades`
keys owned by GRADES-CANONICAL-01.

## Known limits of this run

- `check-missing-i18n-keys` exits 1 because of the 27 pre-existing parent-grades keys (GRADES-CANONICAL-01), not this feature.
- `tsc` exits 2 because of 5 pre-existing errors in `scripts/check-branch-parity.ts` (BRANCH-SCOPE-02).
- The custom-fields card's read endpoint refuses nobody with `students.read` (by plan); write stays `school_admin` + `settings.custom_field.manage`.
