# Route → API → DB map

APIs are collected by following each page's imports (depth 3) for `/api/...` strings; tables by following each route file's imports for drizzle `from/insert/update/delete/join` calls plus `getEffectiveValue/setSettingValue` keys (shown as `setting:<key>`). Static heuristic: see route-level notes in the analysis files for anything load-bearing.

## /dashboard/settings/access-reset

Guard: `requiredCapability: 'users.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/settings/access-reset | yes | access_reset_requests, user, guardians, sms_messages, guardian_students, account, communication_connections, communication_suppressions, communication_consents |
| /api/students | yes | class_sections, classes, sections, user, guardian_students, guardians, attendance, payments, invoices, student_placements, session_years, assessment_results, assessments, alumni_directory_consent, alumni_requests, branches, tenants, plan_limits, addon_entitlements |

## /dashboard/settings/accounting-defaults

Guard: `requiredCapability: 'settings.finance_mapping.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/settings/values/accounting.defaults | no (dynamic path) | — |

## /dashboard/settings/attendance

Guard: `requiredCapability: 'settings.attendance.manage'` · **COMING SOON placeholder**

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| — | — | — |

## /dashboard/settings/audit-logs

Guard: `requiredCapability: 'audit.read'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/audit-logs | yes | audit_logs, user |

## /dashboard/settings/branches

Guard: `requiredCapability: 'settings.organization.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/settings/branches | yes | branches, tenants |
| /api/settings/branches/[x] | yes | branches |

## /dashboard/settings/cndp

Guard: `requiredCapability: 'settings.organization.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/settings/cndp-filing | yes | cndp_filings |

## /dashboard/settings/custom-fields

Guard: `requiredCapability: 'settings.custom_field.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/settings/custom-fields[x] | no (dynamic path) | — |
| /api/settings/custom-fields | yes | custom_field_definitions, custom_field_definition_versions, custom_field_values |
| /api/settings/custom-fields/[x] | yes | custom_field_definitions, custom_field_definition_versions, custom_field_values |
| /api/settings/custom-fields/[x]/values | yes | custom_field_definitions, custom_field_definition_versions, custom_field_values |

## /dashboard/settings/documents

Guard: `requiredCapability: 'settings.organization.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/documents/designs/[x] | no (dynamic path) | — |
| /api/documents/designs/[x]/publish | no (dynamic path) | — |
| /api/documents/previews | yes | document_designs, document_design_versions, school_settings, tenants, user, invoices, invoice_items, receipts, payments, payment_allocations, student_credits, document_artifacts, class_sections, classes, exam_schedules, exam_terms, exam_halls, assessment_definitions, exam_seats, sections, guardian_students, guardians, attendance, student_placements, session_years, assessment_results, assessments, alumni_directory_consent, alumni_requests, branches, plan_limits, addon_entitlements, attendance_flags, expenses, announcements, meeting_slots, timetable_versions, class_schedule_slots, class_subjects, subjects |

## /dashboard/settings/domain

Guard: `requiredCapability: 'settings.organization.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/settings/domains | yes | tenant_domains |
| /api/settings/domains/[x]/verify | yes | tenant_domains |

## /dashboard/settings/drafts

Guard: `requiredCapability: 'settings.organization.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/settings/drafts | yes | setting_drafts, setting_approvals |
| /api/settings/catalog | yes | setting_definition_versions, setting_definitions |
| /api/settings/drafts/[x] | yes | setting_drafts, setting_approvals |
| /api/settings/drafts/[x]/approve | yes | setting_drafts, setting_approvals |
| /api/settings/drafts/[x]/reject | yes | setting_drafts, setting_approvals |

## /dashboard/settings/entitlements

Guard: `requiredCapability: 'settings.read'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/settings/addons | yes | tenants, branches |
| /api/tenant/support | yes | platform_support_tickets, platform_support_ticket_messages, tenants |

## /dashboard/settings/exports

Guard: `requiredCapability: 'audit.read'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/exports | yes | — |
| /api/exports/${encodeURIComponent | no (dynamic path) | — |

## /dashboard/settings/jobs

Guard: `requiredCapability: 'settings.jobs.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/settings/jobs/[x]/trigger | yes | user, session, setting:jobs.definitions |

## /dashboard/settings/live-classrooms

Guard: `requiredCapability: 'live.providers.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/addons/live-classrooms/sessions${qs | no (dynamic path) | — |
| /api/addons/live-classrooms/sessions/[x] | yes | class_sections, class_subjects, user, subject_teachers, academic_class_offerings, class_schedule_slots, live_class_sessions, live_class_provider_profiles, live_class_provider_operations, classes, sections, subjects, live_class_invitations, live_class_participant_events |
| /api/addons/live-classrooms/sessions | yes | class_sections, class_subjects, user, subject_teachers, academic_class_offerings, class_schedule_slots, live_class_sessions, live_class_provider_profiles, live_class_provider_operations, classes, sections, subjects, live_class_invitations, live_class_participant_events |
| /api/addons/live-classrooms/sessions/[x]/start | yes | class_sections, class_subjects, user, subject_teachers, academic_class_offerings, class_schedule_slots, live_class_sessions, live_class_provider_profiles, live_class_provider_operations, classes, sections, subjects, live_class_invitations, live_class_participant_events |
| /api/addons/live-classrooms/sessions/[x]/end | yes | class_sections, class_subjects, user, subject_teachers, academic_class_offerings, class_schedule_slots, live_class_sessions, live_class_provider_profiles, live_class_provider_operations, classes, sections, subjects, live_class_invitations, live_class_participant_events |
| /api/addons/live-classrooms/sessions/[x]/join | yes | live_class_invitations, student_placements, live_class_join_grants, live_class_provider_profiles, live_class_participant_events, live_class_sessions, user, class_sections, classes, sections, class_subjects, subjects, subject_teachers, academic_class_offerings, class_schedule_slots, live_class_provider_operations, guardians, guardian_students |
| /api/addons/live-classrooms/sessions/[x]/redeem-join | yes | live_class_invitations, student_placements, live_class_join_grants, live_class_provider_profiles, live_class_participant_events, live_class_sessions, user, class_sections, classes, sections, class_subjects, subjects, subject_teachers, academic_class_offerings, class_schedule_slots, live_class_provider_operations, guardians, guardian_students |
| /api/addons/live-classrooms/sessions/[x]/sync | yes | live_class_sessions, live_class_provider_profiles, live_class_webhook_receipts, live_class_participant_events |
| /api/addons/live-classrooms/sessions/[x]/attendance | yes | live_class_participant_events, live_class_attendance_summaries, user, class_sections, session_years, attendance, class_subjects, subject_teachers, academic_class_offerings, class_schedule_slots, live_class_sessions, live_class_provider_profiles, live_class_provider_operations, classes, sections, subjects, live_class_invitations |
| /api/addons/live-classrooms/sessions/[x]/reconcile | yes | live_class_participant_events, live_class_attendance_summaries, user, class_sections, session_years, attendance, class_subjects, subject_teachers, academic_class_offerings, class_schedule_slots, live_class_sessions, live_class_provider_profiles, live_class_provider_operations, classes, sections, subjects, live_class_invitations |
| /api/addons/live-classrooms/sessions/[x]/post-attendance | yes | live_class_participant_events, live_class_attendance_summaries, user, class_sections, session_years, attendance, class_subjects, subject_teachers, academic_class_offerings, class_schedule_slots, live_class_sessions, live_class_provider_profiles, live_class_provider_operations, classes, sections, subjects, live_class_invitations |
| /api/addons/live-classrooms/sessions/[x]/recordings | yes | live_class_provider_profiles, live_class_recordings, digital_asset_usage_links, digital_assets, class_sections, class_subjects, user, subject_teachers, academic_class_offerings, class_schedule_slots, live_class_sessions, live_class_provider_operations, classes, sections, subjects, live_class_invitations, live_class_participant_events |
| /api/addons/live-classrooms/sessions/[x]/recordings/[x] | no (dynamic path) | — |
| /api/addons/live-classrooms/sessions/[x]/materials | yes | live_class_provider_profiles, live_class_recordings, digital_asset_usage_links, digital_assets, class_sections, class_subjects, user, subject_teachers, academic_class_offerings, class_schedule_slots, live_class_sessions, live_class_provider_operations, classes, sections, subjects, live_class_invitations, live_class_participant_events |
| /api/addons/live-classrooms/sessions/[x]/materials/[x] | no (dynamic path) | — |
| /api/addons/live-classrooms/my-sessions | yes | live_class_invitations, student_placements, live_class_join_grants, live_class_provider_profiles, live_class_participant_events, live_class_sessions, user, class_sections, classes, sections, class_subjects, subjects, subject_teachers, academic_class_offerings, class_schedule_slots, live_class_provider_operations, guardians, guardian_students |
| /api/addons/live-classrooms/reports/overview${qs | no (dynamic path) | — |
| /api/addons/live-classrooms/provider-profiles | yes | live_class_provider_profiles, live_class_sessions, live_class_provider_operations |
| /api/addons/live-classrooms/provider-profiles/[x] | yes | live_class_provider_profiles, live_class_sessions, live_class_provider_operations |
| /api/addons/live-classrooms/provider-profiles/[x]/test | yes | live_class_provider_profiles, live_class_sessions, live_class_provider_operations |

## /dashboard/settings/migration

Guard: `requiredCapability: 'settings.organization.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/settings/migration | yes | — |
| /api/settings/migration/tasks/[x] | yes | — |
| /api/settings/migration/template | yes | — |

## /dashboard/settings/notifications

Guard: `requiredCapability: 'settings.organization.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/notifications | yes | — |

## /dashboard/settings/numbering

Guard: `requiredCapability: 'settings.numbering.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/settings/numbering | yes | numbering_series_definitions, numbering_series_versions |
| /api/settings/numbering/[x] | yes | numbering_series_definitions, numbering_series_versions |
| /api/settings/numbering/[x]/preview | yes | numbering_series_definitions, numbering_series_versions |
| /api/settings/numbering/[x]/next | yes | numbering_series_definitions, numbering_series_versions |

## /dashboard/settings/onboarding

Guard: `requiredCapability: 'settings.organization.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/settings/logo | yes | tenants |
| /api/settings | yes | school_settings |

## /dashboard/settings

Guard: `requiredCapability: 'settings.organization.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| — | — | — |

## /dashboard/settings/payment-methods

Guard: `requiredCapability: 'finance.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/finance/payment-methods | yes | payment_method_configurations |

## /dashboard/settings/permissions

Guard: `requiredCapability: 'users.permissions.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/settings/permissions | yes | role_permissions |

## /dashboard/settings/policies

Guard: `requiredCapability: 'settings.organization.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/settings/values | yes | setting_definition_versions, setting_definitions |
| /api/settings/values/[x] | no (dynamic path) | — |

## /dashboard/settings/providers

Guard: `requiredCapability: 'settings.integrations.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/settings/providers/[x]/test | yes | setting:integrations.providers, setting:integrations.connectionLogs |
| /api/settings/providers | yes | setting:integrations.providers, setting:integrations.connectionLogs |
| /api/settings/providers/[x] | yes | setting:integrations.providers, setting:integrations.connectionLogs |

## /dashboard/settings/scanner-devices

Guard: `requiredCapability: 'settings.attendance.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/scanner-devices | yes | scanner_devices |
| /api/scanner-devices/pair | yes | branches, scanner_devices |
| /api/scanner-devices/[x] | yes | scanner_devices |

## /dashboard/settings/scheduled-jobs

Guard: `requiredCapability: 'settings.jobs.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/settings/scheduled-jobs | yes | user, session, student_placements, session_years, scheduled_job_definitions, scheduled_job_controls, scheduled_job_runs, setting:alumni.autoTransitionEnabled |
| /api/settings/scheduled-jobs/[x] | yes | user, session, student_placements, session_years, scheduled_job_definitions, scheduled_job_controls, scheduled_job_runs, setting:alumni.autoTransitionEnabled |
| /api/settings/scheduled-jobs/[x]/toggle | yes | user, session, student_placements, session_years, scheduled_job_definitions, scheduled_job_controls, scheduled_job_runs, setting:alumni.autoTransitionEnabled |
| /api/settings/scheduled-jobs/[x]/trigger | yes | user, session, student_placements, session_years, scheduled_job_definitions, scheduled_job_controls, scheduled_job_runs, setting:alumni.autoTransitionEnabled |
| /api/settings/scheduled-jobs/[x]/runs | yes | user, session, student_placements, session_years, scheduled_job_definitions, scheduled_job_controls, scheduled_job_runs, setting:alumni.autoTransitionEnabled |

## /dashboard/settings/security/2fa

Guard: `requiredCapability: 'settings.security.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/auth/get-session | no (dynamic path) | — |
| /api/auth/two-factor/enable | no (dynamic path) | — |
| /api/auth/two-factor/verify-totp | no (dynamic path) | — |
| /api/auth/two-factor/disable | no (dynamic path) | — |

## /dashboard/settings/security/login-events

Guard: `requiredCapability: 'settings.security.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/settings/security/login-events | yes | login_events, user |

## /dashboard/settings/security

Guard: `requiredCapability: 'settings.security.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/settings/values/security.requireTwoFactorForAdmins | no (dynamic path) | — |
| /api/security/sessions/[x] | yes | session, user |
| /api/settings/values/security.dismissedAlerts | no (dynamic path) | — |
| /api/audit-logs/export | yes | audit_logs, user |

## /dashboard/settings/staff

Guard: `requiredCapability: 'users.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/users | yes | user, two_factor, branches, account_setup_tokens, sms_messages |

## /dashboard/settings/subscription

Guard: `requiredCapability: 'settings.organization.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/settings/subscription | yes | school_licenses, license_payments, tenants |
| /api/settings/subscription/renewal-request | yes | school_licenses, license_payments, tenants |

## /dashboard/settings/translations

Guard: `requiredCapability: 'settings.translation.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/settings/values/i18n.translations | no (dynamic path) | — |

## /dashboard/settings/users

Guard: `requiredCapability: 'users.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/users | yes | user, two_factor, branches, account_setup_tokens, sms_messages |
| /api/settings/invitations | yes | tenant_invitations, user |
| /api/settings/invitations/[x] | yes | tenant_invitations |
| /api/settings/permissions | yes | role_permissions |

## /dashboard/settings/values

Guard: `requiredCapability: 'settings.organization.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/settings/values | yes | setting_definition_versions, setting_definitions |
| /api/settings/values/${encodeURIComponent | no (dynamic path) | — |

## /dashboard/settings/website/menu

Guard: `requiredCapability: 'website.menu.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/settings/website/menu-items | yes | website_theme, website_pages, website_menu_items, website_news, tenants |
| /api/settings/website/menu-items/[x] | yes | website_theme, website_pages, website_menu_items, website_news, tenants |

## /dashboard/settings/website/news

Guard: `requiredCapability: 'website.news.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/settings/website/news | yes | website_theme, website_pages, website_menu_items, website_news, tenants |
| /api/settings/website/images | yes | tenants |
| /api/settings/website/news/[x] | yes | website_theme, website_pages, website_menu_items, website_news, tenants |

## /dashboard/settings/website

Guard: `requiredCapability: 'website.read'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/settings/website/theme | yes | website_theme, website_pages, website_menu_items, website_news, tenants |

## /dashboard/settings/website/pages

Guard: `requiredCapability: 'website.pages.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/settings/website/images | yes | tenants |
| /api/public/ | no (dynamic path) | — |
| /api/settings/website/pages | yes | website_theme, website_pages, website_menu_items, website_news, tenants |
| /api/settings/website/pages/[x] | no (dynamic path) | — |

## /dashboard/academics/calendar

Guard: `requiredCapability: 'academics.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/academics/session-years | yes | session_years |

## /dashboard/academics/semesters

Guard: `requiredCapability: 'academics.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/academics/semesters | yes | semesters, class_subjects |

## /dashboard/academics/grading/policies

Guard: `requiredCapability: 'grading.manage'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/academics/classes | yes | branches, classes, mediums, shifts, streams, class_sections, class_subjects, student_placements, attendance, attendance_registers, academic_class_offerings, class_teachers, subject_teachers, class_schedule_slots, assessment_plans, user, semesters, sections |
| /api/academics/streams | yes | streams |
| /api/academics/subjects | yes | mediums, subjects, class_subjects, subject_teachers |
| /api/academics/grading-policies | yes | setting:academic.passThreshold, setting:academic.eliminatoryScore, setting:academic.evaluationWeights, setting:academic.gradingScale |
| /api/academics/streams/coefficients | yes | streams, stream_subject_coefficients, subjects |

## /dashboard/students/matricules

Guard: `requiredCapability: 'students.update'`

| API | Route file exists | DB tables / setting keys |
|---|---|---|
| /api/students | yes | class_sections, classes, sections, user, guardian_students, guardians, attendance, payments, invoices, student_placements, session_years, assessment_results, assessments, alumni_directory_consent, alumni_requests, branches, tenants, plan_limits, addon_entitlements |
| /api/students/matricules | yes | user |

