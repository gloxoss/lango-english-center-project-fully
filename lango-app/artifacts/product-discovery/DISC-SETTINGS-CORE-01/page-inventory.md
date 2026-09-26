# Page inventory — DISC-SETTINGS-CORE-01

Discovered from the route tree (`app/[locale]/(dashboard)/dashboard/settings/**`), the sidebar, the settings hub config and the 4 core-config pages outside /settings. Guard = `requireServerPage` option in the page file. Measured 2026-09-25 on commit 54d386a4, dev DB `schoolos`, logged in as the Atlas director.

| Route | Page guard | Sidebar | Hub card | Desktop FR | Mobile 390 | Arabic RTL |
|---|---|---|---|---|---|---|
| /dashboard/settings/access-reset | requiredCapability: 'users.manage' | yes | no | clean | clean | clean |
| /dashboard/settings/accounting-defaults | requiredCapability: 'settings.finance_mapping.manage' | yes | yes | clean | clean | clean |
| /dashboard/settings/attendance | requiredCapability: 'settings.attendance.manage' | no | no | clean | clean | clean |
| /dashboard/settings/audit-logs | requiredCapability: 'audit.read' | no | no | clean | clean | clean |
| /dashboard/settings/branches | requiredCapability: 'settings.organization.manage' | yes | yes | redirect→/fr/dashboard/settings/entitlements?addon=multi-branch | redirect→/fr/dashboard/settings/entitlements?addon=multi-branch | redirect→/ar/dashboard/settings/entitlements?addon=multi-branch |
| /dashboard/settings/cndp | requiredCapability: 'settings.organization.manage' | yes | yes | clean | clean | clean |
| /dashboard/settings/custom-fields | requiredCapability: 'settings.custom_field.manage' | yes | yes | clean | clean | clean |
| /dashboard/settings/documents | requiredCapability: 'settings.organization.manage' | yes | yes | clean | clean | clean |
| /dashboard/settings/domain | requiredCapability: 'settings.organization.manage' | yes | no | clean | clean | clean |
| /dashboard/settings/drafts | requiredCapability: 'settings.organization.manage' | yes | yes | clean | clean | clean |
| /dashboard/settings/entitlements | requiredCapability: 'settings.read' | yes | yes | clean | clean | clean |
| /dashboard/settings/exports | requiredCapability: 'audit.read' | yes | no | clean | clean | clean |
| /dashboard/settings/jobs | requiredCapability: 'settings.jobs.manage' | yes | yes | clean | clean | clean |
| /dashboard/settings/live-classrooms | requiredCapability: 'live.providers.manage' | yes | no | clean | clean | clean |
| /dashboard/settings/migration | requiredCapability: 'settings.organization.manage' | yes | yes | clean | clean | clean |
| /dashboard/settings/notifications | requiredCapability: 'settings.organization.manage' | yes | no | clean | clean | clean |
| /dashboard/settings/numbering | requiredCapability: 'settings.numbering.manage' | yes | yes | clean | clean | clean |
| /dashboard/settings/onboarding | requiredCapability: 'settings.organization.manage' | no | yes | clean | clean | clean |
| /dashboard/settings | requiredCapability: 'settings.organization.manage' | yes | no | keys:SMS.ma,Settings.mod_documents_title,Settings.mod_documents_desc; error overlay | keys:SMS.ma,Settings.mod_documents_title,Settings.mod_documents_desc; error overlay | keys:SMS.ma,Settings.mod_documents_title,Settings.mod_documents_desc; error overlay |
| /dashboard/settings/payment-methods | requiredCapability: 'finance.manage' | yes | no | clean | clean | clean |
| /dashboard/settings/permissions | requiredCapability: 'users.permissions.manage' | yes | no | clean | clean | clean |
| /dashboard/settings/policies | requiredCapability: 'settings.organization.manage' | yes | yes | clean | clean | clean |
| /dashboard/settings/providers | requiredCapability: 'settings.integrations.manage' | yes | yes | clean | clean | clean |
| /dashboard/settings/scanner-devices | requiredCapability: 'settings.attendance.manage' | yes | no | clean | clean | clean |
| /dashboard/settings/scheduled-jobs | requiredCapability: 'settings.jobs.manage' | yes | yes | clean | clean | clean |
| /dashboard/settings/security/2fa | requiredCapability: 'settings.security.manage' | no | no | clean | clean | clean |
| /dashboard/settings/security/login-events | requiredCapability: 'settings.security.manage' | yes | yes | clean | clean | clean |
| /dashboard/settings/security | requiredCapability: 'settings.security.manage' | yes | yes | clean | clean | clean |
| /dashboard/settings/staff | requiredCapability: 'users.manage' | no | no | clean | clean | clean |
| /dashboard/settings/subscription | requiredCapability: 'settings.organization.manage' | yes | no | clean | clean | clean |
| /dashboard/settings/translations | requiredCapability: 'settings.translation.manage' | yes | yes | clean | clean | clean |
| /dashboard/settings/users | requiredCapability: 'users.manage' | yes | yes | clean | clean | clean |
| /dashboard/settings/values | requiredCapability: 'settings.organization.manage' | yes | no | clean | clean | clean |
| /dashboard/settings/website/menu | requiredCapability: 'website.menu.manage' | yes | no | redirect→/fr/dashboard/settings/entitlements?addon=school-website-cms | redirect→/fr/dashboard/settings/entitlements?addon=school-website-cms | redirect→/ar/dashboard/settings/entitlements?addon=school-website-cms |
| /dashboard/settings/website/news | requiredCapability: 'website.news.manage' | yes | no | redirect→/fr/dashboard/settings/entitlements?addon=school-website-cms | redirect→/fr/dashboard/settings/entitlements?addon=school-website-cms | redirect→/ar/dashboard/settings/entitlements?addon=school-website-cms |
| /dashboard/settings/website | requiredCapability: 'website.read' | yes | no | redirect→/fr/dashboard/settings/entitlements?addon=school-website-cms | redirect→/fr/dashboard/settings/entitlements?addon=school-website-cms | redirect→/ar/dashboard/settings/entitlements?addon=school-website-cms |
| /dashboard/settings/website/pages | requiredCapability: 'website.pages.manage' | yes | no | redirect→/fr/dashboard/settings/entitlements?addon=school-website-cms | redirect→/fr/dashboard/settings/entitlements?addon=school-website-cms | redirect→/ar/dashboard/settings/entitlements?addon=school-website-cms |
| /dashboard/academics/calendar | requiredCapability: 'academics.manage' | yes | no | clean | clean | clean |
| /dashboard/academics/semesters | requiredCapability: 'academics.manage' | yes | no | clean | clean | clean |
| /dashboard/academics/grading/policies | requiredCapability: 'grading.manage' | yes | no | clean | clean | clean |
| /dashboard/students/matricules | requiredCapability: 'students.update' | yes | no | clean | clean | clean |

Not reachable from the sidebar: `/settings/onboarding` (hub only), `/settings/attendance`, `/settings/audit-logs`, `/settings/security/2fa`, `/settings/staff`. Not on the hub: 23 of the 41 pages (18 hub cards for 41 routes; see the hub truth section in report.md).
