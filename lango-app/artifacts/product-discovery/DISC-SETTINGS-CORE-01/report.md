# DISC-SETTINGS-CORE-01 — School configuration: product + runtime audit

Discovery only. No application code changed. Audited commit `54d386a4` from a clean worktree on http://localhost:3111 (dev DB `schoolos`), with read-only checks on the live VPS. Evidence: `evidence/` (scripts + raw JSON), `screenshots/` (134 PNG). Date: 2026-09-25.

## Bottom line

The settings area **looks** complete, but about half of what a director can edit there changes nothing elsewhere in the app. Tenant isolation and role checks are solid (no leak found). The real problems are **duplicate sources of truth** (school year stored twice, two numbering systems, two "current year" rules), **settings that are saved but not consumed** (grading weights, numbering series, custom fields, translations, presence modes), one **real bug** (new students get the wrong matricule format), and a missing Attendance settings page.

## P0 / P1 / P2

**P0: none.** No tenant leak, no wrong money, no permission bypass found in the settings surface.

**P1**
1. **Two "current school years" at once.** 26 files use `session_years.is_default` (2025-2026), the dashboard uses today's date (2026-2027). No rollover exists. (academic-year-analysis.md)
2. **School year stored twice.** The Organisation page's year (30/06/2026) is read only by the hub badge; everything real reads `session_years` (31/08/2026). (duplicate-source-of-truth.md D1)
3. **Matricule format bug.** `libs/services/matricule.ts:29` regex lost its backslashes; new students get `STD-2026-…` instead of continuing `ATL-2526-…`. It was never working, and no test covers it (S-24's voided verification missed it). (matricule-analysis.md)
4. **Numbering settings page drives nothing.** A second numbering system (`numbering_series_definitions`) with 0 consumers; invoices, receipts and matricules use `naming_series`. (numbering-analysis.md)
5. **Attendance settings page is a placeholder**; the real attendance rules live in 5 registry keys, 2 of them editable only in the raw Values editor. (attendance-settings-analysis.md)
6. **Seeded JSON in the wrong shape**: languages `["fr","ar"]` and presence modes shown as "0 / 1" toggles, and rejected (422) by the Organisation API until a UI save rewrites them. Still wrong on the VPS. (scalability R11)
7. **Branches unreachable while Atlas runs 2 campuses**: `max_branches` 1, no `multi-branch` add-on, 2 active branches. (branches-analysis.md)

**P2**
8. Grading evaluation weights saved, never used in averages; the cycle/level selectors don't scope anything. (grading-analysis.md)
9. Custom fields: real storage and API, rendered nowhere; a custom key `matricule` shadows the core field. (custom-fields-analysis.md)
10. Translations page edits never reach the app. (duplicate D10)
11. Hub: missing keys `Settings.mod_documents_title/desc` in fr/en/ar (error overlay in dev, raw key in prod); "Configuré" badges are row-existence heuristics; "Conformité 100%" is shallow.
12. Pass mark editable on two pages (one store).
13. Academic years and semesters: audit rows have no before/after; legal identity (ICE, RC, IF, MEN, stamp, signature) has no history. (auditability-analysis.md)
14. Disabled super-admin module "test" visible to schools as "À venir" (VPS only). (module-entitlements.md)
15. Providers page duplicates Broadcast connections and stores no credentials; two jobs pages.
16. DB-level gaps: single default year and non-overlapping years are app-enforced only; `setting_values` unique index doesn't cover tenant-wide rows; `school_settings` last-write-wins; candidate numbers restart per allocation run; semesters not per year.
17. Hard-coded "École Atlas" in SMS reminder previews and "Atlas International" in super-admin SMS logs.

## Settings hub truth

The hub computes each card's badge in `settings-hub-page.tsx` from row existence:

| Card | "Configuré" when | Problem |
|---|---|---|
| Organisation | `school_settings.establishment_name` non-empty | ignores whether the year/legal fields are right |
| Users | any staff user exists | always true after creation |
| Security | any of `security.policies`, `security.sessionTimeoutMinutes`, `security.dismissedAlerts` exists | **none of these keys is read by the app**; the one real setting (`security.requireTwoFactorForAdmins`) does not count |
| Providers | `integrations.providers` exists | a catalogue with no credentials |
| PCG | chart of accounts or `accounting.defaults` exists | `accounting.defaults` has 0 runtime readers |
| Translations, Jobs | key exists | keys with 0 runtime readers |
| Policies | any of 9 academic/attendance keys exists | one key is enough (the audit's own probe flipped it) |
| Branches | >1 branch **and** `multi-branch` add-on | Atlas shows "À configurer" while running 2 campuses |
| Documents | — | card title/description untranslated |

"6 / 18 · 12 à configurer" (VPS) is the sum of these heuristics, not real completeness. 18 cards cover 18 of 41 routes; 5 routes are unreachable from the sidebar (`onboarding` via hub only, `attendance`, `audit-logs`, `security/2fa`, `staff`). Duplicate cards: Jobs vs Scheduled tasks; Translations includes a second custom-fields block. Dead/gated: Branches (add-on). Coming soon: Attendance (no card).

Recommended future IA (not implemented): group by the school's setup journey (1. Identity & legal, 2. School year & terms, 3. Campuses, 4. Attendance rules, 5. Grading rules, 6. Numbering & IDs, 7. Users & security, 8. Modules & subscription, 9. Integrations, 10. Data & compliance), each card computing a real completeness checklist from its canonical store, with one link per concept.

## Per-page review

Format: purpose · implementation · verdict · works · wrong · duplicated · not consumed · data source · consumers · permissions · tenant/branch · audit · scale · decision · manual test. URLs are on http://localhost:3111/fr/dashboard/…

**Settings hub** `/settings` · entry point to 18 cards · server page with row-existence badges and last 5 audit rows · PARTIAL · links work, audit feed real · untranslated card, heuristic badges, shallow 100% · jobs ×2 · — · several tables · — · `settings.organization.manage` · tenant-scoped queries · reads audit · fine · **REDESIGN** (real completeness) · open hub → "Modèles PDF" card shows a raw key.

**Organisation & Identité** `/settings/onboarding` · identity, legal, MEN, contacts, year, locale, document style, presence · `school_settings` + registry dual-write · PARTIAL · identity/legal/stamp consumed by documents and certificates; save works in the UI · year block not consumed; seed JSON shapes; hidden late-grace/period fields sent · year duplicates `session_years` · year, languages, presence modes · `school_settings` · documents, certificates, finance loaders, QR (timezone) · admin + `settings.organization.manage` · tenant-isolated (probe) · no history for legal fields · last-write-wins · **KEEP identity, MOVE year out (read-only link), MOVE presence to Attendance** · compare year with Academic Years.

**Subscription & Modules** `/settings/entitlements`, `/settings/subscription` · plan, modules, requests · `addon_entitlements/definitions`, `tenants.max_branches` · REAL · entitlements enforce guards · shows disabled "test" (VPS); 2/1 campuses · — · — · addons tables · guards, sidebar, APIs · `settings.read` · isolated · entitlement changes logged (who/when) · — · **KEEP**, hide disabled definitions · VPS → last card "test".

**Branches** `/settings/branches` · manage campuses · `branches` · REAL but gated · CRUD guarded by `max_branches`; cross-tenant 404 · unreachable for Atlas; no closure impact check · limit vs add-on · per-branch settings unused · `branches` · header selector, data (partial, see BRANCH-SCOPE-01) · admin + organisation.manage; list readable by staff (intended) · isolated · — · — · **KEEP + fix gating rule** · open → redirect.

**Academic Years** `/academics/calendar` · years and default · `session_years` · REAL · round trip proven (T3) · no rollover; no constraints; no before/after audit · Organisation copy · — · `session_years` · 58 files · `academics.manage` · isolated · audit without values · two resolvers · **KEEP as the single source + add lifecycle** · check 2025-2026 active on 25/09/2026.

**Semesters** `/academics/semesters` · term month windows · `semesters` · REAL (limited) · round trip proven (T4) · not per year; no audit values · — · — · `semesters` · month windows · `academics.manage`; read by teacher/accountant · isolated · none · not per year · **REDESIGN (terms per year)** · rename and reload.

**Academic Policies** `/settings/policies` · pass mark, scale, SMS alert · registry · REAL · all 3 consumed; "no changes" guard works · pass mark also on Grading page · pass mark · — · `setting_values` · report cards, promotions, attendance SMS · organisation.manage · isolated · versioned · — · **MERGE** pass mark into Grading; keep SMS for Attendance page · change pass mark, see Grading page.

**Attendance settings** `/settings/attendance` · — · placeholder · MOCK · — · coming soon · — · — · (registry keys elsewhere) · — · `settings.attendance.manage` · — · — · — · **BUILD** on the 5 registry keys · open page.

**Grading policies** `/academics/grading/policies` · pass/eliminatory/scale/weights/coefficients · registry + stream coefficients · PARTIAL · decision thresholds consumed · weights unused; cycle selectors cosmetic · pass mark (policies) · evaluation weights · registry · report cards · `grading.manage` · isolated · versioned + reason · — · **REDESIGN** weights or hide · change weights, no change in results.

**Matricules** `/students/matricules` · student IDs and Massar · `user.matricule`, `naming_series` · REAL · sequence locking safe · format continuation broken; third generator in admission-service; 201 "incomplets" alarm on demo data · Numbering page, custom field `matricule` · — · `user`, `naming_series` · admissions, cards, documents · `students.update` · isolated · — · safe sequence · **KEEP + fix regex, one generator** · compare "test 111" with others.

**Numbering series** `/settings/numbering` · configure document numbers · `numbering_series_definitions` · PARTIAL · storage, versions, isolation proven (T5) · 0 consumers; "Attribuer" consumes useless numbers · `naming_series` · all of it · own tables · none · `settings.numbering.manage` · isolated · versioned · locked · **REDESIGN** onto `naming_series` or REMOVE · compare with last invoice number.

**Custom fields** `/settings/custom-fields` · extra attributes · 3 tables · PARTIAL · storage, versions, isolation proven (T6) · rendered nowhere; core-key collision; no reason field · translations presets · everything · own tables · none · `settings.custom_field.manage` · isolated · versioned · no value validation at DB · **KEEP + integrate into entity forms**, reserve core keys · look for "Sport pratiqué" on a student.

**Users / Roles / Permissions / Staff** `/settings/users`, `/permissions`, `/staff` · staff accounts, RBAC · `user`, permissions tables · REAL · role and tenant refusal proven · not deep-audited here (AUD-SETTINGS-01 covered it) · — · — · — · auth everywhere · `users.manage`, `users.permissions.manage` · isolated · permission_change logged · — · **KEEP** · —.

**Security / 2FA / Sessions** `/settings/security`, `/security/2fa` · 2FA policy, sessions · registry + auth · REAL · `requireTwoFactorForAdmins` enforced at login · hub badge ignores it · — · `security.policies`, `sessionTimeoutMinutes` (0 readers) · registry · login · `settings.security.manage` · isolated · versioned · — · **KEEP** · toggle 2FA, check login.

**Login audit** `/settings/security/login-events` · REAL · **KEEP**.

**Connections / Providers** `/settings/providers` · PARTIAL (catalogue, no credentials; Broadcast connections are the real store) · **MERGE** with Broadcast connections.

**Finance / PCG** `/settings/accounting-defaults` · PARTIAL (`accounting.defaults` 0 runtime readers; counts toward "100% conformité") · **verify with finance owner** before redesign.

**Translations** `/settings/translations` · MOCK in effect (static dictionary; overrides unused) · **REMOVE or wire into next-intl**.

**Approval workflow** `/settings/drafts` · REAL (drafts applied through the registry) · **KEEP**.

**Documents** `/settings/documents` · REAL (designs, publish, previews) · untranslated hub card · **KEEP**, add keys.

**Scheduled tasks** `/settings/scheduled-jobs` · REAL (in-process worker) · single-container assumption · **KEEP**; **Jobs** `/settings/jobs` · PARTIAL duplicate · **MERGE**.

**Migration center** `/settings/migration` · REAL · **KEEP**.

**Scanner devices** `/settings/scanner-devices` · MOCK in effect (devices never authenticate; DISC-ATTENDANCE-01) · **REDESIGN or REMOVE** per attendance reform.

**CNDP / data compliance** `/settings/cndp` · REAL (reference + date required for "approved") · **KEEP**.

**Values (raw editor)** `/settings/values` · REAL, expert tool; the only UI for attendance thresholds · **KEEP for support staff, hide from directors** once Attendance settings exists.

## Recommended page order (for the fix phase)

1. Academic year (single source + active-year lifecycle + terms per year): everything depends on it.
2. Matricules (regex + single generator): small, visible, affects every new student.
3. Organisation (remove the year block, fix seed JSON shapes, legal-field history).
4. Attendance settings page (on the existing registry keys; aligned with the attendance reform).
5. Grading (weights: apply or hide; single pass-mark editor).
6. Numbering (one sequence engine) and Matricule format as a setting.
7. Branches gating + Atlas entitlement decision.
8. Custom fields into forms.
9. Hub (real completeness, translations, merged duplicates), Providers/Jobs/Translations cleanup.

## Final verdict

```
DISC-SETTINGS-CORE-01 — COMPLETE

pages audited: 41 (37 settings routes + academic years, semesters, grading policies, matricules)
browser routes tested: 41 × 3 variants = 123 captures (+ 11 interaction/save states)
APIs traced: 104 distinct API paths referenced by these pages; 18 read APIs × 5 users and 15 write probes executed
DB domains traced: 14 (session_years, semesters, school_settings, setting_values + versions, naming_series, numbering_series_definitions + versions, custom_field_definitions + versions + values, branches, tenants, addon_definitions, addon_entitlements, audit_logs)

REAL: 16 · PARTIAL: 8 · MOCK/COMING SOON: 3 (attendance settings, translations, scanner devices) · not deep-audited: 7 (captured only)

duplicate sources of truth: 11 (D1–D11 in duplicate-source-of-truth.md)
P0: 0
P1: 7
P2: 10

recommended page order: academic year → matricules → organisation → attendance settings → grading → numbering → branches → custom fields → hub

READY FOR HUMAN PRODUCT REVIEW: YES
IMPLEMENTATION STARTED: NO
```

Local server for review: **http://localhost:3111/fr/login** (director `y.elamrani@atlas.ma` / `Admin123!`). Step-by-step checks: manual-review-guide.md.
