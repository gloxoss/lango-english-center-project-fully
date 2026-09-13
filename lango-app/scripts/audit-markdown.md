# SchoolOS (Lango) — Complete 344-Page Audit & Link Directory

> **Audit Scope**: Exhaustive 100% census of all `page.tsx` routes (344 pages) across the entire platform.
> **Quality & Verification**: Verified against `npm run check:ui`, `npm run check:types`, and `npm run test` (160 test suites, 2,148 tests passing).
> **Base URL**: `http://localhost:3111` (Preview in `/fr/`, also fully available in `/ar/` and `/en/`).

## 📊 Operational Domains & User Roles Summary

| # | Operational Domain | Target User Persona | Total Pages | Status |
|:---:|---|---|:---:|:---:|
| 1 | **Super Admin & Multi-Tenancy** | Super Admin (SaaS Platform Owner) | 12 | ✅ Operational |
| 2 | **Central Leadership Command Dashboard** | School Director / Principal | 1 | ✅ Operational |
| 3 | **Executive Leadership, Approvals & Exceptions** | Executive Director & Principal | 4 | ✅ Operational |
| 4 | **Reports & Decision Analytics** | School Leadership & Analytics Team | 6 | ✅ Operational |
| 5 | **School Settings & System Governance** | System & IT Administrator | 36 | ✅ Operational |
| 6 | **Academics, Scheduling & Timetables** | Academic Director & Studies Coordinator | 23 | ✅ Operational |
| 7 | **Faculty & Teaching Staff Management** | Pedagogical Director & Faculty Manager | 4 | ✅ Operational |
| 8 | **Students & Admissions Records** | Admissions Officer & Registrar | 12 | ✅ Operational |
| 9 | **Grades, Exams, Marksheets & Homework** | Teacher & Exam Controller | 12 | ✅ Operational |
| 10 | **Virtual Classrooms & Live E-Learning** | Teacher & E-Learning Coordinator | 4 | ✅ Operational |
| 11 | **Attendance & QR Timekeeping** | Prefect of Studies / Attendance Staff | 8 | ✅ Operational |
| 12 | **Teacher Workspace & Portal** | Teacher / Faculty | 1 | ✅ Operational |
| 13 | **Student Portal & E-Learning** | Student (Élève) | 2 | ✅ Operational |
| 14 | **Parent Portal & Family Hub** | Parent / Guardian | 7 | ✅ Operational |
| 15 | **Finance, Tuition & General Ledger** | Accountant / Financial Controller | 38 | ✅ Operational |
| 16 | **Human Resources & Monthly Payroll** | HR & Payroll Director | 29 | ✅ Operational |
| 17 | **School Library & Media Center** | Librarian / Media Specialist | 16 | ✅ Operational |
| 18 | **School Transport & Fleet Logistics** | Transport & Fleet Coordinator | 13 | ✅ Operational |
| 19 | **Inventory, Assets & Procurement** | Storekeeper & Inventory Manager | 13 | ✅ Operational |
| 20 | **Boarding & Dormitory (Internat)** | Hostel Warden (Internat) | 16 | ✅ Operational |
| 21 | **Front Desk & Visitor Management** | Front Desk Receptionist | 6 | ✅ Operational |
| 22 | **Campus Physical Security & Gate Control** | Gate Security Officer / Guard | 7 | ✅ Operational |
| 23 | **Student & Staff ID Cards** | Identity & Cards Officer | 8 | ✅ Operational |
| 24 | **Certificates, Diplomas & Attestations** | Academic Secretariat & Registrar | 12 | ✅ Operational |
| 25 | **Official Institutional Document Generator** | Administrative Secretary | 1 | ✅ Operational |
| 26 | **Pedagogical Content Library** | Pedagogical Resource Coordinator | 2 | ✅ Operational |
| 27 | **School Calendar & Events** | Events Coordinator & Staff | 2 | ✅ Operational |
| 28 | **Communication, SMS & Broadcast Campaigns** | Communications Officer & Admin | 21 | ✅ Operational |
| 29 | **Alumni Network & Community** | Alumni Officer & Graduates | 11 | ✅ Operational |
| 30 | **Public School Websites (CMS)** | Public / Prospective Families | 9 | ✅ Operational |
| 31 | **Public Document & Diploma Verification** | Public / Employer / Authority | 3 | ✅ Operational |
| 32 | **Authentication & Access Control** | All Users (Public / Staff / Families) | 3 | ✅ Operational |
| 33 | **SchoolOS SaaS Landing & Product Home** | Public / Prospective Clients | 2 | ✅ Operational |
| | **GRAND TOTAL** | **ALL ROLES & PERSONAS** | **344** | **100% COMPLETE** |

---

## 1. Super Admin & Multi-Tenancy

**Target User Role**: Super Admin (SaaS Platform Owner)  
**Total Pages**: 12

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/dashboard/super-admin/domains](http://localhost:3111/fr/dashboard/super-admin/domains) | `/[locale]/(dashboard)/dashboard/super-admin/domains` | `SuperAdminDomainsPage` | ✅ **DONE** |
| 2 | [/dashboard/super-admin](http://localhost:3111/fr/dashboard/super-admin) | `/[locale]/(dashboard)/dashboard/super-admin` | `SuperAdminDashboardPage` | ✅ **DONE** |
| 3 | [/dashboard/super-admin/reports](http://localhost:3111/fr/dashboard/super-admin/reports) | `/[locale]/(dashboard)/dashboard/super-admin/reports` | `SuperAdminReportsPage` | ✅ **DONE** |
| 4 | [/dashboard/super-admin/schools/create](http://localhost:3111/fr/dashboard/super-admin/schools/create) | `/[locale]/(dashboard)/dashboard/super-admin/schools/create` | `SuperAdminSchoolsCreatePage` | ✅ **DONE** |
| 5 | [/dashboard/super-admin/schools](http://localhost:3111/fr/dashboard/super-admin/schools) | `/[locale]/(dashboard)/dashboard/super-admin/schools` | `SuperAdminSchoolsPage` | ✅ **DONE** |
| 6 | [/dashboard/super-admin/schools/[id]](http://localhost:3111/fr/dashboard/super-admin/schools/[id]) | `/[locale]/(dashboard)/dashboard/super-admin/schools/[id]` | `SuperAdminSchoolDetailPage` | ✅ **DONE** |
| 7 | [/dashboard/super-admin/settings](http://localhost:3111/fr/dashboard/super-admin/settings) | `/[locale]/(dashboard)/dashboard/super-admin/settings` | `SuperAdminSettingsPage` | ✅ **DONE** |
| 8 | [/dashboard/super-admin/sms](http://localhost:3111/fr/dashboard/super-admin/sms) | `/[locale]/(dashboard)/dashboard/super-admin/sms` | `SuperAdminSmsPage` | ✅ **DONE** |
| 9 | [/dashboard/super-admin/subscriptions/list](http://localhost:3111/fr/dashboard/super-admin/subscriptions/list) | `/[locale]/(dashboard)/dashboard/super-admin/subscriptions/list` | `SuperAdminSubscriptionsListPage` | ✅ **DONE** |
| 10 | [/dashboard/super-admin/subscriptions](http://localhost:3111/fr/dashboard/super-admin/subscriptions) | `/[locale]/(dashboard)/dashboard/super-admin/subscriptions` | `SuperAdminSubscriptionsPage` | ✅ **DONE** |
| 11 | [/dashboard/super-admin/support](http://localhost:3111/fr/dashboard/super-admin/support) | `/[locale]/(dashboard)/dashboard/super-admin/support` | `SuperAdminSupportPage` | ✅ **DONE** |
| 12 | [/dashboard/super-admin/waitlist](http://localhost:3111/fr/dashboard/super-admin/waitlist) | `/[locale]/(dashboard)/dashboard/super-admin/waitlist` | `SuperAdminWaitlistPage` | ✅ **DONE** |

---

## 2. Central Leadership Command Dashboard

**Target User Role**: School Director / Principal  
**Total Pages**: 1

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/dashboard](http://localhost:3111/fr/dashboard) | `/[locale]/(dashboard)/dashboard` | `DashboardPage` | ✅ **DONE** |

---

## 3. Executive Leadership, Approvals & Exceptions

**Target User Role**: Executive Director & Principal  
**Total Pages**: 4

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/dashboard/portals/leadership/admin](http://localhost:3111/fr/dashboard/portals/leadership/admin) | `/[locale]/(dashboard)/dashboard/portals/leadership/admin` | `LeadershipAdminPage` | ✅ **DONE** |
| 2 | [/dashboard/portals/leadership/approvals](http://localhost:3111/fr/dashboard/portals/leadership/approvals) | `/[locale]/(dashboard)/dashboard/portals/leadership/approvals` | `LeadershipApprovalsPage` | ✅ **DONE** |
| 3 | [/dashboard/portals/leadership/exceptions](http://localhost:3111/fr/dashboard/portals/leadership/exceptions) | `/[locale]/(dashboard)/dashboard/portals/leadership/exceptions` | `LeadershipExceptionsPage` | ✅ **DONE** |
| 4 | [/dashboard/portals/leadership](http://localhost:3111/fr/dashboard/portals/leadership) | `/[locale]/(dashboard)/dashboard/portals/leadership` | `LeadershipPortalPage` | ✅ **DONE** |

---

## 4. Reports & Decision Analytics

**Target User Role**: School Leadership & Analytics Team  
**Total Pages**: 6

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/dashboard/analytics](http://localhost:3111/fr/dashboard/analytics) | `/[locale]/(dashboard)/dashboard/analytics` | `AnalyticsPage` | ✅ **DONE** |
| 2 | [/dashboard/reports/admin](http://localhost:3111/fr/dashboard/reports/admin) | `/[locale]/(dashboard)/dashboard/reports/admin` | `ReportingAdminPage` | ✅ **DONE** |
| 3 | [/dashboard/reports](http://localhost:3111/fr/dashboard/reports) | `/[locale]/(dashboard)/dashboard/reports` | `ReportsPage` | ✅ **DONE** |
| 4 | [/dashboard/reports/runs](http://localhost:3111/fr/dashboard/reports/runs) | `/[locale]/(dashboard)/dashboard/reports/runs` | `MyRunsPage` | ✅ **DONE** |
| 5 | [/dashboard/reports/schedules](http://localhost:3111/fr/dashboard/reports/schedules) | `/[locale]/(dashboard)/dashboard/reports/schedules` | `SchedulesPage` | ✅ **DONE** |
| 6 | [/dashboard/reports/[key]](http://localhost:3111/fr/dashboard/reports/[key]) | `/[locale]/(dashboard)/dashboard/reports/[key]` | `ReportPage` | ✅ **DONE** |

---

## 5. School Settings & System Governance

**Target User Role**: System & IT Administrator  
**Total Pages**: 36

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/dashboard/settings/access-reset](http://localhost:3111/fr/dashboard/settings/access-reset) | `/[locale]/(dashboard)/dashboard/settings/access-reset` | `AccessResetPage` | ✅ **DONE** |
| 2 | [/dashboard/settings/accounting-defaults](http://localhost:3111/fr/dashboard/settings/accounting-defaults) | `/[locale]/(dashboard)/dashboard/settings/accounting-defaults` | `AccountingDefaultsPage` | ✅ **DONE** |
| 3 | [/dashboard/settings/attendance](http://localhost:3111/fr/dashboard/settings/attendance) | `/[locale]/(dashboard)/dashboard/settings/attendance` | `AttendanceSettingsPage` | ✅ **DONE** |
| 4 | [/dashboard/settings/audit-logs](http://localhost:3111/fr/dashboard/settings/audit-logs) | `/[locale]/(dashboard)/dashboard/settings/audit-logs` | `AuditLogsPage` | ✅ **DONE** |
| 5 | [/dashboard/settings/branches](http://localhost:3111/fr/dashboard/settings/branches) | `/[locale]/(dashboard)/dashboard/settings/branches` | `SettingsBranchesPage` | ✅ **DONE** |
| 6 | [/dashboard/settings/cndp](http://localhost:3111/fr/dashboard/settings/cndp) | `/[locale]/(dashboard)/dashboard/settings/cndp` | `CndpSettingsPage` | ✅ **DONE** |
| 7 | [/dashboard/settings/custom-fields](http://localhost:3111/fr/dashboard/settings/custom-fields) | `/[locale]/(dashboard)/dashboard/settings/custom-fields` | `Page` | ✅ **DONE** |
| 8 | [/dashboard/settings/domain](http://localhost:3111/fr/dashboard/settings/domain) | `/[locale]/(dashboard)/dashboard/settings/domain` | `SchoolAdminDomainsPage` | ✅ **DONE** |
| 9 | [/dashboard/settings/drafts](http://localhost:3111/fr/dashboard/settings/drafts) | `/[locale]/(dashboard)/dashboard/settings/drafts` | `Page` | ✅ **DONE** |
| 10 | [/dashboard/settings/entitlements](http://localhost:3111/fr/dashboard/settings/entitlements) | `/[locale]/(dashboard)/dashboard/settings/entitlements` | `EntitlementsPage` | ✅ **DONE** |
| 11 | [/dashboard/settings/exports](http://localhost:3111/fr/dashboard/settings/exports) | `/[locale]/(dashboard)/dashboard/settings/exports` | `Page` | ✅ **DONE** |
| 12 | [/dashboard/settings/jobs](http://localhost:3111/fr/dashboard/settings/jobs) | `/[locale]/(dashboard)/dashboard/settings/jobs` | `JobsPage` | ✅ **DONE** |
| 13 | [/dashboard/settings/live-classrooms](http://localhost:3111/fr/dashboard/settings/live-classrooms) | `/[locale]/(dashboard)/dashboard/settings/live-classrooms` | `LiveClassroomsSettingsPage` | ✅ **DONE** |
| 14 | [/dashboard/settings/migration](http://localhost:3111/fr/dashboard/settings/migration) | `/[locale]/(dashboard)/dashboard/settings/migration` | `MigrationReadinessPage` | ✅ **DONE** |
| 15 | [/dashboard/settings/notifications](http://localhost:3111/fr/dashboard/settings/notifications) | `/[locale]/(dashboard)/dashboard/settings/notifications` | `Page` | ✅ **DONE** |
| 16 | [/dashboard/settings/numbering](http://localhost:3111/fr/dashboard/settings/numbering) | `/[locale]/(dashboard)/dashboard/settings/numbering` | `Page` | ✅ **DONE** |
| 17 | [/dashboard/settings/onboarding](http://localhost:3111/fr/dashboard/settings/onboarding) | `/[locale]/(dashboard)/dashboard/settings/onboarding` | `SchoolOnboardingPage` | ✅ **DONE** |
| 18 | [/dashboard/settings](http://localhost:3111/fr/dashboard/settings) | `/[locale]/(dashboard)/dashboard/settings` | `SettingsPage` | ✅ **DONE** |
| 19 | [/dashboard/settings/payment-methods](http://localhost:3111/fr/dashboard/settings/payment-methods) | `/[locale]/(dashboard)/dashboard/settings/payment-methods` | `PaymentMethodsPage` | ✅ **DONE** |
| 20 | [/dashboard/settings/permissions](http://localhost:3111/fr/dashboard/settings/permissions) | `/[locale]/(dashboard)/dashboard/settings/permissions` | `Page` | ✅ **DONE** |
| 21 | [/dashboard/settings/policies](http://localhost:3111/fr/dashboard/settings/policies) | `/[locale]/(dashboard)/dashboard/settings/policies` | `PoliciesPage` | ✅ **DONE** |
| 22 | [/dashboard/settings/providers](http://localhost:3111/fr/dashboard/settings/providers) | `/[locale]/(dashboard)/dashboard/settings/providers` | `ProvidersPage` | ✅ **DONE** |
| 23 | [/dashboard/settings/scanner-devices](http://localhost:3111/fr/dashboard/settings/scanner-devices) | `/[locale]/(dashboard)/dashboard/settings/scanner-devices` | `ScannerDevicesSettingsPage` | ✅ **DONE** |
| 24 | [/dashboard/settings/scheduled-jobs](http://localhost:3111/fr/dashboard/settings/scheduled-jobs) | `/[locale]/(dashboard)/dashboard/settings/scheduled-jobs` | `Page` | ✅ **DONE** |
| 25 | [/dashboard/settings/security/2fa](http://localhost:3111/fr/dashboard/settings/security/2fa) | `/[locale]/(dashboard)/dashboard/settings/security/2fa` | `Page` | ✅ **DONE** |
| 26 | [/dashboard/settings/security/login-events](http://localhost:3111/fr/dashboard/settings/security/login-events) | `/[locale]/(dashboard)/dashboard/settings/security/login-events` | `LoginEventsPage` | ✅ **DONE** |
| 27 | [/dashboard/settings/security](http://localhost:3111/fr/dashboard/settings/security) | `/[locale]/(dashboard)/dashboard/settings/security` | `SecurityPage` | ✅ **DONE** |
| 28 | [/dashboard/settings/staff](http://localhost:3111/fr/dashboard/settings/staff) | `/[locale]/(dashboard)/dashboard/settings/staff` | `StaffManagementPage` | ✅ **DONE** |
| 29 | [/dashboard/settings/subscription](http://localhost:3111/fr/dashboard/settings/subscription) | `/[locale]/(dashboard)/dashboard/settings/subscription` | `SubscriptionPage` | ✅ **DONE** |
| 30 | [/dashboard/settings/translations](http://localhost:3111/fr/dashboard/settings/translations) | `/[locale]/(dashboard)/dashboard/settings/translations` | `TranslationsPage` | ✅ **DONE** |
| 31 | [/dashboard/settings/users](http://localhost:3111/fr/dashboard/settings/users) | `/[locale]/(dashboard)/dashboard/settings/users` | `UsersPage` | ✅ **DONE** |
| 32 | [/dashboard/settings/values](http://localhost:3111/fr/dashboard/settings/values) | `/[locale]/(dashboard)/dashboard/settings/values` | `Page` | ✅ **DONE** |
| 33 | [/dashboard/settings/website/menu](http://localhost:3111/fr/dashboard/settings/website/menu) | `/[locale]/(dashboard)/dashboard/settings/website/menu` | `WebsiteMenuSettingsPage` | ✅ **DONE** |
| 34 | [/dashboard/settings/website/news](http://localhost:3111/fr/dashboard/settings/website/news) | `/[locale]/(dashboard)/dashboard/settings/website/news` | `WebsiteNewsSettingsPage` | ✅ **DONE** |
| 35 | [/dashboard/settings/website](http://localhost:3111/fr/dashboard/settings/website) | `/[locale]/(dashboard)/dashboard/settings/website` | `WebsiteThemeSettingsPage` | ✅ **DONE** |
| 36 | [/dashboard/settings/website/pages](http://localhost:3111/fr/dashboard/settings/website/pages) | `/[locale]/(dashboard)/dashboard/settings/website/pages` | `WebsitePagesSettingsPage` | ✅ **DONE** |

---

## 6. Academics, Scheduling & Timetables

**Target User Role**: Academic Director & Studies Coordinator  
**Total Pages**: 23

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/dashboard/academics/assignments](http://localhost:3111/fr/dashboard/academics/assignments) | `/[locale]/(dashboard)/dashboard/academics/assignments` | `AssignmentsPage` | ✅ **DONE** |
| 2 | [/dashboard/academics/calendar](http://localhost:3111/fr/dashboard/academics/calendar) | `/[locale]/(dashboard)/dashboard/academics/calendar` | `AcademicCalendarPage` | ✅ **DONE** |
| 3 | [/dashboard/academics/class-section-teachers](http://localhost:3111/fr/dashboard/academics/class-section-teachers) | `/[locale]/(dashboard)/dashboard/academics/class-section-teachers` | `ClassSectionTeachersPage` | ✅ **DONE** |
| 4 | [/dashboard/academics/class-subjects](http://localhost:3111/fr/dashboard/academics/class-subjects) | `/[locale]/(dashboard)/dashboard/academics/class-subjects` | `ClassSubjectsPage` | ✅ **DONE** |
| 5 | [/dashboard/academics/classes](http://localhost:3111/fr/dashboard/academics/classes) | `/[locale]/(dashboard)/dashboard/academics/classes` | `ClassesPage` | ✅ **DONE** |
| 6 | [/dashboard/academics/classes/[id]](http://localhost:3111/fr/dashboard/academics/classes/[id]) | `/[locale]/(dashboard)/dashboard/academics/classes/[id]` | `ClassDetailPage` | ✅ **DONE** |
| 7 | [/dashboard/academics/conflicts](http://localhost:3111/fr/dashboard/academics/conflicts) | `/[locale]/(dashboard)/dashboard/academics/conflicts` | `ScheduleConflictsPage` | ✅ **DONE** |
| 8 | [/dashboard/academics/mediums](http://localhost:3111/fr/dashboard/academics/mediums) | `/[locale]/(dashboard)/dashboard/academics/mediums` | `MediumsPage` | ✅ **DONE** |
| 9 | [/dashboard/academics/optional-subjects](http://localhost:3111/fr/dashboard/academics/optional-subjects) | `/[locale]/(dashboard)/dashboard/academics/optional-subjects` | `OptionalSubjectsPage` | ✅ **DONE** |
| 10 | [/dashboard/academics](http://localhost:3111/fr/dashboard/academics) | `/[locale]/(dashboard)/dashboard/academics` | `AcademicsPage` | ✅ **DONE** |
| 11 | [/dashboard/academics/promotions](http://localhost:3111/fr/dashboard/academics/promotions) | `/[locale]/(dashboard)/dashboard/academics/promotions` | `PromotionsPage` | ✅ **DONE** |
| 12 | [/dashboard/academics/readiness](http://localhost:3111/fr/dashboard/academics/readiness) | `/[locale]/(dashboard)/dashboard/academics/readiness` | `ReadinessPage` | ✅ **DONE** |
| 13 | [/dashboard/academics/rooms](http://localhost:3111/fr/dashboard/academics/rooms) | `/[locale]/(dashboard)/dashboard/academics/rooms` | `RoomsPage` | ✅ **DONE** |
| 14 | [/dashboard/academics/schedule](http://localhost:3111/fr/dashboard/academics/schedule) | `/[locale]/(dashboard)/dashboard/academics/schedule` | `SchedulePage` | ✅ **DONE** |
| 15 | [/dashboard/academics/sections](http://localhost:3111/fr/dashboard/academics/sections) | `/[locale]/(dashboard)/dashboard/academics/sections` | `SectionsPage` | ✅ **DONE** |
| 16 | [/dashboard/academics/semesters](http://localhost:3111/fr/dashboard/academics/semesters) | `/[locale]/(dashboard)/dashboard/academics/semesters` | `SemestersPage` | ✅ **DONE** |
| 17 | [/dashboard/academics/session-copy](http://localhost:3111/fr/dashboard/academics/session-copy) | `/[locale]/(dashboard)/dashboard/academics/session-copy` | `SessionCopyPage` | ✅ **DONE** |
| 18 | [/dashboard/academics/shifts](http://localhost:3111/fr/dashboard/academics/shifts) | `/[locale]/(dashboard)/dashboard/academics/shifts` | `ShiftsPage` | ✅ **DONE** |
| 19 | [/dashboard/academics/streams](http://localhost:3111/fr/dashboard/academics/streams) | `/[locale]/(dashboard)/dashboard/academics/streams` | `StreamsPage` | ✅ **DONE** |
| 20 | [/dashboard/academics/subjects](http://localhost:3111/fr/dashboard/academics/subjects) | `/[locale]/(dashboard)/dashboard/academics/subjects` | `SubjectsPage` | ✅ **DONE** |
| 21 | [/dashboard/academics/syllabus](http://localhost:3111/fr/dashboard/academics/syllabus) | `/[locale]/(dashboard)/dashboard/academics/syllabus` | `SyllabusPage` | ✅ **DONE** |
| 22 | [/dashboard/academics/teacher-availability](http://localhost:3111/fr/dashboard/academics/teacher-availability) | `/[locale]/(dashboard)/dashboard/academics/teacher-availability` | `TeacherAvailabilityPage` | ✅ **DONE** |
| 23 | [/dashboard/academics/teacher-schedule](http://localhost:3111/fr/dashboard/academics/teacher-schedule) | `/[locale]/(dashboard)/dashboard/academics/teacher-schedule` | `TeacherSchedulePage` | ✅ **DONE** |

---

## 7. Faculty & Teaching Staff Management

**Target User Role**: Pedagogical Director & Faculty Manager  
**Total Pages**: 4

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/dashboard/teachers/bulk-import](http://localhost:3111/fr/dashboard/teachers/bulk-import) | `/[locale]/(dashboard)/dashboard/teachers/bulk-import` | `TeachersBulkImportPage` | ✅ **DONE** |
| 2 | [/dashboard/teachers/manage](http://localhost:3111/fr/dashboard/teachers/manage) | `/[locale]/(dashboard)/dashboard/teachers/manage` | `TeachersManagePage` | ✅ **DONE** |
| 3 | [/dashboard/teachers](http://localhost:3111/fr/dashboard/teachers) | `/[locale]/(dashboard)/dashboard/teachers` | `TeachersPage` | ✅ **DONE** |
| 4 | [/dashboard/teachers/[id]](http://localhost:3111/fr/dashboard/teachers/[id]) | `/[locale]/(dashboard)/dashboard/teachers/[id]` | `TeacherProfilePage` | ✅ **DONE** |

---

## 8. Students & Admissions Records

**Target User Role**: Admissions Officer & Registrar  
**Total Pages**: 12

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/dashboard/students/add](http://localhost:3111/fr/dashboard/students/add) | `/[locale]/(dashboard)/dashboard/students/add` | `AddStudentPage` | ✅ **DONE** |
| 2 | [/dashboard/students/admissions/new](http://localhost:3111/fr/dashboard/students/admissions/new) | `/[locale]/(dashboard)/dashboard/students/admissions/new` | `AdmissionNewPage` | ✅ **DONE** |
| 3 | [/dashboard/students/admissions](http://localhost:3111/fr/dashboard/students/admissions) | `/[locale]/(dashboard)/dashboard/students/admissions` | `AdmissionRequestsPage` | ✅ **DONE** |
| 4 | [/dashboard/students/import](http://localhost:3111/fr/dashboard/students/import) | `/[locale]/(dashboard)/dashboard/students/import` | `StudentImportPage` | ✅ **DONE** |
| 5 | [/dashboard/students/matricules](http://localhost:3111/fr/dashboard/students/matricules) | `/[locale]/(dashboard)/dashboard/students/matricules` | `MatriculesPage` | ✅ **DONE** |
| 6 | [/dashboard/students](http://localhost:3111/fr/dashboard/students) | `/[locale]/(dashboard)/dashboard/students` | `StudentDirectoryPage` | ✅ **DONE** |
| 7 | [/dashboard/students/parents](http://localhost:3111/fr/dashboard/students/parents) | `/[locale]/(dashboard)/dashboard/students/parents` | `ParentsPage` | ✅ **DONE** |
| 8 | [/dashboard/students/parents/[id]](http://localhost:3111/fr/dashboard/students/parents/[id]) | `/[locale]/(dashboard)/dashboard/students/parents/[id]` | `Page` | ✅ **DONE** |
| 9 | [/dashboard/students/photos](http://localhost:3111/fr/dashboard/students/photos) | `/[locale]/(dashboard)/dashboard/students/photos` | `PhotosPage` | ✅ **DONE** |
| 10 | [/dashboard/students/promotions](http://localhost:3111/fr/dashboard/students/promotions) | `/[locale]/(dashboard)/dashboard/students/promotions` | `PromotionsPage` | ✅ **DONE** |
| 11 | [/dashboard/students/transfers](http://localhost:3111/fr/dashboard/students/transfers) | `/[locale]/(dashboard)/dashboard/students/transfers` | `TransfersPage` | ✅ **DONE** |
| 12 | [/dashboard/students/[id]](http://localhost:3111/fr/dashboard/students/[id]) | `/[locale]/(dashboard)/dashboard/students/[id]` | `StudentProfilePage` | ✅ **DONE** |

---

## 9. Grades, Exams, Marksheets & Homework

**Target User Role**: Teacher & Exam Controller  
**Total Pages**: 12

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/dashboard/academics/assessment/exam-master](http://localhost:3111/fr/dashboard/academics/assessment/exam-master) | `/[locale]/(dashboard)/dashboard/academics/assessment/exam-master` | `Page` | ✅ **DONE** |
| 2 | [/dashboard/academics/assessment/homework](http://localhost:3111/fr/dashboard/academics/assessment/homework) | `/[locale]/(dashboard)/dashboard/academics/assessment/homework` | `Page` | ✅ **DONE** |
| 3 | [/dashboard/academics/assessment/marksheet](http://localhost:3111/fr/dashboard/academics/assessment/marksheet) | `/[locale]/(dashboard)/dashboard/academics/assessment/marksheet` | `MarksheetPage` | ✅ **DONE** |
| 4 | [/dashboard/academics/assessment/online-exams](http://localhost:3111/fr/dashboard/academics/assessment/online-exams) | `/[locale]/(dashboard)/dashboard/academics/assessment/online-exams` | `Page` | ✅ **DONE** |
| 5 | [/dashboard/academics/evaluations](http://localhost:3111/fr/dashboard/academics/evaluations) | `/[locale]/(dashboard)/dashboard/academics/evaluations` | `EvaluationsPage` | ✅ **DONE** |
| 6 | [/dashboard/academics/exams](http://localhost:3111/fr/dashboard/academics/exams) | `/[locale]/(dashboard)/dashboard/academics/exams` | `ExamPlanningPage` | ✅ **DONE** |
| 7 | [/dashboard/academics/grades/entry](http://localhost:3111/fr/dashboard/academics/grades/entry) | `/[locale]/(dashboard)/dashboard/academics/grades/entry` | `GradeEntryPage` | ✅ **DONE** |
| 8 | [/dashboard/academics/grading/policies](http://localhost:3111/fr/dashboard/academics/grading/policies) | `/[locale]/(dashboard)/dashboard/academics/grading/policies` | `AssessmentPoliciesPage` | ✅ **DONE** |
| 9 | [/dashboard/academics/question-bank](http://localhost:3111/fr/dashboard/academics/question-bank) | `/[locale]/(dashboard)/dashboard/academics/question-bank` | `QuestionBankPage` | ✅ **DONE** |
| 10 | [/dashboard/academics/results](http://localhost:3111/fr/dashboard/academics/results) | `/[locale]/(dashboard)/dashboard/academics/results` | `ClassResultsPage` | ✅ **DONE** |
| 11 | [/dashboard/homework](http://localhost:3111/fr/dashboard/homework) | `/[locale]/(dashboard)/dashboard/homework` | `HomeworkPage` | ✅ **DONE** |
| 12 | [/dashboard/homework/submissions](http://localhost:3111/fr/dashboard/homework/submissions) | `/[locale]/(dashboard)/dashboard/homework/submissions` | `HomeworkSubmissionsPage` | ✅ **DONE** |

---

## 10. Virtual Classrooms & Live E-Learning

**Target User Role**: Teacher & E-Learning Coordinator  
**Total Pages**: 4

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/dashboard/academics/live-class/new](http://localhost:3111/fr/dashboard/academics/live-class/new) | `/[locale]/(dashboard)/dashboard/academics/live-class/new` | `LiveClassCreatePage` | ✅ **DONE** |
| 2 | [/dashboard/academics/live-class](http://localhost:3111/fr/dashboard/academics/live-class) | `/[locale]/(dashboard)/dashboard/academics/live-class` | `LiveClassesManagementPage` | ✅ **DONE** |
| 3 | [/dashboard/academics/live-class/[id]](http://localhost:3111/fr/dashboard/academics/live-class/[id]) | `/[locale]/(dashboard)/dashboard/academics/live-class/[id]` | `LiveClassDetailPage` | ✅ **DONE** |
| 4 | [/dashboard/academics/live-class-reports](http://localhost:3111/fr/dashboard/academics/live-class-reports) | `/[locale]/(dashboard)/dashboard/academics/live-class-reports` | `LiveClassReportsPage` | ✅ **DONE** |

---

## 11. Attendance & QR Timekeeping

**Target User Role**: Prefect of Studies / Attendance Staff  
**Total Pages**: 8

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/dashboard/attendance/audit](http://localhost:3111/fr/dashboard/attendance/audit) | `/[locale]/(dashboard)/dashboard/attendance/audit` | `AttendanceAuditPage` | ✅ **DONE** |
| 2 | [/dashboard/attendance/badges](http://localhost:3111/fr/dashboard/attendance/badges) | `/[locale]/(dashboard)/dashboard/attendance/badges` | `BadgesPage` | ✅ **DONE** |
| 3 | [/dashboard/attendance/excuses](http://localhost:3111/fr/dashboard/attendance/excuses) | `/[locale]/(dashboard)/dashboard/attendance/excuses` | `AttendanceExcusesPage` | ✅ **DONE** |
| 4 | [/dashboard/attendance/flags](http://localhost:3111/fr/dashboard/attendance/flags) | `/[locale]/(dashboard)/dashboard/attendance/flags` | `AttendanceFlagsPage` | ✅ **DONE** |
| 5 | [/dashboard/attendance/flags/[id]](http://localhost:3111/fr/dashboard/attendance/flags/[id]) | `/[locale]/(dashboard)/dashboard/attendance/flags/[id]` | `AttendanceFlagDetailPage` | ✅ **DONE** |
| 6 | [/dashboard/attendance](http://localhost:3111/fr/dashboard/attendance) | `/[locale]/(dashboard)/dashboard/attendance` | `AttendancePage` | ✅ **DONE** |
| 7 | [/dashboard/attendance/qr-reports](http://localhost:3111/fr/dashboard/attendance/qr-reports) | `/[locale]/(dashboard)/dashboard/attendance/qr-reports` | `QrReportsPage` | ✅ **DONE** |
| 8 | [/dashboard/attendance/scanner](http://localhost:3111/fr/dashboard/attendance/scanner) | `/[locale]/(dashboard)/dashboard/attendance/scanner` | `Page` | ✅ **DONE** |

---

## 12. Teacher Workspace & Portal

**Target User Role**: Teacher / Faculty  
**Total Pages**: 1

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/dashboard/teacher](http://localhost:3111/fr/dashboard/teacher) | `/[locale]/(dashboard)/dashboard/teacher` | `TeacherPortalPage` | ✅ **DONE** |

---

## 13. Student Portal & E-Learning

**Target User Role**: Student (Élève)  
**Total Pages**: 2

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/dashboard/student/live-classes](http://localhost:3111/fr/dashboard/student/live-classes) | `/[locale]/(dashboard)/dashboard/student/live-classes` | `StudentLiveClassesPage` | ✅ **DONE** |
| 2 | [/dashboard/student](http://localhost:3111/fr/dashboard/student) | `/[locale]/(dashboard)/dashboard/student` | `StudentPortalPage` | ✅ **DONE** |

---

## 14. Parent Portal & Family Hub

**Target User Role**: Parent / Guardian  
**Total Pages**: 7

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/dashboard/parent/attendance](http://localhost:3111/fr/dashboard/parent/attendance) | `/[locale]/(dashboard)/dashboard/parent/attendance` | `ParentAttendancePage` | ✅ **DONE** |
| 2 | [/dashboard/parent/communication](http://localhost:3111/fr/dashboard/parent/communication) | `/[locale]/(dashboard)/dashboard/parent/communication` | `ParentCommunicationPage` | ✅ **DONE** |
| 3 | [/dashboard/parent/finance](http://localhost:3111/fr/dashboard/parent/finance) | `/[locale]/(dashboard)/dashboard/parent/finance` | `ParentFinancePage` | ✅ **DONE** |
| 4 | [/dashboard/parent/live-classes](http://localhost:3111/fr/dashboard/parent/live-classes) | `/[locale]/(dashboard)/dashboard/parent/live-classes` | `ParentLiveClassesPage` | ✅ **DONE** |
| 5 | [/dashboard/parent](http://localhost:3111/fr/dashboard/parent) | `/[locale]/(dashboard)/dashboard/parent` | `ParentPortalPage` | ✅ **DONE** |
| 6 | [/dashboard/parent/requests](http://localhost:3111/fr/dashboard/parent/requests) | `/[locale]/(dashboard)/dashboard/parent/requests` | `ParentRequestsPage` | ✅ **DONE** |
| 7 | [/dashboard/parent/settings](http://localhost:3111/fr/dashboard/parent/settings) | `/[locale]/(dashboard)/dashboard/parent/settings` | `ParentSettingsPage` | ✅ **DONE** |

---

## 15. Finance, Tuition & General Ledger

**Target User Role**: Accountant / Financial Controller  
**Total Pages**: 38

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/dashboard/accountant](http://localhost:3111/fr/dashboard/accountant) | `/[locale]/(dashboard)/dashboard/accountant` | `AccountantPortalPage` | ✅ **DONE** |
| 2 | [/dashboard/finance/accounting/accounts](http://localhost:3111/fr/dashboard/finance/accounting/accounts) | `/[locale]/(dashboard)/dashboard/finance/accounting/accounts` | `Page` | ✅ **DONE** |
| 3 | [/dashboard/finance/accounting/deposits/new](http://localhost:3111/fr/dashboard/finance/accounting/deposits/new) | `/[locale]/(dashboard)/dashboard/finance/accounting/deposits/new` | `Page` | ✅ **DONE** |
| 4 | [/dashboard/finance/accounting/expenses](http://localhost:3111/fr/dashboard/finance/accounting/expenses) | `/[locale]/(dashboard)/dashboard/finance/accounting/expenses` | `Page` | ✅ **DONE** |
| 5 | [/dashboard/finance/accounting/periods](http://localhost:3111/fr/dashboard/finance/accounting/periods) | `/[locale]/(dashboard)/dashboard/finance/accounting/periods` | `Page` | ✅ **DONE** |
| 6 | [/dashboard/finance/accounting/statements](http://localhost:3111/fr/dashboard/finance/accounting/statements) | `/[locale]/(dashboard)/dashboard/finance/accounting/statements` | `Page` | ✅ **DONE** |
| 7 | [/dashboard/finance/accounting/student-accounting](http://localhost:3111/fr/dashboard/finance/accounting/student-accounting) | `/[locale]/(dashboard)/dashboard/finance/accounting/student-accounting` | `Page` | ✅ **DONE** |
| 8 | [/dashboard/finance/accounting/transactions](http://localhost:3111/fr/dashboard/finance/accounting/transactions) | `/[locale]/(dashboard)/dashboard/finance/accounting/transactions` | `Page` | ✅ **DONE** |
| 9 | [/dashboard/finance/accounting/voucher-types](http://localhost:3111/fr/dashboard/finance/accounting/voucher-types) | `/[locale]/(dashboard)/dashboard/finance/accounting/voucher-types` | `Page` | ✅ **DONE** |
| 10 | [/dashboard/finance/allocation](http://localhost:3111/fr/dashboard/finance/allocation) | `/[locale]/(dashboard)/dashboard/finance/allocation` | `Page` | ✅ **DONE** |
| 11 | [/dashboard/finance/allocations](http://localhost:3111/fr/dashboard/finance/allocations) | `/[locale]/(dashboard)/dashboard/finance/allocations` | `FeeAllocationsPage` | ✅ **DONE** |
| 12 | [/dashboard/finance/approvals](http://localhost:3111/fr/dashboard/finance/approvals) | `/[locale]/(dashboard)/dashboard/finance/approvals` | `Page` | ✅ **DONE** |
| 13 | [/dashboard/finance/bank-reconciliation](http://localhost:3111/fr/dashboard/finance/bank-reconciliation) | `/[locale]/(dashboard)/dashboard/finance/bank-reconciliation` | `Page` | ✅ **DONE** |
| 14 | [/dashboard/finance/cashier-sessions](http://localhost:3111/fr/dashboard/finance/cashier-sessions) | `/[locale]/(dashboard)/dashboard/finance/cashier-sessions` | `CashierSessionsPage` | ✅ **DONE** |
| 15 | [/dashboard/finance/chart-of-accounts](http://localhost:3111/fr/dashboard/finance/chart-of-accounts) | `/[locale]/(dashboard)/dashboard/finance/chart-of-accounts` | `Page` | ✅ **DONE** |
| 16 | [/dashboard/finance/collection-desk](http://localhost:3111/fr/dashboard/finance/collection-desk) | `/[locale]/(dashboard)/dashboard/finance/collection-desk` | `Page` | ✅ **DONE** |
| 17 | [/dashboard/finance/credit-notes](http://localhost:3111/fr/dashboard/finance/credit-notes) | `/[locale]/(dashboard)/dashboard/finance/credit-notes` | `CreditNotesPage` | ✅ **DONE** |
| 18 | [/dashboard/finance/expenses/new](http://localhost:3111/fr/dashboard/finance/expenses/new) | `/[locale]/(dashboard)/dashboard/finance/expenses/new` | `Page` | ✅ **DONE** |
| 19 | [/dashboard/finance/expenses](http://localhost:3111/fr/dashboard/finance/expenses) | `/[locale]/(dashboard)/dashboard/finance/expenses` | `ExpensesPage` | ✅ **DONE** |
| 20 | [/dashboard/finance/fee-assignments](http://localhost:3111/fr/dashboard/finance/fee-assignments) | `/[locale]/(dashboard)/dashboard/finance/fee-assignments` | `FeeAssignmentsPage` | ✅ **DONE** |
| 21 | [/dashboard/finance/fee-structures](http://localhost:3111/fr/dashboard/finance/fee-structures) | `/[locale]/(dashboard)/dashboard/finance/fee-structures` | `FeeStructuresPage` | ✅ **DONE** |
| 22 | [/dashboard/finance/fee-types](http://localhost:3111/fr/dashboard/finance/fee-types) | `/[locale]/(dashboard)/dashboard/finance/fee-types` | `FeeTypesPage` | ✅ **DONE** |
| 23 | [/dashboard/finance/fine-policies](http://localhost:3111/fr/dashboard/finance/fine-policies) | `/[locale]/(dashboard)/dashboard/finance/fine-policies` | `FinePoliciesPage` | ✅ **DONE** |
| 24 | [/dashboard/finance/invoices](http://localhost:3111/fr/dashboard/finance/invoices) | `/[locale]/(dashboard)/dashboard/finance/invoices` | `InvoicesPage` | ✅ **DONE** |
| 25 | [/dashboard/finance/invoices/[id]](http://localhost:3111/fr/dashboard/finance/invoices/[id]) | `/[locale]/(dashboard)/dashboard/finance/invoices/[id]` | `InvoiceDetailPage` | ✅ **DONE** |
| 26 | [/dashboard/finance/journal](http://localhost:3111/fr/dashboard/finance/journal) | `/[locale]/(dashboard)/dashboard/finance/journal` | `Page` | ✅ **DONE** |
| 27 | [/dashboard/finance/office-accounting](http://localhost:3111/fr/dashboard/finance/office-accounting) | `/[locale]/(dashboard)/dashboard/finance/office-accounting` | `Page` | ✅ **DONE** |
| 28 | [/dashboard/finance/online-payments](http://localhost:3111/fr/dashboard/finance/online-payments) | `/[locale]/(dashboard)/dashboard/finance/online-payments` | `Page` | ✅ **DONE** |
| 29 | [/dashboard/finance](http://localhost:3111/fr/dashboard/finance) | `/[locale]/(dashboard)/dashboard/finance` | `Page` | ✅ **DONE** |
| 30 | [/dashboard/finance/payments/new](http://localhost:3111/fr/dashboard/finance/payments/new) | `/[locale]/(dashboard)/dashboard/finance/payments/new` | `PaymentEntryPage` | ✅ **DONE** |
| 31 | [/dashboard/finance/payments](http://localhost:3111/fr/dashboard/finance/payments) | `/[locale]/(dashboard)/dashboard/finance/payments` | `PaymentEntryPage` | ✅ **DONE** |
| 32 | [/dashboard/finance/receipts](http://localhost:3111/fr/dashboard/finance/receipts) | `/[locale]/(dashboard)/dashboard/finance/receipts` | `ReceiptsPage` | ✅ **DONE** |
| 33 | [/dashboard/finance/receivables](http://localhost:3111/fr/dashboard/finance/receivables) | `/[locale]/(dashboard)/dashboard/finance/receivables` | `Page` | ✅ **DONE** |
| 34 | [/dashboard/finance/reconciliation](http://localhost:3111/fr/dashboard/finance/reconciliation) | `/[locale]/(dashboard)/dashboard/finance/reconciliation` | `ReconciliationPage` | ✅ **DONE** |
| 35 | [/dashboard/finance/refunds](http://localhost:3111/fr/dashboard/finance/refunds) | `/[locale]/(dashboard)/dashboard/finance/refunds` | `RefundsPage` | ✅ **DONE** |
| 36 | [/dashboard/finance/reminders](http://localhost:3111/fr/dashboard/finance/reminders) | `/[locale]/(dashboard)/dashboard/finance/reminders` | `RemindersPage` | ✅ **DONE** |
| 37 | [/dashboard/finance/reports](http://localhost:3111/fr/dashboard/finance/reports) | `/[locale]/(dashboard)/dashboard/finance/reports` | `Page` | ✅ **DONE** |
| 38 | [/dashboard/finance/statements](http://localhost:3111/fr/dashboard/finance/statements) | `/[locale]/(dashboard)/dashboard/finance/statements` | `StatementsPage` | ✅ **DONE** |

---

## 16. Human Resources & Monthly Payroll

**Target User Role**: HR & Payroll Director  
**Total Pages**: 29

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/dashboard/hr/access](http://localhost:3111/fr/dashboard/hr/access) | `/[locale]/(dashboard)/dashboard/hr/access` | `HrAccessPage` | ✅ **DONE** |
| 2 | [/dashboard/hr/advances](http://localhost:3111/fr/dashboard/hr/advances) | `/[locale]/(dashboard)/dashboard/hr/advances` | `HrAdvancesPage` | ✅ **DONE** |
| 3 | [/dashboard/hr/awards](http://localhost:3111/fr/dashboard/hr/awards) | `/[locale]/(dashboard)/dashboard/hr/awards` | `AwardsRecognitionPage` | ✅ **DONE** |
| 4 | [/dashboard/hr/departments](http://localhost:3111/fr/dashboard/hr/departments) | `/[locale]/(dashboard)/dashboard/hr/departments` | `HrDepartmentsPage` | ✅ **DONE** |
| 5 | [/dashboard/hr/designations](http://localhost:3111/fr/dashboard/hr/designations) | `/[locale]/(dashboard)/dashboard/hr/designations` | `HrDesignationsPage` | ✅ **DONE** |
| 6 | [/dashboard/hr/employees/new](http://localhost:3111/fr/dashboard/hr/employees/new) | `/[locale]/(dashboard)/dashboard/hr/employees/new` | `HrEmployeeNewPage` | ✅ **DONE** |
| 7 | [/dashboard/hr/employees](http://localhost:3111/fr/dashboard/hr/employees) | `/[locale]/(dashboard)/dashboard/hr/employees` | `HrEmployeesPage` | ✅ **DONE** |
| 8 | [/dashboard/hr/employees/[id]](http://localhost:3111/fr/dashboard/hr/employees/[id]) | `/[locale]/(dashboard)/dashboard/hr/employees/[id]` | `HrEmployeeProfilePage` | ✅ **DONE** |
| 9 | [/dashboard/hr/leave](http://localhost:3111/fr/dashboard/hr/leave) | `/[locale]/(dashboard)/dashboard/hr/leave` | `HrLeavePage` | ✅ **DONE** |
| 10 | [/dashboard/hr/leave-management](http://localhost:3111/fr/dashboard/hr/leave-management) | `/[locale]/(dashboard)/dashboard/hr/leave-management` | `LeaveManagementPage` | ✅ **DONE** |
| 11 | [/dashboard/hr/overview](http://localhost:3111/fr/dashboard/hr/overview) | `/[locale]/(dashboard)/dashboard/hr/overview` | `HrOverviewPage` | ✅ **DONE** |
| 12 | [/dashboard/hr](http://localhost:3111/fr/dashboard/hr) | `/[locale]/(dashboard)/dashboard/hr` | `HrPortalPage` | ✅ **DONE** |
| 13 | [/dashboard/hr/salary-advances](http://localhost:3111/fr/dashboard/hr/salary-advances) | `/[locale]/(dashboard)/dashboard/hr/salary-advances` | `SalaryAdvancesPage` | ✅ **DONE** |
| 14 | [/dashboard/hr/self-service](http://localhost:3111/fr/dashboard/hr/self-service) | `/[locale]/(dashboard)/dashboard/hr/self-service` | `HrSelfServicePage` | ✅ **DONE** |
| 15 | [/dashboard/workforce/advances](http://localhost:3111/fr/dashboard/workforce/advances) | `/[locale]/(dashboard)/dashboard/workforce/advances` | `WorkforceSalaryAdvancesPage` | ✅ **DONE** |
| 16 | [/dashboard/workforce/awards](http://localhost:3111/fr/dashboard/workforce/awards) | `/[locale]/(dashboard)/dashboard/workforce/awards` | `WorkforceAwardsPage` | ✅ **DONE** |
| 17 | [/dashboard/workforce/leave](http://localhost:3111/fr/dashboard/workforce/leave) | `/[locale]/(dashboard)/dashboard/workforce/leave` | `WorkforceLeavePage` | ✅ **DONE** |
| 18 | [/dashboard/workforce](http://localhost:3111/fr/dashboard/workforce) | `/[locale]/(dashboard)/dashboard/workforce` | `Page` | ✅ **DONE** |
| 19 | [/dashboard/workforce/payroll/adjustments](http://localhost:3111/fr/dashboard/workforce/payroll/adjustments) | `/[locale]/(dashboard)/dashboard/workforce/payroll/adjustments` | `Page` | ✅ **DONE** |
| 20 | [/dashboard/workforce/payroll/assignments](http://localhost:3111/fr/dashboard/workforce/payroll/assignments) | `/[locale]/(dashboard)/dashboard/workforce/payroll/assignments` | `Page` | ✅ **DONE** |
| 21 | [/dashboard/workforce/payroll/components](http://localhost:3111/fr/dashboard/workforce/payroll/components) | `/[locale]/(dashboard)/dashboard/workforce/payroll/components` | `Page` | ✅ **DONE** |
| 22 | [/dashboard/workforce/payroll/payments](http://localhost:3111/fr/dashboard/workforce/payroll/payments) | `/[locale]/(dashboard)/dashboard/workforce/payroll/payments` | `Page` | ✅ **DONE** |
| 23 | [/dashboard/workforce/payroll/payslips](http://localhost:3111/fr/dashboard/workforce/payroll/payslips) | `/[locale]/(dashboard)/dashboard/workforce/payroll/payslips` | `Page` | ✅ **DONE** |
| 24 | [/dashboard/workforce/payroll/regulations](http://localhost:3111/fr/dashboard/workforce/payroll/regulations) | `/[locale]/(dashboard)/dashboard/workforce/payroll/regulations` | `Page` | ✅ **DONE** |
| 25 | [/dashboard/workforce/payroll/runs](http://localhost:3111/fr/dashboard/workforce/payroll/runs) | `/[locale]/(dashboard)/dashboard/workforce/payroll/runs` | `Page` | ✅ **DONE** |
| 26 | [/dashboard/workforce/payroll/runs/[id]](http://localhost:3111/fr/dashboard/workforce/payroll/runs/[id]) | `/[locale]/(dashboard)/dashboard/workforce/payroll/runs/[id]` | `Page` | ✅ **DONE** |
| 27 | [/dashboard/workforce/payroll/settings](http://localhost:3111/fr/dashboard/workforce/payroll/settings) | `/[locale]/(dashboard)/dashboard/workforce/payroll/settings` | `Page` | ✅ **DONE** |
| 28 | [/dashboard/workforce/payroll/structures](http://localhost:3111/fr/dashboard/workforce/payroll/structures) | `/[locale]/(dashboard)/dashboard/workforce/payroll/structures` | `Page` | ✅ **DONE** |
| 29 | [/dashboard/workforce/timeclock](http://localhost:3111/fr/dashboard/workforce/timeclock) | `/[locale]/(dashboard)/dashboard/workforce/timeclock` | `TimeClockPage` | ✅ **DONE** |

---

## 17. School Library & Media Center

**Target User Role**: Librarian / Media Specialist  
**Total Pages**: 16

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/dashboard/library/catalog](http://localhost:3111/fr/dashboard/library/catalog) | `/[locale]/(dashboard)/dashboard/library/catalog` | `LibraryCatalogPage` | ✅ **DONE** |
| 2 | [/dashboard/library/catalog/[id]](http://localhost:3111/fr/dashboard/library/catalog/[id]) | `/[locale]/(dashboard)/dashboard/library/catalog/[id]` | `LibraryCatalogDetailPage` | ✅ **DONE** |
| 3 | [/dashboard/library/categories](http://localhost:3111/fr/dashboard/library/categories) | `/[locale]/(dashboard)/dashboard/library/categories` | `LibraryTaxonomyPage` | ✅ **DONE** |
| 4 | [/dashboard/library/me](http://localhost:3111/fr/dashboard/library/me) | `/[locale]/(dashboard)/dashboard/library/me` | `LibrarySelfServicePage` | ✅ **DONE** |
| 5 | [/dashboard/library](http://localhost:3111/fr/dashboard/library) | `/[locale]/(dashboard)/dashboard/library` | `LibraryPage` | ✅ **DONE** |
| 6 | [/dashboard/portals/librarian/charges](http://localhost:3111/fr/dashboard/portals/librarian/charges) | `/[locale]/(dashboard)/dashboard/portals/librarian/charges` | `LibrarianChargesPage` | ✅ **DONE** |
| 7 | [/dashboard/portals/librarian/copies](http://localhost:3111/fr/dashboard/portals/librarian/copies) | `/[locale]/(dashboard)/dashboard/portals/librarian/copies` | `LibrarianCopiesPage` | ✅ **DONE** |
| 8 | [/dashboard/portals/librarian/desk](http://localhost:3111/fr/dashboard/portals/librarian/desk) | `/[locale]/(dashboard)/dashboard/portals/librarian/desk` | `LibrarianDeskPage` | ✅ **DONE** |
| 9 | [/dashboard/portals/librarian/holds](http://localhost:3111/fr/dashboard/portals/librarian/holds) | `/[locale]/(dashboard)/dashboard/portals/librarian/holds` | `LibrarianHoldsPage` | ✅ **DONE** |
| 10 | [/dashboard/portals/librarian/members](http://localhost:3111/fr/dashboard/portals/librarian/members) | `/[locale]/(dashboard)/dashboard/portals/librarian/members` | `LibrarianMembersPage` | ✅ **DONE** |
| 11 | [/dashboard/portals/librarian/members/[id]](http://localhost:3111/fr/dashboard/portals/librarian/members/[id]) | `/[locale]/(dashboard)/dashboard/portals/librarian/members/[id]` | `LibrarianMemberDetailPage` | ✅ **DONE** |
| 12 | [/dashboard/portals/librarian](http://localhost:3111/fr/dashboard/portals/librarian) | `/[locale]/(dashboard)/dashboard/portals/librarian` | `LibrarianPortalPage` | ✅ **DONE** |
| 13 | [/dashboard/portals/librarian/policies](http://localhost:3111/fr/dashboard/portals/librarian/policies) | `/[locale]/(dashboard)/dashboard/portals/librarian/policies` | `LibrarianPoliciesPage` | ✅ **DONE** |
| 14 | [/dashboard/portals/librarian/reports](http://localhost:3111/fr/dashboard/portals/librarian/reports) | `/[locale]/(dashboard)/dashboard/portals/librarian/reports` | `LibrarianReportsPage` | ✅ **DONE** |
| 15 | [/dashboard/portals/librarian/stocktake](http://localhost:3111/fr/dashboard/portals/librarian/stocktake) | `/[locale]/(dashboard)/dashboard/portals/librarian/stocktake` | `LibrarianStocktakePage` | ✅ **DONE** |
| 16 | [/dashboard/portals/librarian/transfers](http://localhost:3111/fr/dashboard/portals/librarian/transfers) | `/[locale]/(dashboard)/dashboard/portals/librarian/transfers` | `LibrarianTransfersPage` | ✅ **DONE** |

---

## 18. School Transport & Fleet Logistics

**Target User Role**: Transport & Fleet Coordinator  
**Total Pages**: 13

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/dashboard/transport/allocations](http://localhost:3111/fr/dashboard/transport/allocations) | `/[locale]/(dashboard)/dashboard/transport/allocations` | `Page` | ✅ **DONE** |
| 2 | [/dashboard/transport/boarding](http://localhost:3111/fr/dashboard/transport/boarding) | `/[locale]/(dashboard)/dashboard/transport/boarding` | `Page` | ✅ **DONE** |
| 3 | [/dashboard/transport/drivers](http://localhost:3111/fr/dashboard/transport/drivers) | `/[locale]/(dashboard)/dashboard/transport/drivers` | `Page` | ✅ **DONE** |
| 4 | [/dashboard/transport/guardian](http://localhost:3111/fr/dashboard/transport/guardian) | `/[locale]/(dashboard)/dashboard/transport/guardian` | `Page` | ✅ **DONE** |
| 5 | [/dashboard/transport/incidents](http://localhost:3111/fr/dashboard/transport/incidents) | `/[locale]/(dashboard)/dashboard/transport/incidents` | `Page` | ✅ **DONE** |
| 6 | [/dashboard/transport](http://localhost:3111/fr/dashboard/transport) | `/[locale]/(dashboard)/dashboard/transport` | `TransportOverviewPage` | ✅ **DONE** |
| 7 | [/dashboard/transport/policies](http://localhost:3111/fr/dashboard/transport/policies) | `/[locale]/(dashboard)/dashboard/transport/policies` | `Page` | ✅ **DONE** |
| 8 | [/dashboard/transport/reports](http://localhost:3111/fr/dashboard/transport/reports) | `/[locale]/(dashboard)/dashboard/transport/reports` | `Page` | ✅ **DONE** |
| 9 | [/dashboard/transport/routes](http://localhost:3111/fr/dashboard/transport/routes) | `/[locale]/(dashboard)/dashboard/transport/routes` | `Page` | ✅ **DONE** |
| 10 | [/dashboard/transport/stops](http://localhost:3111/fr/dashboard/transport/stops) | `/[locale]/(dashboard)/dashboard/transport/stops` | `Page` | ✅ **DONE** |
| 11 | [/dashboard/transport/student](http://localhost:3111/fr/dashboard/transport/student) | `/[locale]/(dashboard)/dashboard/transport/student` | `Page` | ✅ **DONE** |
| 12 | [/dashboard/transport/trips](http://localhost:3111/fr/dashboard/transport/trips) | `/[locale]/(dashboard)/dashboard/transport/trips` | `Page` | ✅ **DONE** |
| 13 | [/dashboard/transport/vehicles](http://localhost:3111/fr/dashboard/transport/vehicles) | `/[locale]/(dashboard)/dashboard/transport/vehicles` | `Page` | ✅ **DONE** |

---

## 19. Inventory, Assets & Procurement

**Target User Role**: Storekeeper & Inventory Manager  
**Total Pages**: 13

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/dashboard/inventory/adjustments](http://localhost:3111/fr/dashboard/inventory/adjustments) | `/[locale]/(dashboard)/dashboard/inventory/adjustments` | `InventoryAdjustmentsPage` | ✅ **DONE** |
| 2 | [/dashboard/inventory/categories](http://localhost:3111/fr/dashboard/inventory/categories) | `/[locale]/(dashboard)/dashboard/inventory/categories` | `InventoryCategoriesPage` | ✅ **DONE** |
| 3 | [/dashboard/inventory/issues](http://localhost:3111/fr/dashboard/inventory/issues) | `/[locale]/(dashboard)/dashboard/inventory/issues` | `InventoryIssuesPage` | ✅ **DONE** |
| 4 | [/dashboard/inventory/overview](http://localhost:3111/fr/dashboard/inventory/overview) | `/[locale]/(dashboard)/dashboard/inventory/overview` | `InventoryOverviewPage` | ✅ **DONE** |
| 5 | [/dashboard/inventory](http://localhost:3111/fr/dashboard/inventory) | `/[locale]/(dashboard)/dashboard/inventory` | `InventoryRootPage` | ✅ **DONE** |
| 6 | [/dashboard/inventory/products](http://localhost:3111/fr/dashboard/inventory/products) | `/[locale]/(dashboard)/dashboard/inventory/products` | `InventoryProductsPage` | ✅ **DONE** |
| 7 | [/dashboard/inventory/purchases](http://localhost:3111/fr/dashboard/inventory/purchases) | `/[locale]/(dashboard)/dashboard/inventory/purchases` | `InventoryPurchasesPage` | ✅ **DONE** |
| 8 | [/dashboard/inventory/sales](http://localhost:3111/fr/dashboard/inventory/sales) | `/[locale]/(dashboard)/dashboard/inventory/sales` | `InventorySalesPage` | ✅ **DONE** |
| 9 | [/dashboard/inventory/stock](http://localhost:3111/fr/dashboard/inventory/stock) | `/[locale]/(dashboard)/dashboard/inventory/stock` | `InventoryStockPage` | ✅ **DONE** |
| 10 | [/dashboard/inventory/stores](http://localhost:3111/fr/dashboard/inventory/stores) | `/[locale]/(dashboard)/dashboard/inventory/stores` | `InventoryStoresPage` | ✅ **DONE** |
| 11 | [/dashboard/inventory/suppliers](http://localhost:3111/fr/dashboard/inventory/suppliers) | `/[locale]/(dashboard)/dashboard/inventory/suppliers` | `InventorySuppliersPage` | ✅ **DONE** |
| 12 | [/dashboard/inventory/transfers](http://localhost:3111/fr/dashboard/inventory/transfers) | `/[locale]/(dashboard)/dashboard/inventory/transfers` | `InventoryTransfersPage` | ✅ **DONE** |
| 13 | [/dashboard/inventory/units](http://localhost:3111/fr/dashboard/inventory/units) | `/[locale]/(dashboard)/dashboard/inventory/units` | `InventoryUnitsPage` | ✅ **DONE** |

---

## 20. Boarding & Dormitory (Internat)

**Target User Role**: Hostel Warden (Internat)  
**Total Pages**: 16

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/dashboard/hostel/allocations](http://localhost:3111/fr/dashboard/hostel/allocations) | `/[locale]/(dashboard)/dashboard/hostel/allocations` | `HostelAllocationsPage` | ✅ **DONE** |
| 2 | [/dashboard/hostel/allocations/[id]](http://localhost:3111/fr/dashboard/hostel/allocations/[id]) | `/[locale]/(dashboard)/dashboard/hostel/allocations/[id]` | `AllocationDetailPage` | ✅ **DONE** |
| 3 | [/dashboard/hostel/applications](http://localhost:3111/fr/dashboard/hostel/applications) | `/[locale]/(dashboard)/dashboard/hostel/applications` | `HostelApplicationsPage` | ✅ **DONE** |
| 4 | [/dashboard/hostel/board](http://localhost:3111/fr/dashboard/hostel/board) | `/[locale]/(dashboard)/dashboard/hostel/board` | `BedBoardPage` | ✅ **DONE** |
| 5 | [/dashboard/hostel/categories](http://localhost:3111/fr/dashboard/hostel/categories) | `/[locale]/(dashboard)/dashboard/hostel/categories` | `CategoriesPage` | ✅ **DONE** |
| 6 | [/dashboard/hostel/guardian](http://localhost:3111/fr/dashboard/hostel/guardian) | `/[locale]/(dashboard)/dashboard/hostel/guardian` | `GuardianMePage` | ✅ **DONE** |
| 7 | [/dashboard/hostel/hostels](http://localhost:3111/fr/dashboard/hostel/hostels) | `/[locale]/(dashboard)/dashboard/hostel/hostels` | `HostelsPage` | ✅ **DONE** |
| 8 | [/dashboard/hostel/hostels/[id]](http://localhost:3111/fr/dashboard/hostel/hostels/[id]) | `/[locale]/(dashboard)/dashboard/hostel/hostels/[id]` | `HostelDetailPage` | ✅ **DONE** |
| 9 | [/dashboard/hostel/leave-passes](http://localhost:3111/fr/dashboard/hostel/leave-passes) | `/[locale]/(dashboard)/dashboard/hostel/leave-passes` | `LeavePassesPage` | ✅ **DONE** |
| 10 | [/dashboard/hostel/me](http://localhost:3111/fr/dashboard/hostel/me) | `/[locale]/(dashboard)/dashboard/hostel/me` | `ResidentMePage` | ✅ **DONE** |
| 11 | [/dashboard/hostel](http://localhost:3111/fr/dashboard/hostel) | `/[locale]/(dashboard)/dashboard/hostel` | `HostelDashboardPage` | ✅ **DONE** |
| 12 | [/dashboard/hostel/policies](http://localhost:3111/fr/dashboard/hostel/policies) | `/[locale]/(dashboard)/dashboard/hostel/policies` | `HostelPoliciesPage` | ✅ **DONE** |
| 13 | [/dashboard/hostel/reports](http://localhost:3111/fr/dashboard/hostel/reports) | `/[locale]/(dashboard)/dashboard/hostel/reports` | `HostelReportsPage` | ✅ **DONE** |
| 14 | [/dashboard/hostel/roll-call](http://localhost:3111/fr/dashboard/hostel/roll-call) | `/[locale]/(dashboard)/dashboard/hostel/roll-call` | `RollCallPage` | ✅ **DONE** |
| 15 | [/dashboard/hostel/rooms](http://localhost:3111/fr/dashboard/hostel/rooms) | `/[locale]/(dashboard)/dashboard/hostel/rooms` | `RoomsPage` | ✅ **DONE** |
| 16 | [/dashboard/hostel/zones](http://localhost:3111/fr/dashboard/hostel/zones) | `/[locale]/(dashboard)/dashboard/hostel/zones` | `ZonesPage` | ✅ **DONE** |

---

## 21. Front Desk & Visitor Management

**Target User Role**: Front Desk Receptionist  
**Total Pages**: 6

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/dashboard/receptionist/appointments](http://localhost:3111/fr/dashboard/receptionist/appointments) | `/[locale]/(dashboard)/dashboard/receptionist/appointments` | `ReceptionistAppointmentsPage` | ✅ **DONE** |
| 2 | [/dashboard/receptionist/handoffs](http://localhost:3111/fr/dashboard/receptionist/handoffs) | `/[locale]/(dashboard)/dashboard/receptionist/handoffs` | `ReceptionistHandoffsPage` | ✅ **DONE** |
| 3 | [/dashboard/receptionist/inquiries](http://localhost:3111/fr/dashboard/receptionist/inquiries) | `/[locale]/(dashboard)/dashboard/receptionist/inquiries` | `ReceptionistInquiriesPage` | ✅ **DONE** |
| 4 | [/dashboard/receptionist](http://localhost:3111/fr/dashboard/receptionist) | `/[locale]/(dashboard)/dashboard/receptionist` | `ReceptionistHomePage` | ✅ **DONE** |
| 5 | [/dashboard/receptionist/pickups](http://localhost:3111/fr/dashboard/receptionist/pickups) | `/[locale]/(dashboard)/dashboard/receptionist/pickups` | `ReceptionistPickupsPage` | ✅ **DONE** |
| 6 | [/dashboard/receptionist/visitors](http://localhost:3111/fr/dashboard/receptionist/visitors) | `/[locale]/(dashboard)/dashboard/receptionist/visitors` | `ReceptionistVisitorsPage` | ✅ **DONE** |

---

## 22. Campus Physical Security & Gate Control

**Target User Role**: Gate Security Officer / Guard  
**Total Pages**: 7

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/dashboard/portals/guard/config](http://localhost:3111/fr/dashboard/portals/guard/config) | `/[locale]/(dashboard)/dashboard/portals/guard/config` | `GuardConfigPage` | ✅ **DONE** |
| 2 | [/dashboard/portals/guard/emergency](http://localhost:3111/fr/dashboard/portals/guard/emergency) | `/[locale]/(dashboard)/dashboard/portals/guard/emergency` | `GuardEmergencyPage` | ✅ **DONE** |
| 3 | [/dashboard/portals/guard/incidents](http://localhost:3111/fr/dashboard/portals/guard/incidents) | `/[locale]/(dashboard)/dashboard/portals/guard/incidents` | `GuardIncidentsPage` | ✅ **DONE** |
| 4 | [/dashboard/portals/guard](http://localhost:3111/fr/dashboard/portals/guard) | `/[locale]/(dashboard)/dashboard/portals/guard` | `GuardPortalPage` | ✅ **DONE** |
| 5 | [/dashboard/portals/guard/pickups](http://localhost:3111/fr/dashboard/portals/guard/pickups) | `/[locale]/(dashboard)/dashboard/portals/guard/pickups` | `GuardPickupsPage` | ✅ **DONE** |
| 6 | [/dashboard/portals/guard/scanner](http://localhost:3111/fr/dashboard/portals/guard/scanner) | `/[locale]/(dashboard)/dashboard/portals/guard/scanner` | `GuardScannerPage` | ✅ **DONE** |
| 7 | [/dashboard/portals/guard/visitors](http://localhost:3111/fr/dashboard/portals/guard/visitors) | `/[locale]/(dashboard)/dashboard/portals/guard/visitors` | `GuardVisitorsPage` | ✅ **DONE** |

---

## 23. Student & Staff ID Cards

**Target User Role**: Identity & Cards Officer  
**Total Pages**: 8

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/dashboard/cards/admit-cards](http://localhost:3111/fr/dashboard/cards/admit-cards) | `/[locale]/(dashboard)/dashboard/cards/admit-cards` | `Page` | ✅ **DONE** |
| 2 | [/dashboard/cards/employees](http://localhost:3111/fr/dashboard/cards/employees) | `/[locale]/(dashboard)/dashboard/cards/employees` | `Page` | ✅ **DONE** |
| 3 | [/dashboard/cards/issued](http://localhost:3111/fr/dashboard/cards/issued) | `/[locale]/(dashboard)/dashboard/cards/issued` | `Page` | ✅ **DONE** |
| 4 | [/dashboard/cards/jobs](http://localhost:3111/fr/dashboard/cards/jobs) | `/[locale]/(dashboard)/dashboard/cards/jobs` | `Page` | ✅ **DONE** |
| 5 | [/dashboard/cards](http://localhost:3111/fr/dashboard/cards) | `/[locale]/(dashboard)/dashboard/cards` | `Page` | ✅ **DONE** |
| 6 | [/dashboard/cards/students](http://localhost:3111/fr/dashboard/cards/students) | `/[locale]/(dashboard)/dashboard/cards/students` | `Page` | ✅ **DONE** |
| 7 | [/dashboard/cards/templates](http://localhost:3111/fr/dashboard/cards/templates) | `/[locale]/(dashboard)/dashboard/cards/templates` | `Page` | ✅ **DONE** |
| 8 | [/dashboard/cards/templates/[id]/edit](http://localhost:3111/fr/dashboard/cards/templates/[id]/edit) | `/[locale]/(dashboard)/dashboard/cards/templates/[id]/edit` | `Page` | ✅ **DONE** |

---

## 24. Certificates, Diplomas & Attestations

**Target User Role**: Academic Secretariat & Registrar  
**Total Pages**: 12

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/dashboard/certificates/definitions](http://localhost:3111/fr/dashboard/certificates/definitions) | `/[locale]/(dashboard)/dashboard/certificates/definitions` | `Page` | ✅ **DONE** |
| 2 | [/dashboard/certificates/definitions/[id]](http://localhost:3111/fr/dashboard/certificates/definitions/[id]) | `/[locale]/(dashboard)/dashboard/certificates/definitions/[id]` | `Page` | ✅ **DONE** |
| 3 | [/dashboard/certificates/issue/employees](http://localhost:3111/fr/dashboard/certificates/issue/employees) | `/[locale]/(dashboard)/dashboard/certificates/issue/employees` | `Page` | ✅ **DONE** |
| 4 | [/dashboard/certificates/issue/students](http://localhost:3111/fr/dashboard/certificates/issue/students) | `/[locale]/(dashboard)/dashboard/certificates/issue/students` | `Page` | ✅ **DONE** |
| 5 | [/dashboard/certificates/issued](http://localhost:3111/fr/dashboard/certificates/issued) | `/[locale]/(dashboard)/dashboard/certificates/issued` | `Page` | ✅ **DONE** |
| 6 | [/dashboard/certificates/issued/[id]](http://localhost:3111/fr/dashboard/certificates/issued/[id]) | `/[locale]/(dashboard)/dashboard/certificates/issued/[id]` | `Page` | ✅ **DONE** |
| 7 | [/dashboard/certificates/jobs](http://localhost:3111/fr/dashboard/certificates/jobs) | `/[locale]/(dashboard)/dashboard/certificates/jobs` | `Page` | ✅ **DONE** |
| 8 | [/dashboard/certificates](http://localhost:3111/fr/dashboard/certificates) | `/[locale]/(dashboard)/dashboard/certificates` | `Page` | ✅ **DONE** |
| 9 | [/dashboard/certificates/requests](http://localhost:3111/fr/dashboard/certificates/requests) | `/[locale]/(dashboard)/dashboard/certificates/requests` | `Page` | ✅ **DONE** |
| 10 | [/dashboard/certificates/settings](http://localhost:3111/fr/dashboard/certificates/settings) | `/[locale]/(dashboard)/dashboard/certificates/settings` | `Page` | ✅ **DONE** |
| 11 | [/dashboard/certificates/templates](http://localhost:3111/fr/dashboard/certificates/templates) | `/[locale]/(dashboard)/dashboard/certificates/templates` | `Page` | ✅ **DONE** |
| 12 | [/dashboard/certificates/templates/[id]/edit](http://localhost:3111/fr/dashboard/certificates/templates/[id]/edit) | `/[locale]/(dashboard)/dashboard/certificates/templates/[id]/edit` | `Page` | ✅ **DONE** |

---

## 25. Official Institutional Document Generator

**Target User Role**: Administrative Secretary  
**Total Pages**: 1

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/dashboard/documents/generator](http://localhost:3111/fr/dashboard/documents/generator) | `/[locale]/(dashboard)/dashboard/documents/generator` | `ReportCardGeneratorPage` | ✅ **DONE** |

---

## 26. Pedagogical Content Library

**Target User Role**: Pedagogical Resource Coordinator  
**Total Pages**: 2

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/dashboard/content/library](http://localhost:3111/fr/dashboard/content/library) | `/[locale]/(dashboard)/dashboard/content/library` | `Page` | ✅ **DONE** |
| 2 | [/dashboard/content/types](http://localhost:3111/fr/dashboard/content/types) | `/[locale]/(dashboard)/dashboard/content/types` | `Page` | ✅ **DONE** |

---

## 27. School Calendar & Events

**Target User Role**: Events Coordinator & Staff  
**Total Pages**: 2

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/dashboard/events](http://localhost:3111/fr/dashboard/events) | `/[locale]/(dashboard)/dashboard/events` | `EventsCalendarPage` | ✅ **DONE** |
| 2 | [/dashboard/events/[id]](http://localhost:3111/fr/dashboard/events/[id]) | `/[locale]/(dashboard)/dashboard/events/[id]` | `EventDetailPage` | ✅ **DONE** |

---

## 28. Communication, SMS & Broadcast Campaigns

**Target User Role**: Communications Officer & Admin  
**Total Pages**: 21

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/dashboard/broadcast/automations](http://localhost:3111/fr/dashboard/broadcast/automations) | `/[locale]/(dashboard)/dashboard/broadcast/automations` | `BroadcastAutomationsPage` | ✅ **DONE** |
| 2 | [/dashboard/broadcast/campaigns](http://localhost:3111/fr/dashboard/broadcast/campaigns) | `/[locale]/(dashboard)/dashboard/broadcast/campaigns` | `BroadcastCampaignsPage` | ✅ **DONE** |
| 3 | [/dashboard/broadcast/campaigns/[id]](http://localhost:3111/fr/dashboard/broadcast/campaigns/[id]) | `/[locale]/(dashboard)/dashboard/broadcast/campaigns/[id]` | `BroadcastCampaignDetailPage` | ✅ **DONE** |
| 4 | [/dashboard/broadcast/connections](http://localhost:3111/fr/dashboard/broadcast/connections) | `/[locale]/(dashboard)/dashboard/broadcast/connections` | `BroadcastConnectionsPage` | ✅ **DONE** |
| 5 | [/dashboard/broadcast](http://localhost:3111/fr/dashboard/broadcast) | `/[locale]/(dashboard)/dashboard/broadcast` | `BroadcastPage` | ✅ **DONE** |
| 6 | [/dashboard/broadcast/reports](http://localhost:3111/fr/dashboard/broadcast/reports) | `/[locale]/(dashboard)/dashboard/broadcast/reports` | `BroadcastReportsPage` | ✅ **DONE** |
| 7 | [/dashboard/broadcast/segments](http://localhost:3111/fr/dashboard/broadcast/segments) | `/[locale]/(dashboard)/dashboard/broadcast/segments` | `BroadcastSegmentsPage` | ✅ **DONE** |
| 8 | [/dashboard/broadcast/templates](http://localhost:3111/fr/dashboard/broadcast/templates) | `/[locale]/(dashboard)/dashboard/broadcast/templates` | `BroadcastTemplatesPage` | ✅ **DONE** |
| 9 | [/dashboard/communication/broadcast](http://localhost:3111/fr/dashboard/communication/broadcast) | `/[locale]/(dashboard)/dashboard/communication/broadcast` | `BroadcastPage` | ✅ **DONE** |
| 10 | [/dashboard/communication/campaign-composer](http://localhost:3111/fr/dashboard/communication/campaign-composer) | `/[locale]/(dashboard)/dashboard/communication/campaign-composer` | `CampaignComposerPage` | ✅ **DONE** |
| 11 | [/dashboard/communication/crm](http://localhost:3111/fr/dashboard/communication/crm) | `/[locale]/(dashboard)/dashboard/communication/crm` | `CrmPage` | ✅ **DONE** |
| 12 | [/dashboard/communication/delivery-reports](http://localhost:3111/fr/dashboard/communication/delivery-reports) | `/[locale]/(dashboard)/dashboard/communication/delivery-reports` | `DeliveryReportsPage` | ✅ **DONE** |
| 13 | [/dashboard/communication/events](http://localhost:3111/fr/dashboard/communication/events) | `/[locale]/(dashboard)/dashboard/communication/events` | `OldEventsCalendarPage` | ✅ **DONE** |
| 14 | [/dashboard/communication/forms](http://localhost:3111/fr/dashboard/communication/forms) | `/[locale]/(dashboard)/dashboard/communication/forms` | `FormIntakePage` | ✅ **DONE** |
| 15 | [/dashboard/communication/leads](http://localhost:3111/fr/dashboard/communication/leads) | `/[locale]/(dashboard)/dashboard/communication/leads` | `LeadPipelinePage` | ✅ **DONE** |
| 16 | [/dashboard/communication/milestones](http://localhost:3111/fr/dashboard/communication/milestones) | `/[locale]/(dashboard)/dashboard/communication/milestones` | `MilestoneTriggersPage` | ✅ **DONE** |
| 17 | [/dashboard/communication](http://localhost:3111/fr/dashboard/communication) | `/[locale]/(dashboard)/dashboard/communication` | `CommunicationPage` | ✅ **DONE** |
| 18 | [/dashboard/communication/reminders](http://localhost:3111/fr/dashboard/communication/reminders) | `/[locale]/(dashboard)/dashboard/communication/reminders` | `SmsRemindersPage` | ✅ **DONE** |
| 19 | [/dashboard/communication/segments](http://localhost:3111/fr/dashboard/communication/segments) | `/[locale]/(dashboard)/dashboard/communication/segments` | `AudienceSegmentsPage` | ✅ **DONE** |
| 20 | [/dashboard/communication/templates](http://localhost:3111/fr/dashboard/communication/templates) | `/[locale]/(dashboard)/dashboard/communication/templates` | `SmsTemplatesPage` | ✅ **DONE** |
| 21 | [/dashboard/communication/templates-automation](http://localhost:3111/fr/dashboard/communication/templates-automation) | `/[locale]/(dashboard)/dashboard/communication/templates-automation` | `TemplatesAutomationPage` | ✅ **DONE** |

---

## 29. Alumni Network & Community

**Target User Role**: Alumni Officer & Graduates  
**Total Pages**: 11

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/alumni/directory](http://localhost:3111/fr/alumni/directory) | `/[locale]/(alumni-portal)/alumni/directory` | `AlumniDirectoryPage` | ✅ **DONE** |
| 2 | [/alumni/events](http://localhost:3111/fr/alumni/events) | `/[locale]/(alumni-portal)/alumni/events` | `AlumniEventsPage` | ✅ **DONE** |
| 3 | [/alumni/mentoring](http://localhost:3111/fr/alumni/mentoring) | `/[locale]/(alumni-portal)/alumni/mentoring` | `AlumniMentoringPage` | ✅ **DONE** |
| 4 | [/alumni](http://localhost:3111/fr/alumni) | `/[locale]/(alumni-portal)/alumni` | `AlumniHomePage` | ✅ **DONE** |
| 5 | [/alumni/profile](http://localhost:3111/fr/alumni/profile) | `/[locale]/(alumni-portal)/alumni/profile` | `AlumniProfilePage` | ✅ **DONE** |
| 6 | [/alumni/records](http://localhost:3111/fr/alumni/records) | `/[locale]/(alumni-portal)/alumni/records` | `AlumniRecordsPage` | ✅ **DONE** |
| 7 | [/alumni/requests](http://localhost:3111/fr/alumni/requests) | `/[locale]/(alumni-portal)/alumni/requests` | `AlumniRequestsPage` | ✅ **DONE** |
| 8 | [/dashboard/students/alumni/events](http://localhost:3111/fr/dashboard/students/alumni/events) | `/[locale]/(dashboard)/dashboard/students/alumni/events` | `AlumniEventsAdminPage` | ✅ **DONE** |
| 9 | [/dashboard/students/alumni](http://localhost:3111/fr/dashboard/students/alumni) | `/[locale]/(dashboard)/dashboard/students/alumni` | `AlumniAdminPage` | ✅ **DONE** |
| 10 | [/dashboard/students/alumni/requests](http://localhost:3111/fr/dashboard/students/alumni/requests) | `/[locale]/(dashboard)/dashboard/students/alumni/requests` | `AlumniRequestsAdminPage` | ✅ **DONE** |
| 11 | [/dashboard/students/alumni-transition](http://localhost:3111/fr/dashboard/students/alumni-transition) | `/[locale]/(dashboard)/dashboard/students/alumni-transition` | `AlumniTransitionPage` | ✅ **DONE** |

---

## 30. Public School Websites (CMS)

**Target User Role**: Public / Prospective Families  
**Total Pages**: 9

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/(school-site)/[tenantSlug]/about](http://localhost:3111/fr/atlas-academy/about) | `/[locale]/(school-site)/[tenantSlug]/about` | `SchoolAboutPage` | ✅ **DONE** |
| 2 | [/(school-site)/[tenantSlug]/contact](http://localhost:3111/fr/atlas-academy/contact) | `/[locale]/(school-site)/[tenantSlug]/contact` | `SchoolContactPage` | ✅ **DONE** |
| 3 | [/(school-site)/[tenantSlug]/events](http://localhost:3111/fr/atlas-academy/events) | `/[locale]/(school-site)/[tenantSlug]/events` | `SchoolEventsPage` | ✅ **DONE** |
| 4 | [/(school-site)/[tenantSlug]/faq](http://localhost:3111/fr/atlas-academy/faq) | `/[locale]/(school-site)/[tenantSlug]/faq` | `SchoolFaqPage` | ✅ **DONE** |
| 5 | [/(school-site)/[tenantSlug]/gallery](http://localhost:3111/fr/atlas-academy/gallery) | `/[locale]/(school-site)/[tenantSlug]/gallery` | `SchoolGalleryPage` | ✅ **DONE** |
| 6 | [/(school-site)/[tenantSlug]/news](http://localhost:3111/fr/atlas-academy/news) | `/[locale]/(school-site)/[tenantSlug]/news` | `SchoolNewsListPage` | ✅ **DONE** |
| 7 | [/(school-site)/[tenantSlug]/news/[slug]](http://localhost:3111/fr/atlas-academy/news/[slug]) | `/[locale]/(school-site)/[tenantSlug]/news/[slug]` | `SchoolNewsDetailPage` | ✅ **DONE** |
| 8 | [/(school-site)/[tenantSlug]](http://localhost:3111/fr/atlas-academy) | `/[locale]/(school-site)/[tenantSlug]` | `SchoolHomePage` | ✅ **DONE** |
| 9 | [/(school-site)/[tenantSlug]/services](http://localhost:3111/fr/atlas-academy/services) | `/[locale]/(school-site)/[tenantSlug]/services` | `SchoolServicesPage` | ✅ **DONE** |

---

## 31. Public Document & Diploma Verification

**Target User Role**: Public / Employer / Authority  
**Total Pages**: 3

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/verify/card/[token]](http://localhost:3111/fr/verify/card/[token]) | `/[locale]/verify/card/[token]` | `VerifyCardPage` | ✅ **DONE** |
| 2 | [/verify/certificate/[token]](http://localhost:3111/fr/verify/certificate/[token]) | `/[locale]/verify/certificate/[token]` | `VerifyCertificatePage` | ✅ **DONE** |
| 3 | [/verify-document](http://localhost:3111/fr/verify-document) | `/[locale]/verify-document` | `VerifyDocumentPage` | ✅ **DONE** |

---

## 32. Authentication & Access Control

**Target User Role**: All Users (Public / Staff / Families)  
**Total Pages**: 3

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/invitations/[token]](http://localhost:3111/fr/invitations/[token]) | `/[locale]/(auth)/invitations/[token]` | `AcceptInvitePage` | ✅ **DONE** |
| 2 | [/login](http://localhost:3111/fr/login) | `/[locale]/(auth)/login` | `LoginPage` | ✅ **DONE** |
| 3 | [/signup](http://localhost:3111/fr/signup) | `/[locale]/(auth)/signup` | `SignupPage` | ✅ **DONE** |

---

## 33. SchoolOS SaaS Landing & Product Home

**Target User Role**: Public / Prospective Clients  
**Total Pages**: 2

| # | Page Link (Clickable) | Route Path | Component / Handler | Status |
|:---:|---|---|---|:---:|
| 1 | [/](http://localhost:3111/fr) | `/` | `GlobalRootPage` | ✅ **DONE** |
| 2 | [/](http://localhost:3111/fr) | `/[locale]/(marketing)` | `MarketingPage` | ✅ **DONE** |

---

