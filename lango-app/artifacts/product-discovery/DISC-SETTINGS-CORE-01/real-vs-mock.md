# Real vs partial vs mock

REAL = stored, persisted and consumed by the rest of the app. PARTIAL = stored and persisted, but not consumed (or only partly). MOCK / COMING SOON = placeholder or static data.

| Page | Verdict | Why (proof) |
|---|---|---|
| Settings hub `/settings` | PARTIAL | Cards real links; "Configuré" badges are row-existence heuristics (see report); "Conformité 100%" = chart of accounts exists + CNDP filing done; recent changes real but not settings-only; card "Settings.mod_documents_title/desc" untranslated (missing in fr/en/ar) |
| Organisation & Identité `/settings/onboarding` | PARTIAL | Identity, legal, MEN, stamp/signature, contacts: REAL (read by documents, certificates, finance loaders). School year block: duplicate, not consumed. Timezone: consumed (QR). Languages and presence modes: stored, not consumed; seed shape bug ("0 / 1") |
| Subscription & modules `/settings/entitlements`, `/settings/subscription` | REAL | Entitlements drive guards and sidebar; shows a disabled "test" module on VPS; "Campus inclus 2/1" is real data |
| Branches `/settings/branches` | REAL but unreachable for Atlas | Redirects: Atlas lacks `multi-branch` |
| Academic Years `/academics/calendar` | REAL | `session_years`, read by 58 files; round trip T3 proven; no rollover lifecycle |
| Semesters `/academics/semesters` | REAL (limited) | round trip T4 proven; not linked to years |
| Academic policies `/settings/policies` | REAL | pass mark and scale consumed by report cards and promotions; SMS alert consumed by attendance marking |
| Attendance settings `/settings/attendance` | MOCK / COMING SOON | "Fonctionnalité à venir" |
| Grading policies `/academics/grading/policies` | PARTIAL | pass/eliminatory/scale consumed; evaluation weights stored, not consumed; cycle/level selectors do not scope anything |
| Matricules `/students/matricules` | REAL | generator real, but format continuation broken (regex) |
| Numbering `/settings/numbering` | PARTIAL | versioned storage, 0 consumers |
| Custom fields `/settings/custom-fields` | PARTIAL | storage + API + versions, 0 consumers |
| Users `/settings/users`, Permissions `/settings/permissions`, Staff `/settings/staff` | REAL | tenant isolation and role refusal proven on `/api/users`, `/api/settings/permissions` |
| Security `/settings/security` (+ `/2fa`) | REAL | `security.requireTwoFactorForAdmins` read by `libs/auth/two-factor-policy.ts`; session list real |
| Login audit `/settings/security/login-events` | REAL | reads login events |
| Providers `/settings/providers` | PARTIAL | catalogue without credentials by design; real sending uses Broadcast connections |
| Accounting / PCG `/settings/accounting-defaults` | PARTIAL | `accounting.defaults` has 0 runtime readers outside settings (hub counts it as "configured") |
| Translations `/settings/translations` | MOCK (functionally) | static dictionary seed; saved overrides never reach next-intl |
| Approval workflow `/settings/drafts` | REAL | drafts service applies approved drafts through `setSettingValue` |
| Documents `/settings/documents` | REAL | document designs + publish + previews (document system, migration 0160) |
| Scheduled tasks `/settings/scheduled-jobs` | REAL | in-process worker runs due jobs |
| Jobs `/settings/jobs` | PARTIAL | second jobs page on `jobs.definitions` |
| Migration center `/settings/migration` | REAL | file import tasks + template |
| Scanner devices `/settings/scanner-devices` | MOCK in effect | devices listed but never authenticate (DISC-ATTENDANCE-01 finding, unchanged) |
| CNDP `/settings/cndp` | REAL | filing with reference + date validation |
| Values (raw) `/settings/values` | REAL | generic registry editor, the only UI for attendance thresholds |
| Website `/settings/website/*` | REAL, gated | redirects: Atlas lacks `school-website-cms` |
| Notifications, domain, exports, payment methods, live classrooms, access reset, audit logs | not deep-audited | captured visually (all clean); listed in page-inventory.md |
