# Lango/SchoolOS — Implementation Plans: Audit & Progress Tracker

> **Generated:** 2026-08-09 from a full codebase audit (36 plans verified against live code in `lango-app`).
> **How to use:** This is your single working document. Tick the `- [ ]` box next to each gap as you fix it. When a plan's overall state changes, update the **Status (edit me)** cell in the Summary Table. Keep the plan-folder docs for detail; keep this file as the source of truth for *what's built vs what isn't*.

## Status Legend

- `🔴 NOT STARTED` — no code exists for the plan's scope (only the plan doc).
- `🟡 IN PROGRESS` — real code exists but open items remain (self-reported or code-signalled).
- `🟠 PARTIAL` — significant portion built, but key plan deliverables missing/mock/deferred.
- `✅ IMPLEMENTED` — core plan scope present, real routes/APIs/tables, verified.
- `🚧 BLOCKED` — has an external blocker (legal certification, provider, build error).

## Summary Table

| # | Plan | Verdict | Status (edit me) | Priority |
|---|------|---------|------------------|----------|
| 1 | settings-platform | ✅ IMPLEMENTED | ✅ | High |
| 2 | role-portals-foundation | ✅ IMPLEMENTED | ✅ | Done |
| 3 | two-factor-authentication | ✅ IMPLEMENTED | ✅ | High |
| 4 | subscription-licensing | ✅ IMPLEMENTED | ✅ | High |
| 5 | custom-domain | ✅ IMPLEMENTED | ✅ | Done |
| 6 | admission-and-student-model | ✅ IMPLEMENTED | ✅ | Done |
| 7 | academic-management-enhancement | ✅ IMPLEMENTED | ✅ | Done |
| 8 | dropped-features-rebuild | ✅ IMPLEMENTED | ✅ | Done |
| 9 | attendance-qr-enhancement | ✅ IMPLEMENTED | ✅ | Done |
| 10 | assessment-and-examination | 🟠 PARTIAL | ✅ | Medium |
| 11 | attachments-book | ✅ IMPLEMENTED | ✅ | Done |
| 12 | student-accounting | ✅ IMPLEMENTED | ✅ | High |
| 13 | office-accounting | ✅ IMPLEMENTED | ✅ | Done |
| 14 | accountant-portal | ✅ IMPLEMENTED | ✅ | High |
| 15 | human-resources-employee-management | ✅ IMPLEMENTED | 🟡 | Medium |
| 16 | payroll-and-workforce-operations | 🟠 PARTIAL | 🟡 | Medium |
| 17 | employee-self-service-portal | ✅ IMPLEMENTED | ✅ | Done |
| 18 | school-leadership-portal | ✅ IMPLEMENTED | ✅ | Medium |
| 19 | teacher-portal | ✅ IMPLEMENTED | ✅ | High |
| 20 | student-portal | ✅ IMPLEMENTED | ✅ | High |
| 21 | parent-guardian-portal | ✅ IMPLEMENTED | ✅ | Done |
| 22 | receptionist-portal | ✅ IMPLEMENTED | ✅ | Done |
| 23 | library-management | ✅ IMPLEMENTED | 🟡 | Medium |
| 24 | librarian-portal | ✅ IMPLEMENTED | 🟡 | Medium |
| 25 | inventory-management | ✅ IMPLEMENTED | 🟡 | Low |
| 26 | event-management | ✅ IMPLEMENTED | ✅ | Done |
| 27 | student-transport | ✅ IMPLEMENTED | ✅ | Done |
| 28 | hostel-management | ✅ IMPLEMENTED | ✅ | Done |
| 29 | guard-security-portal | ✅ IMPLEMENTED | ✅ | Done |
| 30 | lead-crm-and-broadcast-messaging | ✅ IMPLEMENTED | ✅ | Done |
| 31 | live-classrooms | 🟡 IN PROGRESS | 🟡 | Medium |
| 32 | school-website-cms | 🔴 NOT STARTED | 🔴 | Low |
| 33 | card-and-admit-card-management | ✅ IMPLEMENTED | ✅ | Done |
| 34 | certificate-management | ✅ IMPLEMENTED | ✅ | Done |
| 35 | advanced-reporting | ✅ IMPLEMENTED | ✅ | Done |
| 36 | alumni-portal | ✅ IMPLEMENTED | ✅ | Done |

**Totals:** 32 IMPLEMENTED · 2 PARTIAL · 1 IN PROGRESS · 1 NOT STARTED

---

## Cross-Cutting Issues (fix these across plans)

- [x] **Security: unguarded mock pages** — RESOLVED 2026-08-10 (T1/T2): `/dashboard/teacher` (`allowedRoles:['teacher']`) and `/dashboard/student` (`allowedRoles:['student']`) now guarded with `requireServerPage`. (See #19, #20.)
- [x] **Build blocker** — RESOLVED 2026-08-10 (T8): `src/features/workforce/services/payroll-runs.ts:562` type error fixed; `npx next build` exits 0.
- [x] **Migration collision** — RESOLVED 2026-08-09 (T0): journal-link migration renamed `0057a_add_journal_line_reconciliation_link.sql`.
- [ ] **Stale plan docs (10 plans):** self-report "not started/planned" while code is built — `custom-domain`, `inventory`, `hostel`, `guard`, `transport`, `library`, `alumni`, `advanced-reporting`, `dropped-features-rebuild`, `assessment`. Reverse drift: `assessment` EXECUTION-AUDIT/STATE docs corrected 2026-08-14 (was "100% deployed" → now "PARTIALLY DEPLOYED"); `advanced-reporting` EXECUTION-AUDIT still claims "100% deployed" — needs the same correction. Refresh doc status lines as you touch each plan.
- [ ] **Addon registry flags stale** (`src/addons/registry.ts`): `inventory`, `human-resources` still `enabled:false` / "Not built" despite shipped code; `lead-crm` + `broadcast-messaging` descriptions outdated. (`event-management` resolved 2026-08-11 — `enabled:true` verified warranted, see §26.)
- [ ] **UI/API asymmetry:** library, events, librarian have rich backend APIs but thin page surfaces (reverse of the older mock-heavy pages).
- [x] **Remaining mock data** — RESOLVED 2026-08-09 (T3): `accountant-portal-view.tsx` + `reminders-statements-view.tsx` now fetch real `/api/accountant/me/home` + `/api/finance/reminders`; `finance/reconciliation` verified live (not dead). (See #14.)

---

## Per-Plan Detail

### 1. settings-platform — `future-implementation/settings-platform/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** ✅ DONE (2026-08-10) — all Phase-1 gaps implemented, live-verified
- **Scope:** Settings registry/schema, scope inheritance + effective-value resolver, versions/drafts/rollback, secret refs, provider connections, translations/custom fields/scheduled jobs/login-log pages.
- **Found in code:** `src/libs/settings/registry.ts` (SETTINGS_REGISTRY, effective values w/ source/version/sensitivity); `settingValues` + `settingValueVersions` tables (Schema.ts:3008,3033; migration `0032`); `/dashboard/settings/values` page; settings hub `src/features/settings/` (~20 sub-pages); APIs `src/app/api/settings/*`; keys `settings.read/organization/security/integrations/jobs/localization/attendance`.
- **Gaps / next actions:**
  - [x] Migration `0107` + `src/features/settings/models/settings-schema.ts`: `settingDefinitions`(+versions), `settingDrafts`/`settingApprovals`, `secretReferences`, `numberingSeriesDefinitions`(+versions), `customFieldDefinitions`(+versions)/`customFieldValues`, `scheduledJobDefinitions`/`Controls`/`Runs`, `loginEvents`.
  - [x] Phase A — DB-backed definitions: `syncSettingDefinitions` (startup-seeded from `instrumentation.ts`), `GET /api/settings/catalog`, `/search`, `/readiness`.
  - [x] Phase B — Drafts & approvals: `drafts-service.ts` state machine (maker/checker, SELF_APPROVAL guard, CAS apply), APIs under `/api/settings/drafts`, `/dashboard/settings/drafts` hub card + sidebar.
  - [x] Phase C — Encrypted secrets: `setSettingValue` stores AES-256-GCM blobs for `sensitivity:'secret'`; `secrets-service.ts` peek (decrypt/legacy-plaintext) + rotate (fresh IV, no version bump, `secretReferences` row); `POST /values/[key]/peek` + `/rotate`; values-page reveal/rotate UI; rollback blocked for secrets.
  - [x] Phase D — Numbering series + custom fields registries: `numbering-service.ts` (create/update/list/preview/consume with advisory-lock + FOR UPDATE serialization), `custom-fields-service.ts` (typed definitions + per-(definition,entityId) value store); APIs `/api/settings/numbering`(+`/[id]`, `/preview`, `/next`) and `/api/settings/custom-fields`(+`/[id]`, `/values`); pages `/dashboard/settings/numbering` + `/custom-fields` (hub cards + sidebar entries); vitest 10 (incl. concurrent-consume-never-duplicates). **Boundary:** wiring registries into student/guardian/invoice forms = future work.
  - [x] Phase E — Scheduled jobs + allowlisted worker: `scheduled-jobs-service.ts` (DB-backed definitions, handler allowlist purge_sessions+noop enforced at route+service, run/toggle/delete with `scheduledJobControls` + `scheduledJobRuns`), `settings-worker.ts` (60s poll wired in `instrumentation.ts`, fires due jobs autonomously), APIs `/api/settings/scheduled-jobs`(+`/[id]`, `/toggle`, `/trigger`, `/runs`), page `/dashboard/settings/scheduled-jobs` (hub card + sidebar), vitest 5. Verified live: worker autonomously fired a due job (triggeredBy=worker).
  - [x] Phase F — Login events capture: `login-events-service.ts` (`recordLoginEvent` fire-and-forget + `captureSignInLoginEvent` from the Better Auth `after` hook; failure attributed to the account's tenant via email lookup); `GET /api/settings/security/login-events` (school_admin + `settings.security.manage`, tenant-scoped pagination + success/email filters + unfiltered summary); page `/dashboard/settings/security/login-events` (KPI cards, table, status filter, pagination) + sidebar entry + security-page link. `login_events` table live (migration `0107`). Verified: `scripts/verify-login-events.mjs` → 26 passed / 0 failed; `scripts/browser-login-events.mjs` → 8 passed / 0 failed; settings vitest 64/64; tsc 0.
  - [x] Keys added: `settings.approve`, `settings.secret.rotate`, `settings.rollback`, `settings.custom_field.manage`, `settings.numbering.manage`, `settings.jobs.operate`, `settings.translation.manage`, `settings.finance_mapping.manage`.
  - [x] Split `schoolSettings` JSON blobs into typed settings — new keys `localization.timezone` (legacyField `localeTimezone`) + `security.loginAccessMethod` (legacyField `loginAccessMethod`, default `invite_link`); `LEGACY_SETTING_COLUMNS` map + `getEffectiveValueWithLegacyFallback` helper (falls back to the legacy `schoolSettings` column only when `getEffectiveValue` resolves to default). Migrated readers: `alumni-transition.ts`, `students/[id]/regenerate-access`, `students/admissions`, attendance QR `verify-and-stage` (timezone/grace/periodStart). Org page (`organization-page.tsx`) + GET `/api/settings` now read via registry-with-legacy-fallback (`attendance.presenceModes`, `localization.languages`, `security.policies`, `localization.timezone`) so the blob is no longer the read source of truth; POST keeps dual-write (safe). Hub card + sidebar for login-events. Vitest `login-events.test.ts` (3). **Note:** `npx next build` still fails on a pre-existing unrelated error in `src/features/subscriptions/ui/subscription-overview-view.tsx:180` (`licStatus` possibly-undefined under the Next/Turbopack checker) — file unmodified in working tree, fresh full `tsc --noEmit` (incremental off) exits 0; treated per plan gate #6 fallback (note it, rely on tsc + vitest + live curl).
- **Key files:** `src/libs/settings/registry.ts` (+ `LEGACY_SETTING_COLUMNS` + `getEffectiveValueWithLegacyFallback`), `src/app/api/settings/values/route.ts`, `src/features/settings/data/settings-hub-config.ts`, `src/features/settings/services/{definitions,drafts,secrets,numbering,custom-fields,scheduled-jobs,login-events}-service.ts` + `settings-worker.ts`; `src/app/api/settings/security/login-events/route.ts`; `src/features/settings/ui/login-events-view.tsx`; `src/features/settings/__tests__/login-events.test.ts`.
- **Note:** `scripts/check-tenant-isolation.ts` flags 5 delegate-style self-service routes (`guard/me/*`, `guard/kiosk-sessions/*`, `leadership/me/home`) that lack the literal `tenantId` string but scope via tenant-scoped services (`getMyGate`, `getAnalytics`+`requireLeadershipScope`) — heuristic false positives, not T6 regressions.

### 2. role-portals-foundation — `future-implementation/role-portals-foundation/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** ✅ DONE
- **Scope:** Active-role context, `/api/portal/*` routes, server-owned addon-aware manifest, shared shell, deny-by-default scope primitives, migrations 0083/0086.
- **Found in code:** `src/app/api/portal/{me,manifest,home,search,activity,preferences,role}`; `src/features/portal/`; `src/libs/api/{portal-scope,portal-manifest}.ts`; `src/components/shared/{portal-role-switcher,portal-state}.tsx`; migrations `0083`, `0086`; tests `portal-security.test.ts`, `role-portals.test.ts`.
- **Gaps / next actions:**
  - [ ] Browser/UI checks (manual) — pending.
  - [ ] Non-`parent` derived roles (only `parent` implemented).
- **Key files:** `src/libs/api/portal-manifest.ts`, `src/features/portal/services/active-context.ts`.

### 3. two-factor-authentication — `future-implementation/two-factor-authentication/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** ✅ DONE (2026-08-09)
- **Scope:** Better Auth `two-factor` plugin, QR/backup-code setup, login challenge, admin mandatory policy, email-OTP.
- **Found in code:** `twoFactor()` in `src/libs/auth.ts` + client; `/dashboard/settings/security/2fa` page (enable→QR→verify→backup→disable); login challenge in `login-client.tsx` (`twoFactorRedirect`, `verifyTotp`, trust-device); `user.twoFactorEnabled` + `twoFactor` table.
- **Gaps / next actions:**
  - [x] Admin enforcement policy: `super_admin` ALWAYS mandatory enroll gate (`src/components/auth/two-factor-required.tsx` + layout check); per-tenant toggle `security.requireTwoFactorForAdmins` (scope tenant, default false) on settings/security.
  - [x] Email-OTP fallback (`send-otp` / `verify-otp`) — migration `0109_two_factor_otp.sql` (`two_factor_otps` delivery log); `scripts/apply-0109.mjs`.
  - [x] Replace placeholder QR icon with real `qrcode.react` render (enroll screen + settings/2fa page).
  - [x] 2FA-challenge rate limiting — Better Auth plugin rule (3 per 10s on `/two-factor/*`) enforced in prod (`isProduction` gate); verified at T8 prod build — `H1/H2` real pass (burst of 4 verify-totp → 429 observed, first rejected 401).
- **Verification (live):** `scripts/verify-two-factor.mjs` → **30 passed / 0 failed / 0 deferred on the prod build** (`VERIFY_BASE=http://localhost:3004`, T8; H1/H2 challenge rate-limit now real passes; sign-ins paced 11s apart to respect Better Auth's prod `/sign-in` rule of max 3 per 10s — the earlier 10 failures were the harness tripping that anti-brute-force limiter, not a regression). Dev-mode run historically 28/0/1 (rate limit deferred). `scripts/browser-two-factor.mjs` (playwright) → 27 passed / 0 failed; screenshots in `.implementation-plan/browser-evidence/`.
- **Key files:** `src/components/auth/two-factor-required.tsx`, `src/app/[locale]/(dashboard)/layout.tsx`, `src/features/settings/ui/security-sessions-client.tsx`, `src/app/[locale]/(dashboard)/dashboard/settings/security/2fa/page.tsx`, `src/libs/auth.ts`, `migrations/0109_two_factor_otp.sql`.

### 4. subscription-licensing — `future-implementation/subscription-licensing/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** ✅ DONE (2026-08-10)
- **Scope:** `schoolLicenses` + `licensePayments` tables, school-facing `/dashboard/settings/subscription`, super-admin license management + "Plans & Modules", addon activation toggles, payment history, renewal request/decision workflow. (The plan's `addonActivations` was **not** created — the existing `addonEntitlements` system is the single source of truth for addon grants.)
- **Found in code:** `tenants.planTier` enum/column; `addonEntitlements` table + `src/libs/api/entitlements.ts` (`hasAddon`/`requireAddon`); `src/addons/registry.ts` (super-admin catalog); `/dashboard/settings/entitlements` catalog (linked from the subscription page); `requirePlanTier` already existed in `src/libs/api/permissions.ts`; APIs `super-admin/entitlements`, `settings/addons/[id]`.
- **Built (migration `0110_subscription_licensing.sql`, manual apply via `scripts/apply-0110.mjs` — idempotent):**
  - [x] `school_licenses` (tenant-unique) + `license_payments` tables; renewal requests modeled as pending `license_payments` rows; `license_payments.plan_tier` is a historical snapshot.
  - [x] Service `src/features/subscriptions/services/subscription-service.ts`: `generateLicenseKey` (`SCHOOLOS-XXXX-XXXX-XXXX`), `getSubscriptionDetail`, `listSchoolsWithLicenses` (+ pending summary), `issueLicense`/`extendLicense`/`revokeLicense`, `requestRenewal`, `decidePayment` (approve → issue/extend + paid; reject → rejected; second decision → 409). Audited (`create`/`update`/`delete`) with the target tenant on the row.
  - [x] APIs: `GET /api/settings/subscription`, `POST /api/settings/subscription/renewal-request` (months 1–36, 422 otherwise), `GET /api/super-admin/subscriptions` (+ catalog), `GET /api/super-admin/subscriptions/[schoolId]`, `POST /api/super-admin/subscriptions/[schoolId]/license` (issue/extend/revoke), `POST /api/super-admin/subscriptions/[schoolId]/payments/[paymentId]/decision`.
  - [x] School page `/dashboard/settings/subscription` (`SubscriptionOverviewView`): status band (plan + license key + expiry), KPI cards, payment history DataTable, addons badges + "Gérer les modules" → entitlements, renewal dialog (3–36 mois + note).
  - [x] Super-admin "Plans & Modules" (`super-admin-subscriptions-view.tsx`): plan distribution + addon catalog (Construit/À venir).
  - [x] Super-admin "Gestion des Abonnements" (`super-admin-subscriptions-list-view.tsx`): search + status filter, pending-requests panel, per-school detail dialog (issue/extend/revoke with two-step confirm, addon Switch → `/api/super-admin/entitlements`, payment history + approve/reject with amount).
  - [x] Sidebar entry "Abonnement & Licence" (settings).
- **Verification (live):** `scripts/verify-subscriptions.mjs` → 45 passed / 0 failed (super-admin list, school_admin 403 on super-admin list, school detail, renewal 201 + months 0/40 → 422, two-tenant payment isolation, accountant 403, approve → license issued + paid + ~6mo expiry, re-approve 409, per-school detail, issue-with-expiresAt, extend grows expiry, revoke → cancelled, issue-no-months 422, cleanup); `scripts/browser-subscriptions.mjs` (playwright) → 14 passed / 0 failed (super-admin pages render past the mandatory-2FA gate via a real `two-factor/enable`+`verify-totp` pre-step; school page shows the pending badge, renewal dialog open + confirmation); screenshots in `.implementation-plan/browser-evidence/`; `npx tsc --noEmit` exit 0; tenant-isolation gate pass. **Note:** during this plan the isolation checker was extended with a `SELF_SCOPED` allowlist for the 5 delegate-style self-service routes (guard/me/*, guard/kiosk-sessions/*, leadership/me/home) — verified each service derives tenant via `requireTenantId(context)`, resolving the T6-noted heuristic false positives.
- **Key files:** `src/features/subscriptions/services/subscription-service.ts`, `src/app/api/{settings/subscription,super-admin/subscriptions}/**`, `src/features/subscriptions/ui/subscription-overview-view.tsx`, `src/features/super-admin/ui/super-admin-{subscriptions,subscriptions-list}-view.tsx`, `src/components/shared/sidebar.tsx`, `migrations/0110_subscription_licensing.sql`.

### 5. custom-domain — `future-implementation/custom-domain/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** ✅ DONE
- **Scope:** `tenantDomains` table, hostname-based tenant resolution in middleware, super-admin approval list, school-admin request form.
- **Found in code:** `src/features/platform/models/domains-schema.ts` + `services/domains-service.ts`; `/dashboard/settings/domain` + `/dashboard/super-admin/domains`; APIs `settings/domains`, `super-admin/domains`, `platform/edge-tenant-resolve`; migration `0068`; `src/middleware.ts` reads Host + injects `x-tenant-slug`.
- **Gaps / next actions:**
  - [ ] Plan-tier gate (`requirePlanTier`) — not verified against a helper (feature works without it).
- **Key files:** `src/middleware.ts`, `src/features/platform/models/domains-schema.ts`.

### 6. admission-and-student-model — `future-implementation/admission-and-student-model/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** ✅ DONE
- **Scope:** Real document upload in admission wizard; new student fields; guardian search-and-link; login generation at approval.
- **Found in code:** migration `0057_add_admission_model_enhancement.sql`; `applicant_documents`, `account_setup_tokens`, new applicant/user fields; `student-admission-view.tsx`; `api/students/admissions` (+`/documents`), `api/students/[id]/regenerate-access`.
- **Gaps / next actions:** none.
- **Key files:** `src/features/students/ui/student-admission-view.tsx`, `src/app/api/students/admissions/route.ts`.

### 7. academic-management-enhancement — `future-implementation/academic-management-enhancement/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** ✅ DONE
- **Scope:** Session-scoped class offerings, class-teacher roles/history, timetable versions/draft-publish, promotion ledger w/ capacity+rollback, readiness dashboard.
- **Found in code:** migrations `0046–0052`; `academicClassOfferings`, `timetableVersions`, `promotionBatches`, `promotionDecisions`, `academicRooms`; APIs `class-offerings`, `coverage`, `readiness`, `promotions/capacity-check`, `promotions/revert`, `timetable-versions/publish`; UI `session-copy`, `assignment-workspace`, `promotion-wizard`, `readiness`.
- **Gaps / next actions:** none material.
- **Key files:** `src/models/Schema.ts`, migrations `0046–0052`, `src/features/academics/ui/*`.

### 8. dropped-features-rebuild — `future-implementation/dropped-features-rebuild/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** ✅ DONE
- **Scope:** Households (computed), classes (cycle/cap/homeroom), schedule views, reusable question bank, admission interview/comments/checklist, transfer KPIs.
- **Found in code:** migration `0058_dropped_features_rebuild.sql`; `question_bank_items/options`, `admission_interviews`, `admission_comments`; classes/guardian/online-exam ALTERs; APIs `question-bank`(+copy-into-exam), `homeroom-teacher`, `admissions/[id]/{interview,comments,checklist}`, `parents/[id]/{payments,activity}`, `transfer-stats`.
- **Gaps / next actions:** none in scope (drag-drop schedule grid + interview SMS deferred per PRD).
- **Key files:** `src/features/academics/ui/question-bank-view.tsx`, `src/app/api/students/transfer-stats/route.ts`.

### 9. attendance-qr-enhancement — `future-implementation/attendance-qr-enhancement/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** ✅ DONE
- **Scope:** Hardened QR scanner, badge lifecycle, scanner devices/sessions, immutable scan events, QR audit reports.
- **Found in code:** `api/attendance/qr/*` (verify-and-stage, events, scanner-sessions), `scanner-devices/*`, `identity-badges/*`; `attendance-qr-schema.ts` (identityBadgeCredentials, scannerDevices, scannerSessions, attendanceScanEvents, workforcePunchEvents); migration `0064`; UI scanner-kiosk, badge-management, qr-reports; decoy files deleted.
- **Gaps / next actions:** none blocking (`identityBadgeEvents`/`attendanceScanApplications` accepted substitutions).
- **Key files:** `src/app/api/attendance/qr/verify-and-stage/route.ts`, `src/features/attendance/models/attendance-qr-schema.ts`.

### 10. assessment-and-examination — `future-implementation/assessment-and-examination/`
- **Verdict:** 🟠 PARTIAL · **Status:** ✅ DONE (2026-08-14) — UI de-mocked, online-exam addon retired
- **Scope:** Shared assessment ledger, homework rework, Exam Master, online-exam addon (question bank, server-timed runner, live monitor).
- **Found in code:** migration `0060` (22 tables); `assessment-schema.ts`; services `outcome/homework/exam-master`; Exam Master fully wired (`exam-terms/halls/schedules`, seat-allocation/marksheet/rankings); remediation applied to `online-exams/submit` + `homework-service`; 11 tests (`assessment.test.ts`).
- **Gaps / next actions:**
  - [x] **Decide the online-exams addon fate.** RESOLVED 2026-08-13: `OnlineExamService` + its `0060` online-exam-addon tables retired (zero route consumers, `online_exam_attempts` name collision with legacy `0025`); migration `0117` drops the 5 orphaned tables (`question_banks`, `question_items`, `question_options`, `online_exam_policies`, `online_exam_responses`). The live online-exam feature is the legacy `0025` MCQ flow.
  - [x] **De-mock the online-exams page** (M13 §01): real list/create/question-authoring/take flows against the legacy `0025` routes.
  - [x] **De-mock the homework page** (M13 §02): removed demo seed + fake `studentId` submit + fabricated class/submission counts; teacher create/grade real.
  - [x] **Verify the exam-master page** (M13 §03): already wired; helper text added.
  - [x] **Update stale STATE.md + EXECUTION-AUDIT-REPORT** (M13 §04): "100% deployed" claims corrected to PARTIALLY DEPLOYED; STATE.md next-steps ticked done.
  - [ ] **Known backend gaps (documented, not bugs):** `GET /api/academics/homework` is student-scoped (no teacher "grade my class roster" endpoint); `GET /api/academics/online-exams/[id]/questions` requires `grading.read` and returns `isCorrect` (no student-facing sanitized-questions endpoint). Real student take-exam flow belongs in the student portal — out of scope.
- **Gates (2026-08-14):** tsc 0; vitest 11/11; tenant-isolation pass; `next build` exit 0.
- **Key files:** `src/features/assessment/`, `src/app/api/academics/online-exams/**`, `src/app/api/academics/homework/**`, `migrations/0060`, `migrations/0117`.

### 11. attachments-book — `future-implementation/attachments-book/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** ✅ DONE
- **Scope:** Versioned tenant-scoped resource library, attachment-type taxonomy, malware scan, audience targeting, usage-links reuse.
- **Found in code:** migration `0063`; `attachments-schema.ts` (10 tables); APIs `content/assets`, `content/attachment-types`; `src/libs/api/{blob-store,malware-scan,uploads}.ts`; ClamAV service in docker-compose; UI `content/library`, `content/types`, `documents/*`; homework consumer.
- **Gaps / next actions:** none blocking (tus resumable uploads, S3, Tika, quota dashboard deferred by design).
- **Key files:** `src/features/attachments/models/attachments-schema.ts`, `src/libs/api/malware-scan.ts`.

### 12. student-accounting — `future-implementation/student-accounting/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** ✅ DONE (2026-08-15)
- **Scope:** Payment types, fine setup, fee allocation preview/run, receivables aging, reminders — 9 screens, 12 new tables, new API surface.
- **Found in code:** migration `0108_student_accounting.sql`; `/api/finance/**` — `fee-types`, `fine-policies`, `fine-runs`, `invoice-events`, `payment-methods`, `reminder-rules`, `reminder-runs`, `reminders`, `fee-allocation`, `allocations`, `cashier-sessions`, `credit-notes`, `refunds` (plus foundation `invoices|payments|fee-structures|fee-assignments|expenses|reports|statements`); pages `/dashboard/finance/{fee-types,fine-policies,reminders,allocation,receivables,collection-desk,payments,invoices,refunds,credit-notes,fee-assignments}` + `/dashboard/settings/payment-methods`.
- **Gaps / next actions:** core plan surface shipped; remaining plan tables that lean on cashier/office-accounting scope are tracked under #13/#14.
  - [x] **Phase A safety hardening (2026-08-10):** atomic `consumeDocumentNumber` (advisory lock + `(tenant_id, prefix)` series, `naming_series` PK fixed) for INV/CN/RF; BigInt-cents `moneyInput` validation; unique `(tenant_id, invoice_number)` indexes; `invoice_events` ledger on create + payment_recorded; payment `idempotency_key` (partial unique index); read-time `effectiveStatus` (overdue never persisted). Migration `0111`, verified by tsc + vitest (finance 10/10) + live curl (sequential INV-2026-0004→0005, idempotent double-post single row, past-due → overdue).
  - [x] **Phase B fee types + versioned structures (2026-08-10):** `fee_categories` enriched with `code` (optional, per-tenant unique), tax/refund/discount/fine flags, revenue-account mapping (FK→`chart_of_accounts`), active dates, `is_archived` (archive, never delete); `fee_structures` scoped by academic term (FK→`semesters`) + branch (FK→`branches`); fee-structure DELETE guarded (409 `FEE_STRUCTURE_VERSIONED` once any version exists — deactivate instead); version components now carry `recurrence`/`taxable`/`dueOffsetDays` with BigInt-cents `moneyInput` amounts stored as normalized strings in the immutable snapshot. Retired the duplicate `pricing` screen (single Fees Group surface). Migration `0112` via `scripts/apply-0112.mjs` (idempotent ×2), verified by tsc (Phase B files clean) + vitest (finance 20/20 incl. fee-type + fee-structure-version suites) + tenant-isolation check.
  - [x] **Phase C fee allocations preview/approve/run (2026-08-14):** new `/api/finance/fee-allocations` namespace — `preview` → optional `approve` (approver ≠ author, 403 `SELF_APPROVAL`) → `run` → `cancel`, plus GET list/detail. Billing source is the immutable published version's `componentsSnapshot` (draft → 422 `VERSION_NOT_PUBLISHED`; empty → 422 `VERSION_NO_COMPONENTS`); per-student totals in BigInt cents, invoice due date = base + max `dueOffsetDays`. Run generates invoices via `consumeDocumentNumber` (`INV-{year}-`, fixing the latent `on conflict (prefix)` bug from Phase A), one `invoice_items` row per component, `invoice_events` `source:'allocation'`, idempotent resume (re-run → 409, no duplicates). New `GET /api/finance/fee-structure-versions` (published versions for the UI select) + allocations screen `/dashboard/finance/allocations` (French UI, sidebar `Allocations de frais`). Migration `0114` via `scripts/apply-0114.mjs` (idempotent ×2), verified by tsc exit 0 + vitest (finance 29/29) + tenant-isolation check. Phase D (invoice/statement, payment allocations, receipts) next per plan.
  - [x] **Phase D invoice lifecycle + payment allocations + receipts + statements (2026-08-14):** `invoice_status` enum extended `draft`/`credited`; lifecycle routes `invoices/[id]/{issue,cancel,credit}` (issue draft→pending, cancel pending→cancelled, credit pending/partial→credited + `studentCredits` row `source:'invoice_credit'`, paid→409). `POST /api/finance/payments` refactored to multi-invoice `allocations[]` (strict overpay 409 `PAYMENT_EXCEEDS_BALANCE`, `PAYMENT_MIXED_STUDENTS` 422, idempotent replay, legacy single-invoice shape back-compat); `getInvoiceDetail` now joins payments via `payment_allocations`. New `receipts` table + `consumeDocumentNumber` `RC-{year}-` numbering, `createReceipt` inside the payment transaction, `GET /api/finance/receipts`(+`/[id]`); `POST /api/finance/allocations` deprecated → 410 GONE. `GET /api/finance/statements` rewritten (opening + charges − credits = closing, excludes cancelled/draft, BigInt cents, UTC-day compares). New screens `/dashboard/finance/receipts` + `/dashboard/finance/statements` + sidebar `Reçus`/`Relevés élèves`; collection-desk Encaisser modal made multi-invoice. Migration `0118` via `scripts/apply-0118.mjs` (idempotent ×2). Verified by tsc (finance clean; 2 pre-existing library-test errors unrelated) + vitest (finance 43/43 incl. `payment-allocation` + `invoice-lifecycle` suites) + tenant-isolation check.
  - [x] **Phase E reversals + refund linkage + cashier close/reconcile + credits (2026-08-15):** `payment_status` enum (`posted`/`reversed`/`refunded`) on `payments`; `payment_reversals.rejection_reason`; `cashier_sessions.reconciled_by_id/at`. New `tryPostPaymentReversalGLEntry` (DR AR 34 / CR Cash 11) + `tryPostCashierVarianceGLEntry` (overage DR Cash 11 / CR income 75; shortage DR expense 65 / CR Cash 11) in `gl-auto-post.ts` (fail-open). New `src/libs/services/payment-reversal.ts` — maker `createPaymentReversal` → checker `decidePaymentReversal` → `applyReversal` (restores each allocation's invoice `paidAmount` + `payment_reversed` events + marks payment `reversed`), routes `POST /api/finance/payments/[id]/reverse` (self-approve when creator holds `finance.approve`) + `GET/PATCH /api/finance/payment-reversals`. Refund linkage: `applyApprovedRefund` (shared by `decideRefund` + `refunds/route.ts` auto-approve) marks payment `refunded`, reduces invoice `paidAmount` FIFO across `payment_allocations`, `refund_recorded` events (migration `0042`'s trigger already caps refund ≤ payment + requires a linked payment, so no over-refund credit). New `src/libs/services/cashier-close.ts` — `closeCashierSession` (computes collected cash live from posted cash payments, snapshots `cashier_closings`, posts variance GL) + `reconcileCashierSession` (closed→reconciled), unifying both `accountant/me/cashier` PUT and `cashier-sessions/[id]/close`; new `GET /api/finance/cashier-sessions` + `POST .../[id]/reconcile`; `GET /api/finance/credits`. Correctness: cashier totals + statements filter `payments.status='posted'`; payments GET surfaces `status`. UI: `Sessions de caisse` screen + sidebar/portal-manifest entries; invoices-view payment history `Annulé`/`Remboursé` badges + `Annuler` reverse action; statements-view outstanding credit line. Migration `0121` via `scripts/apply-0121.mjs` (idempotent ×2). Verified by tsc exit 0 + vitest (finance 52/52 incl. `payment-reversal`, `refund-linkage`, `cashier-close` suites) + tenant-isolation check (no new flags; pre-existing public `waitlist` route is the sole flag).
  - [x] **Phase F fine policies + aging + reports (2026-08-15):** `GET /api/finance/fine-assessments` (list, join student/policy/invoice, `?studentId=`/`?status=` filters, `finance.read`) + `POST` waive (`waivedAmount=amount`, `waiveReason`, `waiveById`, `status='waived'`, `finance.manage`, audited); `fees.fines` report adapter (`FeesAdapter.getFinesReport` — joins `fineAssessments` with `user` + waiver alias, returns fineId/studentName/amount/reason/isWaived/waivedBy) replacing the stale `ReportNotReadyError`; `scopeSectionId` applied in `fine-runs` (leftJoin `classSections`, filter by `scopeClassId`/`scopeSectionId`); seed assessment status `open`→`assessed`; fines list + waive UI in the fine-policies screen.
  - [x] **Phase G Broadcast-backed reminders (2026-08-15):** `src/libs/services/finance-reminders.ts` (`isWithinQuietHours`, `runFinanceReminderRule`, `runAllActiveFinanceReminders`, `sendSingleInvoiceReminder`, `requireActiveReminderRule`) — overdue snapshot → per-invoice `communication_campaigns`/`communication_campaign_recipients` → `processBroadcastQueue` drain → `communication_deliveries` → `finance_reminder_runs`; quiet hours enforced at send time; `reminder-runs/route.ts` POST rewired to Broadcast (no more direct `sms_messages`); `feeReminderJob` registered in `SCHEDULED_HANDLERS`/`HANDLER_IMPLS`; `POST /api/finance/reminders` (single invoice) rewired through `sendSingleInvoiceReminder`; sidebar + portal-manifest entry `Rappels de frais` (`finance.manage`) for the orphan `/dashboard/finance/reminders` page.
  - [x] **Phase H currency + configurable methods + gateways + export (2026-08-24):** `finance.currency` setting (per-tenant ISO-4217, default MAD, `getTenantCurrency`) — single currency per tenant resolved at read/export time (no per-document currency column); `payments.payment_method` enum→`varchar(50)` (migration `0124` via `scripts/apply-0124.mjs`, idempotent ×2) wired to `payment_method_configurations` (`validatePaymentMethod` — legacy fallback when no config, else 422 `PAYMENT_METHOD_UNKNOWN`/`PAYMENT_METHOD_INACTIVE`); new gateway fields on the config (`provider`, `gateway_mode`, `credential_secret_key`, `webhook_secret_key`) + `payment_gateway_sessions` table (`method_code`, `external_reference`, `status pending|paid|failed`, `raw_callback`); extracted `src/libs/services/payment-create.ts` (shared by manual `POST /api/finance/payments` + the gateway callback, nullable `actorId`/`receivedById`/`createdById`); `src/libs/payments/{provider,cmi-naps-provider,stripe-provider}.ts` registry — CMI NAPS sandbox is end-to-end testable (live throws 501 `GATEWAY_LIVE_PENDING`), Stripe implemented (sandbox + live Checkout Session + HMAC webhook verify, `finance.stripeSecretKey`/`finance.stripeWebhookSecret` secrets, 2026-08-24); `resolveSecretByKey` server-side secret accessor; `POST /api/finance/payments/online` + unauthenticated `.../online/callback` (idempotent replay, provider-verified); offline method field enforcement (`requiresReference`/`requiresDate` → 422 `PAYMENT_REFERENCE_REQUIRED`/`PAYMENT_DATE_REQUIRED`); config-driven collection-desk method options; `src/libs/finance/export/{journal-extract,accounting-export-adapter}.ts` — `buildStudentJournal` (invoice/payment/receipt/reversal/refund/credit, debit/credit directions, BigInt-cents, no row cap) + CSV/XLSX adapters (formula-safe `CsvExporter`/`ExcelExporter`) + DAMANCOM/INP/Sage stubs (501 `ERP_NOT_IMPLEMENTED`); `GET /api/finance/exports/journal?format=csv|xlsx` (streamed, `accounting.export`) + `POST .../journal/push`. Verified by tsc (finance clean) + vitest (finance **69/69** incl. new `currency`/`payment-method-config`/`gateway-session`/`journal-export` suites) + tenant-isolation check (no new flags; pre-existing `waitlist` public route is the sole flag — the empty `analytics/route.ts` stub was restored 2026-08-24). Live HTTP script `scripts/verify-student-accounting-phase-h.mjs` → **15/15** (currency→EUR, configured methods, inactive→422, online→session→callback→posted, journal CSV/EUR + XLSX mime, push→501).
- **Verification (live):** `scripts/verify-student-accounting.mjs` → **39/39**; `scripts/verify-student-accounting-migration.mjs` + `scripts/browser-student-accounting.mjs` documented; re-verified 2026-08-10 (T8 gate). Phase F/G: `scripts/verify-student-accounting-phase-f-g.mjs` → **14/14** (fine-assessments GET+waive, policy create, fine-runs assess + scope, reminder-rules create, reminder-runs + single-invoice reminder dispatch through Broadcast `communication_campaigns` — not `sms_messages`). Phase H: `scripts/verify-student-accounting-phase-h.mjs` → **15/15** (2026-08-24).
- **Key files:** `migrations/0108_student_accounting.sql`, `src/app/api/finance/**`, `src/features/finance/ui/**`, `future-implementation/student-accounting/STUDENT-ACCOUNTING-ENHANCEMENT-PLAN.md`.

### 13. office-accounting — `future-implementation/office-accounting/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** ✅ DONE
- **Scope:** Double-entry ledger, chart of accounts, fiscal periods/journals, posting engine, deposits, expense approval, reconciliation, trial balance/GL/P&L/BS/Cash-flow, student-accounting adapter.
- **Found in code:** migrations `0085/0089/0090/0093/0097/0098/0103/0106`; `accounting-schema.ts` (19 tables incl. closing runs, statement matches, source mappings, adapter exceptions); services `{posting,document,period,reconciliation,student-accounting-adapter}`; full API + pages; bank-reconciliation suite.
- **Gaps / next actions:**
  - [x] `payroll-posting.ts` — implemented (Payroll-owned): `src/features/workforce/services/payroll-posting.ts` builds a balanced accrual (`buildPayrollAccrual`), posts via `postAccountingVoucher`, queues `accounting_adapter_exception` when mappings are missing, records `payroll_postings`, supports reversal. (Prior "unbuilt" note was stale.)
  - [ ] Morocco tax/statutory mappings uncertified (explicit non-certification — certification scaffold added 2026-08-24 in `ma-regulation-adapter.ts`).
- **Key files:** `src/features/accounting/models/accounting-schema.ts`, `src/features/accounting/services/*`.

### 14. accountant-portal — `future-implementation/accountant-portal/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** ✅ DONE (mock cleanup + real portal data, 2026-08-09)
- **Scope:** Receivables, cashier, reconciliation, approvals, close status, finance reports; Phase 3 = fee assignments, refunds maker-checker, credit notes, reminders.
- **Found in code:** `api/accountant/me/*` (home, receivables, cashier, approvals, office-accounting); `cashier_sessions` + migration `0054`; capability-driven sidebar; Phase-3 work real (fee-assignments, `decideRefund` maker-checker, credit-notes).
- **Gaps / next actions:**
  - [x] **Rebuild `reminders-statements-view.tsx`** — now consumes real `GET/POST /api/finance/reminders`: tenant-scoped overdue list, per-row "Envoyer un rappel", session send-log. 2026-08-09.
  - [x] **Dead-page check** `finance/reconciliation/page.tsx` — verified NOT dead (renders real BankReconciliationView); kept.
  - [x] **Replace mock landing** `accountant-portal-view.tsx` — now fetches real `/api/accountant/me/home` + `/api/finance/invoices` (KPI band, cashier-session banner, recent-invoices table). 2026-08-09.
  - [x] **Automated tests for cashier math + capability gates** — `scripts/verify-accountant-portal.mjs` 19/19 + `scripts/browser-accountant-portal.mjs` 15/15. Also **hardened role gate**: `parent` default-capability includes `finance.read`, so all `/api/accountant/me/*` routes were tightened to `requireRequestContext(req, ['school_admin','accountant'])` — parents can no longer read tenant-wide finance data via those endpoints (verified: parent 403 on home/reminders). 2026-08-09.
- **Key files:** `src/features/finance/ui/{reminders-statements-view,accountant-portal-view,fee-assignments-view}.tsx`, `src/app/api/finance/{refunds,credit-notes,fiscal-periods/close}/route.ts`.

### 15. human-resources-employee-management — `future-implementation/human-resources-employee-management/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** 🟡 IN PROGRESS
- **Scope:** Departments/designations, employee directory + 5-step wizard, access lifecycle + safe offboarding, sensitive-field redaction, HR overview/export.
- **Found in code:** migration `0073`; `hr-schema.ts` (departments, designations, employee_documents, employment_events, invitations, salary_advances, awards, profile_edit_requests); full HR pages + API; permissions + sidebar.
- **Gaps / next actions:**
  - [ ] **`api/hr/employees/[id]/provision-access` route missing** — plan claims it exists; build or drop (SMTP not configured).
  - [ ] `employeeInvitations` table has **zero consumers** — wire or remove.
  - [ ] Missing services: `employment-events-service.ts`, `invitations-service.ts` (events handled inside employees-service).
  - [ ] Flip registry `human-resources` → `enabled:true`, update description.
  - [ ] SMTP/invite transport (deferred).
- **Key files:** `src/features/hr/models/hr-schema.ts`, `src/features/hr/services/`, `src/models/Schema.ts:3614`.

### 16. payroll-and-workforce-operations — `future-implementation/payroll-and-workforce-operations/`
- **Verdict:** 🟠 PARTIAL · **Status:** 🟡 IN PROGRESS
- **Scope:** Morocco rules, versioned components/structures, run lifecycle, maker/checker, immutable results/payslips, payments/reconciliation, accounting posting.
- **Found in code:** `workforce-schema.ts` (20 tables); migrations `0094/0099/0106`; services `payroll-engine/runs/posting/expression-engine/ma-regulation-adapter`; full workforce pages + API; `payroll.*` permissions.
- **Gaps / next actions:**
  - [ ] **Fix build blocker** `src/features/workforce/services/payroll-runs.ts:562` (type error) — gates everything.
  - [ ] `/dashboard/workforce/me/*` self-service routes don't exist (self-service lives at `/dashboard/hr/self-service`).
  - [ ] DAMANCOM + bank export adapters disabled/uncertified.
  - [ ] Legal validation (COMPLIANCE-STATUS "not certified") — 🚧 external.
  - [ ] Browser French/Arabic/RTL + maker/checker acceptance (manual).
- **Key files:** `src/features/workforce/models/workforce-schema.ts`, `src/features/workforce/services/`, `src/features/workforce/ui/payroll-workspace.tsx`.

### 17. employee-self-service-portal — `future-implementation/employee-self-service-portal/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** ✅ DONE
- **Scope:** Home/profile (sensitive re-auth + HR approval), leave, time, published payslips, advances/awards, documents, requests, preferences.
- **Found in code:** `api/employee/me/*` (home, profile, preferences, leave, payroll, advances, awards, documents, requests, time); migration `0100`; `hr-schema.ts` additions; `employee-portal-view.tsx` at `/dashboard/hr/self-service`.
- **Gaps / next actions:** none significant.
- **Key files:** `src/features/hr/services/employee-context.ts`, `src/app/api/employee/me/**`.

### 18. school-leadership-portal — `future-implementation/school-leadership-portal/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** ✅ DONE (2026-08-10)
- **Scope:** Leadership home, academic/attendance/finance/workforce summaries, exceptions, approval inbox, delegation/scope administration.
- **Found in code:** `leadership-schema.ts` (scope_assignments, approval_authorities); migration `0096`; APIs `leadership/{admin/authorities,admin/scopes,me/approvals,me/exceptions,me/home}`; guard `src/features/leadership/ui/page-guard.ts`.
- **What shipped (2026-08-10):**
  - **Page guard** `requireLeadershipPage(locale, { admin? })` — `leadership.portal.use` (school_admin implicit; others need an ACTIVE scope), `leadership.scope.manage` for the admin page. Home page re-gated from the old `analytics.read`/school_admin-only gate.
  - **4 pages** under `/dashboard/portals/leadership`: home (`LeadershipPortalView` on `/api/leadership/me/home`), `approvals` (`leadership-approvals-client` → `/api/leadership/me/approvals`), `exceptions` (`leadership-exceptions-client` → `/api/leadership/me/exceptions`), `admin` (`leadership-admin-client` → admin scopes + authorities APIs).
  - **Admin client** — two tabs (Périmètres / Autorités) with create modals: user select from `/api/users?status=active`, branch select from `/api/settings/branches`, department select from `/api/hr/departments?status=active`; authority form with domain/action/plafond/dates + delegation select.
  - **Authorities GET** added to `app/api/leadership/admin/authorities/route.ts` (joined assignment + user, gated `leadership.scope.manage`).
  - **Sidebar "Direction" nav section** added to `portal-manifest.ts` (home/approvals/exceptions/admin; admin child gated `leadership.scope.manage`).
- **Gaps / next actions:** none structural. Remaining plan items (saved/scheduled reports, delegation thresholds, metric freshness UIs, wellbeing/reports sections) are future scope.
- **Verification (live, 2026-08-10):** `npx tsc --noEmit` exit 0; scope-service vitest 7/7 (school_admin implicit tenant scope; teacher without capability FORBIDDEN; active branch/department scope resolution; expired/future/revoked rejected; authorities only in-window + own assignment); tenant-isolation static check pass; 4 pages render 200 for Atlas school_admin; all 5 leadership APIs 200 with real data; admin POST create (branch scope + finance authority) round-trips through GET lists; **two-tenant adversarial**: Lango admin sees empty scopes/authorities (no Atlas leak); deny path: student 403 on admin + approvals APIs, 307 page, unauthenticated 401; test rows cleaned; `npx next build` exit 0.
- **Key files:** `src/features/leadership/` (ui/page-guard, ui/leadership-{approvals,exceptions,admin}-client, services/scope-service.ts + test), `src/app/api/leadership/**`, `src/features/crm/ui/leadership-portal-view.tsx`, `src/libs/api/portal-manifest.ts`.

### 19. teacher-portal — `future-implementation/teacher-portal/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** ✅ DONE (2026-08-10)
- **Scope:** Daily workspace (home/today, timetable, my classes, attendance, teaching/resources, assessments, communication, meetings, reports, profile); `/api/teacher/me/*`; tables `teacherSubstitutions`/`teacherDelegations`/`teacherPortalPreferences`.
- **Found in code:** `/dashboard/teacher/page.tsx` → `TeacherPortalView` now **guarded** (`requireServerPage(locale, { allowedRoles: ['teacher'] })`); `src/features/teacher/` (api + ui); `/api/teacher/me/{home,timetable,classes}` — session-scoped aggregate home (profile/today/my-classes widgets), 7-day weekly timetable, class roster with subjects; cross-tenant isolation verified.
- **Gaps / next actions:**
  - [ ] Broader sections (attendance, assessments, communication, meetings, reports) + `teacherSubstitutions`/`teacherDelegations`/`teacherPortalPreferences` tables + nav group are future scope; core teacher workspace shipped.
- **Verification (live):** `scripts/verify-teacher-portal.mjs` → **20/20** (incl. school_admin 403 gate, cross-tenant no-leak); `scripts/browser-teacher-portal.mjs` documented; re-verified 2026-08-10 (T8 gate).
- **Key files:** `src/app/[locale]/(dashboard)/dashboard/teacher/page.tsx`, `src/features/teacher/`, `src/app/api/teacher/me/**`.

### 20. student-portal — `future-implementation/student-portal/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** ✅ DONE (2026-08-10)
- **Scope:** Learner workspace (home, calendar, courses/resources, homework, live classes, attendance, results, exams, library, finance, profile); `/api/student/me/*`.
- **Found in code:** `/dashboard/student/page.tsx` → `StudentPortalView` now **guarded** (`requireServerPage(locale, { allowedRoles: ['student'] })`); `src/features/student/` (api + ui); `/api/student/me/{home,subjects,timetable,attendance}` — learner identity derived from the authenticated session (no client-chosen id), placement/class-scoped data; `/dashboard/student/live-classes` real + guarded (`live.join`).
- **Gaps / next actions:**
  - [ ] Results/exams/library/finance sections + calendar/homework + nav group are future scope; core learner workspace shipped.
- **Verification (live):** `scripts/verify-student-portal.mjs` → **25/25** (incl. role gate 403, unplaced/placement data, cross-tenant no-leak); `scripts/browser-student-portal.mjs` documented; re-verified 2026-08-10 (T8 gate).
- **Key files:** `src/app/[locale]/(dashboard)/dashboard/student/page.tsx`, `src/features/student/`, `src/app/api/student/me/**`.

### 21. parent-guardian-portal — `future-implementation/parent-guardian-portal/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** ✅ DONE
- **Scope:** Household home + child switcher, child overview, attendance/excuses, learning/results, finance, meetings/communication, requests/documents/consents, settings; effective `guardian_students` relationship.
- **Found in code:** pages `dashboard/parent/*` (guarded `allowedRoles:['parent']`); `api/guardian/**` (20 route files incl. per-child); `src/features/parent/` (relationship-resolver); migrations `0088`, `0105`; sidebar "Espace Parent".
- **Gaps / next actions:** none structural. Deferred: online PSP/payment, real-time chat, full Arabic translation; manual browser/mobile/RTL passes pending.
- **Key files:** `src/features/parent/services/relationship-resolver.ts`, `src/app/api/guardian/me/home/route.ts`.

### 22. receptionist-portal — `future-implementation/receptionist-portal/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** ✅ DONE
- **Scope:** Front-desk home, inquiry intake, people lookup (masked), appointments, visitor/pickup desk, handoffs.
- **Found in code:** pages `dashboard/receptionist/*` (guarded); `api/reception/**` (27 route files); `src/features/reception/` (5 tables + services); migration `0092`; 8 `reception.*` permissions + role trims.
- **Gaps / next actions:** none structural. Pending: browser/a11y manual pass, SMS provider wiring (log-only), handoff surfacing in destination UIs, repo build gated by #16 blocker.
- **Key files:** `src/features/reception/services/lookup-service.ts`, `src/app/api/reception/pickups/release/route.ts`.

### 23. library-management — `future-implementation/library-management/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** 🟡 IN PROGRESS (browser sign-off open)
- **Scope:** Full ILS — catalog→edition→copy, circulation, holds, transfers, stocktake, policies/closure calendar, charges→accounting, member self-service, reports.
- **Found in code:** **backend complete** — 49 API routes, 23 tables (`library-schema.ts`), migrations `0080/0095/0101/0102/0104`, 37 tests, librarian role, registry `enabled:true`.
- **Gaps / next actions:**
  - [x] **UI: 12 pages built** — copies, members, holds, transfers, stocktake, policies/closure, reports, charges, categories/taxonomy, catalog list + `catalog/[id]` detail, `me` (self-service).
  - [x] Sidebar: library section expanded to 12 subitems.
  - [x] Delete unreferenced mock `src/features/library/data/library-catalog-config.ts`.
  - [x] Desk active-loans API (`circulation/loans`) + self-service hold-cancel (`me/holds` POST) added.
  - [ ] Manual/browser sign-off (PLAN-STATUS ⏳ Open).
- **Gates (2026-08-10):** tsc 0; vitest 37/37; isolation check pass; live HTTP verified (addon gating, 12 pages 200, desk/portal 200, member me/home+loans+renew+hold-cancel, two-tenant isolation).
- **Key files:** `src/features/library/models/library-schema.ts`, `src/features/library/ui/**`, `src/app/api/addons/library/**`.

### 24. librarian-portal — `future-implementation/librarian-portal/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** 🟡 IN PROGRESS (browser sign-off open)
- **Scope:** Keyboard/barcode-first circulation + catalog workspace at `/dashboard/portals/librarian`; librarian role/capabilities; safe member projections.
- **Found in code:** `portals/librarian/page.tsx` + `desk/page.tsx`; `LibrarianPortalClient` with catalog/copies/members/holds/transfers/stocktake/policies/reports/charges/categories views; `page-guard.ts` gate; CRM mock now unreferenced.
- **Gaps / next actions:**
  - [x] Separate catalog / copies / members / holds / reports portal pages (+ transfers, stocktake, policies, charges, taxonomy).
  - [x] Desk upgraded — active-loans list + renew + return (condition), member search + issue.
  - [x] Self-service `me` portal at `/dashboard/library/me` (home KPIs, loans/renew, holds/cancel, charges, history, children loans).
  - [ ] Manual/browser sign-off (PLAN-STATUS ⏳ Open).
- **Gates (2026-08-10):** tsc 0; vitest 37/37; live HTTP verified (desk + portal 200; self-service member flow incl. renew + hold-cancel; school_admin denied on self-service 403/307).
- **Key files:** `src/features/library/ui/librarian-portal-client.tsx`, `src/features/library/ui/library-*-client.tsx`, `src/features/library/ui/page-guard.ts`.

### 25. inventory-management — `future-implementation/inventory-management/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** 🟡 IN PROGRESS
- **Scope:** Products/categories/units/stores/suppliers, purchases+receive, sales→invoices/payments, issues/loans, movement ledger, adjustments, transfers, reconcile, overview/export.
- **Found in code:** 30 API routes; 26 tables (`inventory-schema.ts`); migration `0077`; 13 pages + sidebar; 7 `inventory.*` permissions; 6 verify scripts.
- **Gaps / next actions:**
  - [ ] Flip registry `inventory` → `enabled:true`, update description ("Not built" is wrong).
  - [ ] Convert verification scripts into vitest (only `inventory-math.test.ts` in-repo).
  - [ ] MANUAL-TESTING §14 manual browser/SQL items.
- **Key files:** `src/features/inventory/models/inventory-schema.ts`, `src/app/api/addons/inventory/**`, `scripts/verify-inventory-*.mjs`.

### 26. event-management — `future-implementation/event-management/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** ✅ DONE (2026-08-11 remediation pass — see `future-implementation/event-management/.implementation-plan/AUDIT-RESPONSE.md` for full evidence)
- **Scope:** Event types, draft→publish lifecycle, bounded recurrence, venues/capacity, RSVP/waitlist, check-in, unified calendar projection, ICS, reports (Phases A–G).
- **Found in code:** 17 tables (`events-schema.ts`); 10 `events.*` permission keys; **24 API routes** under `src/app/api/addons/events/**` (types, events CRUD, publish/cancel, occurrences, venues, audiences, registrations incl. attendee list + self/staff cancel, waitlist + respond, check-ins, tasks, incidents, feedback, communications, reports, calendar, per-event `feed.ics`); services `events-service.ts` (create/list/register with `SELECT ... FOR UPDATE` capacity-race lock), `event-operations-service.ts` (recurrence materialization, publish/cancel, check-in, waitlist promotion, reports, ICS, venue/audience/task/incident/feedback/communication CRUD), `audience-service.ts`; `dashboard/events` calendar page + widget wired on **both** the main tenant dashboard and the super-admin dashboard (the latter degrades to an empty calendar for `super_admin`, who has no tenant — no cross-tenant leak); registry `enabled:true` (now verified warranted, was previously set prematurely).
- **Gaps closed this pass:**
  - [x] Routes for venues, audiences, tasks, incidents, feedback, communications (types/publish/cancel/check-ins/waitlist/`feed.ics`/reports/calendar/occurrences already existed and were verified, not rebuilt). Also added `GET` attendee-list on `[id]/registrations` and fixed a real self-cancel authorization gap on `registrations/[id]/cancel`.
  - [x] Recurrence materialization service — confirmed already real (`buildOccurrenceRows`/`materializeOccurrences`, bounded 366-occurrence guard, idempotent via `onConflictDoNothing`), test-covered.
  - [x] Capacity-race condition — confirmed already fixed (`.for('update')` row lock); proved genuine by deliberately removing it, watching a new deterministic test fail, reverting, watching it pass — see the two concurrency tests in `event-operations-service.test.ts`.
  - [x] Tests — was 1 file/10 tests with no concurrency coverage; now 2 files/20 tests (added the concurrency-race pair + 9 pure-function `audience-service.test.ts` tests).
  - [x] Super-admin dashboard calendar widget — confirmed already wired (`super-admin-dashboard-view.tsx`), safe for the no-tenant case.
  - [x] Out-of-scope check-in kiosk — searched the full repo; confirmed no event-specific kiosk UI/route exists anywhere (only the unrelated guard-portal kiosk, attendance-QR kiosk, and workforce time-clock kiosk, none of which are events-scoped). Nothing to remove.
- **Deliberately still deferred (documented, not faked):** `eventInvitations` (publish-time audience snapshot) and `eventAttachments` (should reuse attachments-book's `BlobStore`, not a new upload path) tables remain unused — out of this pass's tracker-listed scope. Communications target confirmed registrants, not a full audience-rule→user-list resolver (that's a materially larger feature nothing else needs yet). Tenant-wide authenticated `.ics` subscription feed (vs. today's per-event export) not built. `events-calendar-client.tsx` UI still has 3 hardcoded stat numbers and a dead button — API/service layer only was in scope this pass.
- **Key files:** `src/features/events/models/events-schema.ts`, `src/features/events/services/events-service.ts`, `src/features/events/services/event-operations-service.ts`, `src/app/api/addons/events/**`.

### 27. student-transport — `future-implementation/student-transport/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** ✅ DONE
- **Scope (phases 1–3):** Route/vehicle/driver masters, stops, allocations, trips, rider events, incidents, reports, boarding, self-service.
- **Found in code:** migration `0082` + `0084`; `transport-schema.ts` (15 tables); full API + 13 pages; `transport-service.ts`; addon enabled; sidebar + permissions.
- **Gaps / next actions (deferred phases 4–5):**
  - [ ] GPS/TrackingProvider adapter + `transportPositionRefs`, `transportMaintenance*`, `transportNotificationOutbox` tables.
  - [ ] Live vehicle telemetry, geofencing, ETA (Phase 12 in roadmap).
- **Key files:** `src/features/transport/models/transport-schema.ts`, `src/app/api/transport/`, `migrations/0082_student_transport.sql`.

### 28. hostel-management — `future-implementation/hostel-management/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** ✅ DONE
- **Scope (phases 0–3):** Hostels/zones/categories/rooms/beds, allocations w/ EXCLUDE constraints, roll call, leave passes, escalations, Tonight, resident/guardian projections.
- **Found in code:** migration `0076`; `hostel-schema.ts` (16 tables); full API + 15 UI views; services (allocation/eligibility/escalation/tonight/…); `hostel-audit.test.ts` (482 lines); addon enabled.
- **Gaps / next actions:** none in v1 (visitors, incidents, inspections, maintenance deferred phases 4–5).
- **Key files:** `src/features/hostel/models/hostel-schema.ts`, `src/app/api/addons/hostel/`, `migrations/0076_hostel_management.sql`.

### 29. guard-security-portal — `future-implementation/guard-security-portal/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** ✅ DONE
- **Scope:** Gates/shifts/assignments, HMAC credential verify, kiosk sessions, visitor invitation→pass→visit, pickup authorization/release, incidents, emergency activation.
- **Found in code:** migration `0078`; `guard-schema.ts` (16 tables); full `api/guard/**` + `api/gate/credentials/verify`; services (credential-adapter, release, kiosk, visitors, incidents, emergency); CRM decoy removed; 8 UI views.
- **Gaps / next actions:** none for v1 (hostel/transport handoffs stubbed; offline manifests deferred). Note: plan doc reserves `0076`, actual migration is `0078` — stale doc.
- **Key files:** `src/features/guard/models/guard-schema.ts`, `src/app/api/gate/credentials/verify/route.ts`.

### 30. lead-crm-and-broadcast-messaging — `future-implementation/lead-crm-and-broadcast-messaging/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** ✅ DONE
- **Scope:** Lead CRM (inquiry capture, kanban, duplicates+merge, follow-ups, convert) + Broadcast (connections, segments, versioned templates, campaigns, worker, reports, consent/suppression, automations).
- **Found in code:** migration `0079` (13 communication tables + inquiry columns); `api/crm/inquiries/**`, `api/addons/broadcast/**` (31 routes), `api/communication/send`, webhook `api/webhooks/communication/[provider]`; pages crm + 7 broadcast; sidebar group; registry both `enabled:true`.
- **Gaps / next actions:**
  - [ ] Real SMS/email provider (test provider only) — disclosed by plan.
  - [ ] Update stale registry descriptions (`lead-crm` "only UI missing", `broadcast-messaging` "Fully unbuilt").
- **Key files:** `src/features/broadcast/`, `migrations/0079_lead_crm_broadcast.sql`, `src/app/api/addons/broadcast/**`.

### 31. live-classrooms — `future-implementation/live-classrooms/`
- **Verdict:** 🟡 IN PROGRESS · **Status:** 🟡 IN PROGRESS
- **Scope:** Provider-neutral virtual classrooms, schedule/create-update-cancel-start-end saga, join grants, webhook reconciliation, attendance, recordings/materials, reports.
- **Found in code:** migrations `0081/0087/0091`; `live-classrooms-schema.ts`; 6 API route dirs; services (session/event/join/attendance/recording/report); providers (dev + external_link + BBB disabled); 64 tests; addon `enabled:true`.
- **Gaps / next actions (from its own AUDIT-RESPONSE — binding):**
  - [ ] **P1-3** Guardian authorization — enforce active/effective-dates/custody/per-child/relationshipType.
  - [ ] **P1-4** Webhook provider binding — per-profile secret, rate-limit, transactional idempotent receipt.
  - [ ] **P1-5** Attendance tests — `attendance-service.test.ts` (interval-union/reconnect/grace/threshold).
  - [ ] **P1-6** Attendance posting — tests for authoritative register path + idempotency (code exists, untested).
  - [ ] **P1-7** Lifecycle races — barrier/hook harness (start/start, end/end, provider-callback-during-create, …).
  - [ ] **P1-9** Adversarial HTTP suite — 23 route handlers: 401/403/404/cross-tenant/teacher-scope/422.
  - [ ] **P0-3** Global `next build` exit 0 (blocked by #16 lock).
  - [ ] **P1-8** `external_link` HTTPS-only URL validation + SSRF/timeout hardening.
  - [ ] **P1-11** Composite-tenant FK hardening + preflight violation detection.
  - [ ] P2 UI/a11y sweep (touch targets, focus-visible, RTL, state differentiation).
- **Key files:** `src/features/live-classrooms/services/{session,attendance,join,event}-service.ts`, `migrations/0087_*`, `0091_*`.

### 32. school-website-cms — `future-implementation/school-website-cms/`
- **Verdict:** 🔴 NOT STARTED · **Status:** 🔴 NOT STARTED
- **Scope:** Per-school public site — fixed page types (Home/About/News/Gallery/FAQ/Contact/Services), theme colors, menu builder, public `(school-site)/[tenantSlug]` route group, CMS admin CRUD.
- **Found in code:** only static marketing landing `src/app/[locale]/(marketing)/` (zero fetch); `api/content` = generic assets/attachment-types only.
- **Gaps / next actions (build from scratch):**
  - [ ] Create `src/features/website/` (or `cms`) + `websiteTheme`/`websitePages`/`websiteNews` tables + migration.
  - [ ] `(school-site)/[tenantSlug]` public route group.
  - [ ] CMS admin pages under settings; addon registry entry.
  - [ ] Sequenced after subscription-licensing + custom-domain (per plan).
- **Key files:** `src/app/[locale]/(marketing)/page.tsx`, `src/features/marketing/**`.

### 33. card-and-admit-card-management — `future-implementation/card-and-admit-card-management/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** ✅ DONE
- **Scope:** Student/employee/admit cards, pdfme templates via shared `document-studio`, token+hash verification + public verifier, bulk jobs, revoke/PDF.
- **Found in code:** migration `0067`; `cards-schema.ts`; 13 API routes incl. `public/cards/verify`; 8 pages + `verify/card/[token]`; `src/libs/document-studio/`; addon `card-management`.
- **Gaps / next actions:**
  - [ ] QR/attendance integration (plan §7 step 10) — no direct card→QR wiring (identity-badges API exists separately).
  - [ ] pdfme browser-designer preview not live-exercised (nit).
- **Key files:** `src/features/cards/services/issue-service.ts`, `src/app/api/cards/issue/route.ts`, `src/app/api/public/cards/verify/route.ts`.

### 34. certificate-management — `future-implementation/certificate-management/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** ✅ DONE
- **Scope:** Definitions/templates, eligibility evaluators, serial+token issuance, request state machine (four-eyes), revoke/replace, bulk jobs, signatories, public verifier.
- **Found in code:** migrations `0065/0066/0070`; `certificates-schema.ts`; 21 API routes incl. `public/certificates/verify`; 12 pages + `verify/certificate/[token]`; FIX-PLAN criticals verified fixed.
- **Gaps / next actions:**
  - [ ] Open Badges 3.0 export (deferred out of v1).
  - [ ] Parallel serial load-test (audit-flagged; single-process dev only).
- **Key files:** `src/features/certificates/services/certificate-service.ts`, `src/app/api/public/certificates/verify/route.ts`.

### 35. advanced-reporting — `future-implementation/advanced-reporting/`
- **Verdict:** ✅ IMPLEMENTED (post-remediation) · **Status:** ✅ DONE
- **Scope:** Governed report catalog, parameterized runs, CSV/XLSX/PDF exports, saved views/favorites, schedules + worker, HMAC-signed downloads, admin console.
- **Found in code:** `src/addons/advanced-reporting/` (run-engine, catalog, schedules + worker, secure-download, exporters csv/excel/pdf, 7 adapters); migrations `0059/0062`; 11 API routes; pages `dashboard/reports/*`; remediation verified (28 real report keys, awaited capabilities, real exceljs/pdfkit, worker in `src/instrumentation.ts`).
- **Gaps / next actions:**
  - [ ] `schedule-worker` is in-process `setInterval` — add cross-instance lock if multi-instance deploy.
  - [ ] Update stale `.ultraplan/STATE.md` + `EXECUTION-AUDIT-REPORT.md` (superseded by remediation).
  - [ ] Addon left with 0 entitlements (intentional per PRD — flip when shipping).
- **Key files:** `src/addons/advanced-reporting/services/run-engine.ts`, `src/app/api/addons/reporting/runs/[id]/download/route.ts`.

### 36. alumni-portal — `future-implementation/alumni-portal/`
- **Verdict:** ✅ IMPLEMENTED · **Status:** ✅ DONE
- **Scope:** Alumni role + graduation transition (single/bulk), self-service portal (home/records/events/directory/profile/requests), mentoring, staff admin, public document verification, consent privacy.
- **Found in code:** migration `0061`; `alumni` role; transition services + API (`transition-to-alumni`, `bulk-transition-to-alumni`); `(alumni-portal)` route group; `api/alumni/**`; `api/public/alumni-documents/verify`; 6 tables.
- **Gaps / next actions:**
  - [ ] Donations/fundraising (deferred per plan — confirm still intentional).
  - [ ] Update stale `.ultraplan/STATE.md` (never updated to record execution).
- **Key files:** `src/libs/services/alumni-transition.ts`, `src/app/[locale]/(alumni-portal)/alumni/layout.tsx`, `migrations/0061_alumni_portal.sql`.

---

## Suggested work order (dependency-aware)

1. **Unblock the build** — fix `payroll-runs.ts:562` (#16). Everything else verifies on top of this.
2. **Close the security gap** — guard/replace unguarded mock teacher & student portal pages (#19, #20), delete accountant-portal mock landing + reminders mock + dead reconciliation page (#14).
3. **Resolve the migration collision** at `0057`.
4. **Finance correctness** — ~~start student-accounting (#12)~~ done; ~~finish online-exams addon decision (#10)~~ retired 2026-08-13; payroll posting + tax mappings (#16/#13).
5. **Portal completion** — teacher (#19) + student (#20) portals; leadership portal (#18).
6. **Add-on completion** — library UI pages (#23/#24), events (#26), live-classrooms open P1 items (#31).
7. **Platform polish** — settings platform advanced features (#1), 2FA admin enforcement (#3), subscription/licensing (#4), website CMS (#32).
8. **Hygiene pass** — registry flags, stale docs, mock-data cleanup (cross-cutting checklist).
