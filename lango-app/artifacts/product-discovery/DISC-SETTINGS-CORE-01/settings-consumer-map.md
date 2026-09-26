# Settings consumer map

SETTING → STORAGE → SERVICE → RUNTIME CONSUMERS. Runtime = any file outside the settings pages/APIs, the registry itself, tests and seed scripts. Generated 2026-09-25 by grepping each registry key literal (`'key'`) in `src/`; legacy `school_settings` column readers listed separately.

## Registry keys (`setting_values`, via `libs/settings/registry.ts`)

| Key | Runtime consumers | Files |
|---|---|---|
| `academic.academicYear` | 0 |  |
| `academic.allowOperations` | 0 |  |
| `academic.autoPromotion` | 0 |  |
| `academic.endDate` | 0 |  |
| `academic.startDate` | 0 |  |
| `accounting.defaults` | 0 |  |
| `alumni.autoTransitionEnabled` | 0 |  |
| `attendance.presenceModes` | 0 |  |
| `finance.stripeSecretKey` | 0 |  |
| `finance.stripeWebhookSecret` | 0 |  |
| `i18n.translations` | 0 |  |
| `integrations.connectionLogs` | 0 |  |
| `integrations.providers` | 0 |  |
| `integrations.webhookSigningSecret` | 0 |  |
| `jobs.definitions` | 0 |  |
| `localization.languages` | 0 |  |
| `organization.address` | 0 |  |
| `organization.city` | 0 |  |
| `organization.directorName` | 0 |  |
| `organization.email` | 0 |  |
| `organization.establishmentName` | 0 |  |
| `organization.ice` | 0 |  |
| `organization.legalStatus` | 0 |  |
| `organization.phone` | 0 |  |
| `portal.guardianEnabled` | 0 |  |
| `portal.studentEnabled` | 0 |  |
| `security.dismissedAlerts` | 0 |  |
| `security.policies` | 0 |  |
| `security.sessionTimeoutMinutes` | 0 |  |
| `academic.evaluationWeights` | 1 | app/api/academics/grading-policies/route.ts |
| `attendance.consecutiveAbsenceThreshold` | 1 | libs/api/attendance-flags.ts |
| `attendance.lateGraceMinutes` | 1 | app/api/attendance/qr/verify-and-stage/route.ts |
| `attendance.periodStartTime` | 1 | app/api/attendance/qr/verify-and-stage/route.ts |
| `attendance.repeatedLateThreshold` | 1 | libs/api/attendance-flags.ts |
| `attendance.smsAlerts` | 1 | app/api/attendance/route.ts |
| `cards.autoIssueStudentCardOnApproval` | 1 | features/cards/services/issue-service.ts |
| `finance.currency` | 1 | libs/finance/currency.ts |
| `localization.timezone` | 1 | app/api/attendance/qr/verify-and-stage/route.ts |
| `migration.state` | 1 | libs/services/migration-readiness.ts |
| `security.requireTwoFactorForAdmins` | 1 | libs/auth/two-factor-policy.ts |
| `academic.eliminatoryScore` | 2 | app/api/academics/grading-policies/route.ts, features/academics/services/report-card-service.ts |
| `security.loginAccessMethod` | 2 | app/api/students/[id]/regenerate-access/route.ts, libs/services/alumni-transition.ts |
| `academic.gradingScale` | 3 | app/api/academics/grading-policies/route.ts, app/api/students/promotions/preview/route.ts, features/academics/services/report-card-service.ts |
| `academic.passThreshold` | 3 | app/api/academics/grading-policies/route.ts, app/api/students/promotions/preview/route.ts, features/academics/services/report-card-service.ts |

**29 of 44 keys have 0 runtime consumers.** Several are legitimately config-only for now (organization.* identity is read from `school_settings` instead, see below); the rest are stored and shown but change nothing.

## Legacy `school_settings` table readers outside settings

| File | Columns read |
|---|---|
| app/api/public/signup/route.ts | email establishmentName  |
| app/api/super-admin/schools/route.ts | email establishmentName  |
| app/api/super-admin/waitlist/convert/route.ts | email establishmentName  |
| features/certificates/services/issue-service.ts | directorName directorSignatureUrl establishmentName menAuthorizationNumber officialStampUrl phone schoolSettings.tenantId  |
| features/documents/services/designs.ts | schoolSettings.documentHeaderStyle schoolSettings.tenantId  |
| features/documents/services/finance-loaders.ts | address city email establishmentName ice logoUrl phone rc schoolSettings.tenantId  |
| libs/settings/registry.ts | address city directorName email establishmentName ice phone schoolSettings.attendanceLateGraceMinutes schoolSettings.attendancePeriodStartTime schoolSettings.languages schoolSettings.localeTimezone schoolSettings.loginAccessMethod schoolSettings.presenceModes schoolSettings.security schoolSettings.tenantId  |

## Domain chains (traced)

| Setting | Storage | Service | Consumers (proven) |
|---|---|---|---|
| Academic year | `session_years` | two `getDefaultSessionYearId` copies + ad-hoc `isDefault` queries in 26 files; date-window query in dashboard summary | admissions, students list/placements, timetable slots, report cards (issue + view), promotions, transfers, teacher scope, teacher portal, readiness, coverage, advanced reporting (attendance adapter), employee home, portal home |
| Organisation school year | `school_settings.academic_year/start_date/end_date` | `/api/settings` | settings hub completeness only |
| Semesters | `semesters` (tenant, name, start_month, end_month; **no session-year link**) | `/api/academics/semesters` | read by teachers/accountants (API allowed); used as month windows, identical for every year |
| Pass mark / scale / eliminatory | `setting_values academic.passThreshold/gradingScale/eliminatoryScore` | registry | report-card-service (decision Admis/Ajourné), promotions preview |
| Evaluation weights | `setting_values academic.evaluationWeights` | registry | **none** (only the grading-policies API itself) |
| Subject coefficients | `class_subjects.coefficient` / stream coefficients | report-card-service | report cards, class results |
| Late grace, period start, timezone | `setting_values attendance.lateGraceMinutes/periodStartTime`, `localization.timezone` (legacy columns fallback) | `getEffectiveValueWithLegacyFallback` | QR scan staging only (`/api/attendance/qr/verify-and-stage`) |
| Absence / lateness thresholds | `setting_values attendance.consecutiveAbsenceThreshold/repeatedLateThreshold` | `libs/api/attendance-flags.ts` | attendance flags (defaults when unset; editable only in the generic Values editor) |
| Parent absence SMS | `setting_values attendance.smsAlerts` | `/api/attendance` POST | attendance marking → SMS |
| Presence modes | `school_settings.presence_modes` + `attendance.presenceModes` | — | **none** at runtime (settings UI + hub only) |
| Require 2FA for admins | `setting_values security.requireTwoFactorForAdmins` | `libs/auth/two-factor-policy.ts` | login |
| Login access method | `security.loginAccessMethod` | — | student access regeneration, alumni transition |
| Currency | `finance.currency` | `libs/finance/currency.ts` | finance formatting |
| Invoice / receipt / matricule numbers | `naming_series` | `libs/finance/document-number.ts`, `libs/services/matricule.ts` | invoices, receipts, fee allocation runs, admissions, HR ids, inventory, hostel, alumni codes |
| Numbering series page | `numbering_series_definitions` | `features/settings/services/numbering-service.ts` | **none** |
| Custom fields | `custom_field_definitions` / `_versions` / `custom_field_values` | `custom-fields-service.ts` | **none** (no entity form, import, export or list renders them) |
| Translations | `setting_values i18n.translations` | — | **none** |
| Modules | `addon_entitlements`, `addon_definitions`, `tenants.max_branches` | `libs/api/entitlements.ts hasAddon` | page guards (redirect to entitlements), sidebar, APIs |
