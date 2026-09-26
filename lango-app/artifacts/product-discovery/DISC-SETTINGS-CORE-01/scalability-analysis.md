# Scalability and reusability analysis

Architectural risk only; nothing redesigned. Load tests (1,000+ students, concurrent saves) were **not executed**: findings below come from schema, index and code inspection plus the 201-student Atlas data.

| # | Risk | Evidence | Severity |
|---|---|---|---|
| R1 | Tenant-wide settings rows are not protected by the database | unique index `setting_values(tenant_id, branch_id, key)` is not `NULLS NOT DISTINCT`, so rows with `branch_id NULL` can duplicate. The app prevents it with a transaction advisory lock (0 duplicates found). Any writer bypassing `setSettingValue` could create duplicates. | P2 |
| R2 | One default year per tenant is app-enforced only | no partial unique index on `session_years(tenant_id) WHERE is_default`; no exclusion constraint on overlapping date ranges (0 violations today) | P2 |
| R3 | Semesters are not per year | `semesters` has no session-year column; the same month windows apply to every year and every cycle | P1 (product) |
| R4 | Organisation saves are last-write-wins | `school_settings` has no version column; two admins saving the Organisation page concurrently overwrite each other silently. Registry values (versioned, optimistic) are safe. | P2 |
| R5 | Dual-write can drift | `/api/settings` writes `school_settings` then dual-writes registry keys with `Promise.allSettled` (fire-and-forget); failures are logged, not surfaced | P2 |
| R6 | In-process schedulers | `settings-worker.ts` and `license-expiry-worker.ts` are singleton `setInterval` pollers started from `instrumentation.ts`. Running two app containers would run every job twice. | P2 (fine for today's single container) |
| R7 | Number sequences are safe under concurrency | `naming_series` uses advisory xact lock + row lock; invoice numbers inside the invoice transaction. Numbering-page series also locked. | OK |
| R8 | Candidate numbers restart per run | `CAND-{year}-{index}` built from the allocation index (`exam-master-service.ts:126`), not a sequence: two allocation runs in a year can produce the same candidate number | P2 |
| R9 | Hard-coded tenant strings in runtime code | `sms-reminders-view.tsx:344` replaces `{ecole}` with `'École Atlas'` in previews for every tenant; `super-admin-sms-view.tsx:308` falls back to `'Atlas International'`; `src/lib/db.ts:78` legacy seed with "Groupe Scolaire Atlas" | P2 |
| R10 | Morocco-specific values that should be config | `'Africa/Casablanca'` default in 3 places; `'MAD'` default currency; hub copy "PCG 2026", "TVA (20%)", "Casablanca, Rabat, Marrakech"; `INV-{year}-` / `RC-{year}-` prefixes fixed in code | P3 (acceptable for a Morocco-first product; list for i18n of the business model) |
| R11 | JSON settings without schema at the DB | `school_settings.languages/presence_modes/security` are JSON columns; the seed stored the wrong shapes (`["fr","ar"]`, `["morning","afternoon"]`), which the UI rendered as "0 / 1" toggles and which the Organisation API rejects on save (422) until the UI save rewrites them | P1 (visible bug) |
| R12 | Duplicate resolver code | two `getDefaultSessionYearId`; 26 ad-hoc `isDefault` queries | P2 |
| R13 | Branch closure has no impact check | soft deactivate only; no check for students, classes, staff pins, assets on that branch | P2 |
| R14 | Historical year access | modules default to `is_default`; viewing a previous year depends on each page offering a year selector (not consistent) | P2 |
| R15 | Module downgrade | plan limits exist; downgrade behaviour for data in a removed add-on was not exercised (would mutate a tenant) | not tested |

Indexes present: unique `(tenant_id, key)` on custom field and numbering definitions; unique `(tenant_id, definition_id, entity_id)` on custom field values; unique `(tenant_id, name)` on session years and semesters; unique `(tenant_id, code)` on branches. Settings queries are single-tenant point lookups; no unbounded scans were found in the settings APIs. The matricules page paginates (10 per page, 21 pages for 201 students).
