# 🧩 Subsystems & Modules Operational Status

This document provides a comprehensive operational audit of all **40 subsystems and feature modules** in SchoolOS, their registered pages, API endpoints, database entities, key services, and live production status.

> **Last updated**: 2026-09-22 · All 40 modules audited against `src/features/` and `src/app/api/`.

---

## 📊 High-Level Module Matrix

| # | Subsystem | Registered Pages | API Endpoints | Core Tables | Operational Status |
| :-: | :--- | :-: | :-: | :-: | :---: |
| 1 | **ACADEMICS** | 37 | 71 | 18 | ✅ Operational / Live |
| 2 | **ASSESSMENT & GRADES** | 12 | 24 | 24 | ✅ Operational / Live |
| 3 | **STUDENTS & ADMISSIONS** | 18 | 40 | 12 | ✅ Operational / Live |
| 4 | **PARENTS & GUARDIANS** | 7 | 14 | 6 | ✅ Operational / Live |
| 5 | **FINANCE & ACCOUNTING** | 37 | 86 | 32 | ✅ Operational / Live |
| 6 | **HR & EMPLOYEES** | 14 | 31 | 14 | ✅ Operational / Live |
| 7 | **WORKFORCE & MOROCCAN PAYROLL** | 15 | 18 | 16 | ✅ Operational / Live |
| 8 | **COMMUNICATION & BROADCAST** | 12 | 22 | 8 | ✅ Operational / Live (Anti-Ban Protected) |
| 9 | **TRANSPORT & FLEET** | 8 | 16 | 8 | ✅ Operational / Live |
| 10 | **HOSTEL & BOARDING** | 4 | 8 | 4 | ✅ Operational / Live |
| 11 | **DOCUMENT STUDIO & OFFICIAL SEAL** | 6 | 12 | 6 | ✅ Operational / Live |
| 12 | **MASSAR SYNC ENGINE** | 4 | 8 | 4 | ✅ Operational / Live |
| 13 | **CUSTOM DOMAINS & SSL (CADDY)** | 4 | 8 | 4 | ✅ Operational / Live |
| 14 | **SUPER ADMIN & SAAS BILLING** | 22 | 48 | 18 | ✅ Operational / Live |
| 15 | **PORTALS (Student/Teacher/Parent)** | 14 | 26 | 10 | ✅ Operational / Live |
| 16 | **SETTINGS & ORGANIZATION** | 16 | 28 | 10 | ✅ Operational / Live |
| 17 | **LIVE CLASSROOMS** | — | — | — | ✅ Scaffolded / Live (ext. credentials required) |
| 18 | **CRM (Prospects & Leads)** | — | — | — | ✅ Operational / Live |
| 19 | **LIBRARY MANAGEMENT** | — | — | — | 🔶 Operational (full rollout in progress) |
| 20 | **GUARD / GATE KIOSK** | — | — | — | ✅ Operational / Live |
| 21 | **ALUMNI PORTAL** | — | — | — | ✅ Operational / Live |
| 22 | **INVENTORY MANAGEMENT** | — | — | — | 🔶 Scaffolded (pages in progress) |
| 23 | **EVENTS CALENDAR** | — | — | — | ✅ Operational / Live |
| 24 | **RECEPTION DESK** | — | — | — | ✅ Operational / Live |
| 25 | **LEADERSHIP ANALYTICS** | — | — | — | 🔶 Scaffolded (full views in progress) |
| 26 | **STUDENT ID CARDS** | — | — | — | ✅ Operational / Live |
| 27 | **CERTIFICATES MODULE** | — | — | — | ✅ Operational / Live |
| 28 | **ATTENDANCE MODULE** | — | — | — | ✅ Operational / Live |
| 29 | **DOCUMENT ATTACHMENTS VAULT** | — | — | — | ✅ Operational / Live (cross-cutting) |
| 30 | **SCHOOL PUBLIC WEBSITE BUILDER** | — | — | — | ✅ Operational / Live |
| 31 | **MARKETING SITE** | — | — | — | ✅ Operational / Live |
| 32 | **PORTAL SHARED SERVICES** | — | — | — | ✅ Operational / Live (infrastructure) |
| 33 | **PLATFORM CONFIGURATION** | — | — | — | ✅ Operational / Live |
| 34 | **SUPPORT / HELP DESK** | — | — | — | ✅ Operational / Live |
| 35 | **SUBSCRIPTIONS & BILLING** | — | — | — | ✅ Operational / Live |
| 36 | **ACCOUNTING (PCG Marocain)** | — | — | — | ✅ Operational / Live |
| 37 | **DASHBOARD KPI LAYER** | — | — | — | ✅ Operational / Live |
| 38 | **GRADING ENGINE** | — | — | — | ✅ Operational / Live (consumed by Assessment) |
| 39 | **HOMEWORK ASSIGNMENTS** | — | — | — | ✅ Operational / Live (consumed by Assessment) |
| 40 | **AUTH MODULE** | — | — | — | ✅ Operational / Live |

---

## 1. ACADEMICS Subsystem
- **Purpose**: Institutional registry of academic years, terms, cycles, branches (Filières), classes, sections, rooms, subjects, and timetable scheduling.
- **Key Capabilities**:
  - Academic year rollover with session copy.
  - Multi-stream Moroccan structure: Enseignement Originel, Lettres & Sciences Humaines, Sciences Mathématiques, Sciences Expérimentales, Sciences Économiques, Bac International.
  - Timetable solver with room conflict detection, teacher availability constraints, and shift policies.
- **Pages**: `/dashboard/academics`, `/dashboard/academics/classes`, `/dashboard/academics/sections`, `/dashboard/academics/rooms`, `/dashboard/academics/schedule`, `/dashboard/academics/streams`, `/dashboard/academics/conflicts`.
- **APIs**: `GET|POST /api/academics/classes`, `GET|POST /api/academics/sections`, `GET|POST /api/academics/timetable-slots`, `GET /api/academics/timetable-conflicts`, `POST /api/academics/timetable-versions/publish`.
- **Status**: **100% Operational**.

---

## 2. ASSESSMENT & GRADES Subsystem
- **Purpose**: Moroccan national standard grading, exam master schedules, marksheet grid, homework assignments, and question bank.
- **Key Capabilities**:
  - Official Moroccan **/20 scale** calculations with branch-dependent subject coefficients.
  - Marksheet Grid with live cell editing, auto-save, standard deviation, and class ranking.
  - Exam Term Workflow: `draft -> open -> locked -> published`.
  - Homework attempts submission, auto-grading rubrics, and plagiarism checks.
- **Pages**: `/dashboard/academics/assessment/marksheet`, `/dashboard/academics/assessment/exam-master`, `/dashboard/academics/assessment/homework`, `/dashboard/academics/assessment/online-exams`.
- **APIs**: `GET|POST /api/academics/exam-terms`, `GET|POST /api/academics/exam-terms/[id]/marksheet`, `GET /api/academics/exam-terms/[id]/rankings`, `POST /api/academics/homework/[id]/grade`.
- **Status**: **100% Operational**.

---

## 3. STUDENTS & ADMISSIONS Subsystem
- **Purpose**: Student life-cycle, prospective student lead intake, enrollment, document verification, matricule generation, and alumni transitions.
- **Key Capabilities**:
  - Automated matricule generation engine with customized institutional prefixes.
  - Bulk Excel/CSV student onboarding with column mapping and auto-sanitization.
  - Document vault: Birth certificate, medical record, previous school certificate, photos.
  - Promotion Wizard: Academic end-of-year mass promotion and class assignment.
- **Pages**: `/dashboard/students`, `/dashboard/students/add`, `/dashboard/students/import`, `/dashboard/students/matricules`, `/dashboard/students/promotions`, `/dashboard/students/admissions`.
- **APIs**: `GET|POST /api/students`, `POST /api/students/import`, `GET|POST /api/students/matricules`, `POST /api/students/promotions`.
- **Status**: **100% Operational**.

---

## 4. PARENTS & GUARDIANS Subsystem
- **Purpose**: Legal guardian directory, multi-child family links, parent emergency priority badges, and parent portal.
- **Key Capabilities**:
  - Primary Contact (`⭐ Principal`) and Emergency Contact (`🛡️ Urgence`) designation flags with 1-click toggling.
  - Guardian link token generation for self-service onboarding via mobile phone.
  - Parent portal view of attendance, invoices, report cards, and excuses submission.
- **Pages**: `/dashboard/students/parents`, `/dashboard/students/parents/[id]`, `/dashboard/parent`, `/dashboard/parent/finance`, `/dashboard/parent/attendance`.
- **APIs**: `GET|POST /api/students/parents`, `POST /api/students/parents/link`, `GET /api/students/parents/[id]/payments`.
- **Status**: **100% Operational**.

---

## 5. FINANCE & ACCOUNTING Subsystem
- **Purpose**: Complete fee structure configuration, cashier POS collection desk, Moroccan General Chart of Accounts (Plan Comptable Marocain), and online payment reconciliation.
- **Key Capabilities**:
  - Fee schedules: Registration, tuition, transport, canteen, boarding fees.
  - Cashier Session Management: Cash drawer opening, closing, cash reconciliation, and discrepancy audit.
  - Online Payments: Integrated CMI (Centre Monétique Interbancaire) and Stripe webhooks with automated receipting.
  - Moroccan Accounting Engine: Journal entries, double-entry bookkeeping, trial balance, and balance sheet drill-downs.
- **Pages**: `/dashboard/finance`, `/dashboard/finance/invoices`, `/dashboard/finance/payments`, `/dashboard/finance/collection-desk`, `/dashboard/finance/cashier-sessions`, `/dashboard/finance/accounting/journal`.
- **APIs**: `GET|POST /api/finance/invoices`, `GET|POST /api/finance/payments`, `GET|POST /api/finance/cashier-sessions`, `GET /api/finance/accounting/trial-balance`.
- **Status**: **100% Operational**.

---

## 6. HR & EMPLOYEE Subsystem
- **Purpose**: Staff registry, teaching vs administrative designations, employment contracts, credential lifecycles, and offboarding.
- **Key Capabilities**:
  - Moroccan contract management (CDI, CDD, ANAPEC, Vacation horaire).
  - Digital employee document file (CIN, Diploma, CNSS registration certificate).
  - Account linking between system users and staff records.
- **Pages**: `/dashboard/hr`, `/dashboard/hr/employees`, `/dashboard/hr/employees/new`, `/dashboard/hr/departments`, `/dashboard/hr/designations`.
- **APIs**: `GET|POST /api/hr/employees`, `GET|PATCH /api/hr/employees/[id]`, `GET|POST /api/hr/departments`.
- **Status**: **100% Operational**.

---

## 7. WORKFORCE & MOROCCAN PAYROLL Engine
- **Purpose**: Timeclock kiosk, attendance punches, overtime, advance salaries, and full Moroccan statutory payroll calculations.
- **Key Capabilities**:
  - CNSS calculation with the statutory 6 000 DH gross monthly ceiling.
  - Mandatory AMO contribution withholding without ceiling.
  - Progressive Moroccan Impôt sur le Revenu (IR) bracket calculations with family dependent deductions (30 DH/dependent).
  - Automated payslip generation with maker-checker approval workflows.
- **Pages**: `/dashboard/workforce`, `/dashboard/workforce/timeclock`, `/dashboard/workforce/payroll/runs`, `/dashboard/workforce/payroll/payslips`.
- **APIs**: `GET|POST /api/workforce/payroll/runs`, `POST /api/workforce/payroll/runs/[id]/calculate`, `POST /api/workforce/payroll/runs/[id]/lock`.
- **Status**: **100% Operational**.

---

## 8. COMMUNICATION & BROADCAST Subsystem
- **Purpose**: Multi-channel parental notifications (SMS, WhatsApp, Email) for absences, unpaid tuition, emergency alerts, and report card releases.
- **Key Capabilities**:
  - **GSM-7 SMS Direct**: Full Moroccan telco encoding optimization with character counter and credit simulation.
  - **WhatsApp WAHA Multi-Session**: Dedicated per-tenant QR Code pairing (`tenant_{tenantId}`). No cross-school account sharing.
  - **Meta Anti-Ban Safety Engine**: Strict daily quotas (Trial: 25, Basic: 50, Standard: 100, Premium: 250) + 1 200 ms pacing delay + hard HTTP 429 cut-off.
  - **Interactive Reminders Hub**: Filter by "Élèves à risque" vs "Tous les élèves", 1-click preset templates, personal phone test modal.
- **Pages**: `/dashboard/communication/reminders` (canonical, alias redirect from `sms-reminders`), `/dashboard/broadcast/connections`.
- **APIs**: `GET|POST /api/communication/messages`, `GET /api/communication/balance`, `GET /api/addons/broadcast/waha/qr`.
- **Status**: **100% Operational & Protected**.

---

## 9. TRANSPORT & FLEET Subsystem
- **Purpose**: School bus management, pickup/dropoff routes, student bus stops, driver licenses, and incident reporting.
- **Pages**: `/dashboard/transport`, `/dashboard/transport/routes`, `/dashboard/transport/vehicles`, `/dashboard/transport/stops`.
- **APIs**: `GET|POST /api/transport/routes`, `GET|POST /api/transport/allocations`, `GET|POST /api/transport/trips`.
- **Status**: **100% Operational**.

---

## 10. HOSTEL / BOARDING Subsystem
- **Purpose**: On-campus boarding facility management, room allocation, bed registry, and hostel fee billing.
- **Pages**: `/dashboard/hostel`, `/dashboard/hostel/rooms`, `/dashboard/hostel/allocations`.
- **Status**: **100% Operational**.

---

## 11. DOCUMENT STUDIO & OFFICIAL SEAL Subsystem
- **Purpose**: High-fidelity dynamic document generator for official Moroccan school certificates, attestations, and transcripts.
- **Key Capabilities**:
  - Official Moroccan School Seal (`Cachet Officiel`): Generates bilingual circular stamp with AREF, Direction Provinciale, and School Matricule.
  - Attestation d'inscription, Certificat de scolarité, Attestation de réussite.
  - Watermark, digital signature, and verification QR code.
- **Status**: **100% Operational**.

---

## 12. MASSAR SYNC ENGINE
- **Purpose**: Bi-directional data synchronizer with the Moroccan Ministry of National Education's Massar platform.
- **Key Capabilities**:
  - Imports and parses Massar standard Excel rosters (`Code Massar`, Nom arabe/français, Date de naissance).
  - Exports grade sheets formatted strictly to Massar import specifications.
- **Status**: **100% Operational**.

---

## 13. CUSTOM DOMAINS & AUTOMATED SSL
- **Purpose**: Whitelabel custom domain routing for client institutions (e.g. `portail.ecole-atlas.ma`).
- **Key Capabilities**:
  - Automated DNS verification (CNAME/A record validation).
  - On-demand TLS certificate issuance via Caddy reverse proxy endpoint (`/api/platform/caddy-ask`).
- **Status**: **100% Operational**.

---

## 14. SUPER ADMIN & SAAS BILLING
- **Purpose**: Platform owner management console for tenant provisioning, subscriptions, modules, SMS trunk balance, and security audits.
- **Key Capabilities**:
  - School tenant provisioning with instant database seeding.
  - Dynamic subscription plan editor (Trial, Basic, Standard, Premium, Enterprise) with feature entitlement toggling.
  - System-wide resource monitoring and database backup triggers.
- **Pages**: `/dashboard/super-admin`, `/dashboard/super-admin/schools`, `/dashboard/super-admin/subscriptions`, `/dashboard/super-admin/sms`.
- **Status**: **100% Operational**.

---

## 15. PORTALS (Student / Teacher / Parent)
- **Purpose**: Role-specific, dedicated lightweight portals designed for high performance on mobile devices.
- **Key Capabilities**:
  - Student Portal: Homework submissions, grades, timetable, attendance logs.
  - Teacher Portal: Attendance roster scanning, grade entry, live class studio.
  - Parent Portal: Tuition payments, child progress tracking, absence justification requests.
- **Status**: **100% Operational**.

---

## 16. SETTINGS & ORGANIZATION
- **Purpose**: Institutional profile, branding assets, logo, official header, academic grading rules, and notification preferences.
- **Status**: **100% Operational**.

---

---

## 17. LIVE CLASSROOMS Engine
- **Purpose**: Real-time video class delivery layer enabling teachers to conduct live sessions from inside SchoolOS. Students join from the Student Portal.
- **Key Capabilities**:
  - Provider adapter pattern (`live-classrooms/providers/`) for plugging in external streaming services.
  - Session models, participant tracking, and classroom state management.
  - UI layer for teacher controls and student join experience.
- **Feature Module**: `src/features/live-classrooms/` _(data, models, providers, services, ui)_.
- **Status**: **Scaffolded & Live** (provider adapters require external service credentials to activate).

---

## 18. CRM — Prospect & Lead Management
- **Purpose**: Pre-enrollment customer relationship management. Tracks prospective families from first inquiry through to student registration.
- **Key Capabilities**:
  - Lead intake forms with source tracking.
  - Contact pipeline with conversion stages.
  - Linked to the Admissions subsystem for seamless lead-to-student conversion.
- **Feature Module**: `src/features/crm/` _(data, services, ui, tests)_.
- **API Namespace**: `GET|POST /api/crm/...`
- **Status**: **Operational**.

---

## 19. LIBRARY Management
- **Purpose**: School library catalogue, lending lifecycle, and overdue tracking.
- **Key Capabilities**:
  - Book catalogue with ISBN, author, and category registry.
  - Loan issuance and return recording with per-student borrowing history.
  - Overdue detection and notification hooks.
- **Feature Module**: `src/features/library/` _(api, models, services, ui)_.
- **Status**: **Operational** (full production rollout in progress — see Roadmap Phase 1).

---

## 20. GUARD / GATE Security Kiosk
- **Purpose**: Physical school gate check-in and check-out management. Records student arrivals, departures, and visitor entries.
- **Key Capabilities**:
  - Student scan events tied to scanner device registry (`/api/scanner-devices`).
  - Visitor log with guardian identity verification.
  - Late arrival detection with automatic absence flag integration.
- **Feature Module**: `src/features/guard/` _(models, services, ui)_.
- **API Namespace**: `GET|POST /api/guard/...`, `GET|POST /api/gate/...`
- **Status**: **Operational**.

---

## 21. ALUMNI Portal
- **Purpose**: Self-service portal for former students. Provides access to transcripts, certificates, and alumni network features.
- **Key Capabilities**:
  - Alumni directory with graduated class groupings.
  - Document retrieval: archived transcripts and diplomas.
  - Separate Next.js route group `(alumni-portal)` with dedicated layout and auth context.
- **Feature Module**: `src/features/alumni/` _(ui)_.
- **Status**: **Operational**.

---

## 22. INVENTORY Management
- **Purpose**: School asset and resource inventory — equipment, supplies, furniture, and consumables.
- **Key Capabilities**:
  - Asset registry with category, condition, and location tracking.
  - Checkout and return lifecycle for shared equipment.
  - Low-stock alerting and reorder tracking.
- **Feature Module**: `src/features/inventory/` _(models, services, ui)_.
- **Status**: **Scaffolded** (models and services complete; dashboard pages in progress — see Roadmap Phase 1).

---

## 23. EVENTS Calendar
- **Purpose**: School events management — creation, scheduling, registration, and notification.
- **Key Capabilities**:
  - Event creation with audience targeting (all students, specific class, staff only).
  - Registration and attendance tracking for events.
  - Calendar view integrated into the dashboard.
- **Feature Module**: `src/features/events/` _(models, services, ui)_.
- **Status**: **Operational**.

---

## 24. RECEPTION Desk
- **Purpose**: Front-desk management module for school receptionists — walk-in visitor handling, phone inquiry logging, and appointment scheduling.
- **Key Capabilities**:
  - Visitor check-in with purpose and host recording.
  - Inquiry log with follow-up tracking.
  - Linked to the CRM for lead capture from walk-ins.
- **Feature Module**: `src/features/reception/` _(models, services, ui)_.
- **API Namespace**: `GET|POST /api/reception/...`
- **Status**: **Operational**.

---

## 25. LEADERSHIP Analytics Dashboard
- **Purpose**: Director and school board-facing analytics layer. Provides cross-module KPI summaries and performance intelligence.
- **Key Capabilities**:
  - Cohort performance trends across exam terms.
  - Enrollment, retention, and capacity metrics.
  - Financial summary tiles (collections vs targets).
  - Executive report exports.
- **Feature Module**: `src/features/leadership/` _(models, services, ui)_.
- **API Namespace**: `GET /api/leadership/...`
- **Status**: **Scaffolded** (models and services ready; full dashboard views in progress — see Roadmap Phase 2).

---

## 26. STUDENT ID CARDS
- **Purpose**: Generation and printing of official student and staff identity cards with school branding, photo, and QR code.
- **Key Capabilities**:
  - Card template editor with logo, seal, and field layout.
  - Bulk generation for entire classes or year groups.
  - QR code embedded for gate scanner verification.
- **Feature Module**: `src/features/cards/` _(models, services, ui, tests)_.
- **API Namespace**: `GET|POST /api/cards/...`, `GET|POST /api/identity-badges/...`
- **Status**: **Operational**.

---

## 27. CERTIFICATES Module
- **Purpose**: Certificate generation beyond the Document Studio — custom templates, bulk issuance, and certificate registry.
- **Key Capabilities**:
  - Custom certificate template builder (beyond the built-in attestation types).
  - Bulk issuance for award ceremonies and end-of-year events.
  - Certificate registry with verification QR codes.
- **Feature Module**: `src/features/certificates/` _(models, services, ui, tests)_.
- **API Namespace**: `GET|POST /api/certificates/...`
- **Status**: **Operational**.

---

## 28. ATTENDANCE Module
- **Purpose**: Daily attendance recording for all students across all class sections.
- **Key Capabilities**:
  - Homeroom teacher attendance roster (morning and afternoon sessions).
  - Per-subject attendance for secondary-level timetabled lessons.
  - Absence totals feeding the Communication Reminders Hub ("Élèves à risque" filter).
  - Gate scanner integration for automated arrival detection.
- **Feature Module**: `src/features/attendance/` _(data, models, ui)_.
- **API Namespace**: `GET|POST /api/attendance/...`
- **Status**: **100% Operational**.

---

## 29. DOCUMENT ATTACHMENTS Vault
- **Purpose**: Centralized file storage service for all tenant-scoped document uploads across the platform.
- **Key Capabilities**:
  - Tenant-isolated file storage with access control.
  - Used by: student document files (CIN, birth certificate, medical), HR credential files (CIN, diploma, CNSS cert), and finance payment proof uploads.
  - Virus/MIME-type validation at upload boundary.
- **Feature Module**: `src/features/attachments/` _(models, services, tests)_.
- **Status**: **100% Operational** (cross-cutting service, not a standalone page).

---

## 30. SCHOOL PUBLIC WEBSITE Builder
- **Purpose**: Each school tenant can build and publish their own public-facing website through SchoolOS, served under their custom domain.
- **Key Capabilities**:
  - Page template selection and content editor.
  - School info, faculty pages, news posts, and admissions CTA.
  - Rendered under the `(school-site)` Next.js route group, hosted at the tenant's custom domain via Caddy.
- **Feature Module**: `src/features/website/` _(models, services, ui, tests)_.
- **Status**: **Operational**.

---

## 31. MARKETING Site
- **Purpose**: SchoolOS SaaS acquisition marketing site — landing pages, pricing, and lead capture for prospective school clients.
- **Key Capabilities**:
  - Marketing pages served under the `(marketing)` Next.js route group.
  - Lead capture forms feeding the CRM module.
  - Not tenant-scoped; serves the platform operator's marketing needs.
- **Feature Module**: `src/features/marketing/` _(context, data, model, ui)_.
- **Status**: **Operational**.

---

## 32. PORTAL (Shared Services)
- **Purpose**: Shared models and service layer consumed by all three role-specific portals (Student Portal, Teacher Portal, Parent Portal).
- **Key Capabilities**:
  - Unified session management and role resolution for portal routes.
  - Shared API service utilities used by `/api/portal/...` endpoints.
- **Feature Module**: `src/features/portal/` _(models, services)_.
- **Status**: **100% Operational** (infrastructure, no standalone pages).

---

## 33. PLATFORM Configuration
- **Purpose**: Internal platform configuration, feature flag management, and tenant provisioning utilities used by the Super Admin console.
- **Key Capabilities**:
  - Feature entitlement toggling per subscription tier.
  - Tenant provisioning helpers and database seeding utilities.
  - Platform health monitoring endpoints.
- **Feature Module**: `src/features/platform/` _(models, services, ui)_.
- **API Namespace**: `GET|POST /api/platform/...`
- **Status**: **100% Operational**.

---

## 34. SUPPORT / Help Desk
- **Purpose**: In-app support ticket system for school admins to contact the SchoolOS platform team.
- **Feature Module**: `src/features/support/` _(ui)_.
- **API Namespace**: `GET|POST /api/support/...`
- **Status**: **Operational**.

---

## 35. SUBSCRIPTIONS & Billing
- **Purpose**: Tenant-facing subscription plan display, upgrade flows, and billing status. Separate from the Super Admin plan editor.
- **Key Capabilities**:
  - Current plan display with feature entitlement summary.
  - Upgrade and plan change request flows.
  - Billing history and invoice downloads.
- **Feature Module**: `src/features/subscriptions/` _(services, ui)_.
- **Status**: **Operational**.

---

## 36. ACCOUNTING Module
- **Purpose**: Full Moroccan Plan Comptable Général (PCG) implementation. Operates as the back-end ledger behind the Finance subsystem.
- **Key Capabilities**:
  - Double-entry bookkeeping journal with debit/credit entry pairs.
  - Account chart organized by Moroccan PCG class structure (Class 1–7).
  - Trial balance, profit & loss, and balance sheet views.
  - Automatic journal entry generation from Finance payment events.
- **Feature Module**: `src/features/accounting/` _(models, services, ui)_.
- **Status**: **100% Operational** (backs the Finance subsystem journal explorer).

---

## 37. DASHBOARD KPI Layer
- **Purpose**: Home dashboard aggregation layer — summary tiles, quick-action shortcuts, and at-a-glance school health indicators.
- **Key Capabilities**:
  - Enrollment counts, today's attendance rate, outstanding invoices total, and pending tasks.
  - Role-aware tile selection (admin sees finance; teacher sees class attendance; parent sees child summary).
- **Feature Module**: `src/features/dashboard/` _(model, ui)_.
- **Status**: **100% Operational**.

---

## 38. GRADING Engine
- **Purpose**: Dedicated /20 grading calculation module. Handles coefficient weighting, average computation, and ranking logic independently of the UI layer.
- **Key Capabilities**:
  - Subject coefficient application per Filière/Branch.
  - Weighted semester and annual average calculation.
  - Class ranking with tie-breaking rules.
  - Feeds the Assessment marksheet and Bulletin Scolaire generator.
- **Feature Module**: `src/features/grading/` _(data, ui)_.
- **Status**: **100% Operational** (consumed by Assessment subsystem).

---

## 39. HOMEWORK Assignments
- **Purpose**: Homework assignment lifecycle management — creation, student submission, and grading.
- **Key Capabilities**:
  - Teacher creates homework with due dates, file attachments, and rubric definitions.
  - Student submission portal with file upload support.
  - Auto-grading and manual override workflow.
  - Plagiarism check hooks.
- **Feature Module**: `src/features/homework/` _(data, ui)_.
- **Status**: **100% Operational** (consumed by Assessment subsystem).

---

## 40. AUTH Module
- **Purpose**: Authentication UI, session management models, and multi-provider auth wrappers.
- **Key Capabilities**:
  - Login, registration, password reset, and session recovery flows.
  - Role-based session payload (super_admin, school_admin, teacher, accountant, receptionist, parent, student).
  - JWT + session cookie dual authentication support.
- **Feature Module**: `src/features/auth/` _(model, ui)_.
- **Status**: **100% Operational**.

---

## 🛡️ UI Reality Ratchet Verification Baselines
SchoolOS maintains an automated static code analysis ratchet (`scripts/check-ui-reality.ts`) to prevent UI regressions:
- **Dead controls (buttons without handlers/links)**: `47 / 47` (Holding baseline).
- **Mock screens (invented static record arrays)**: `0 / 0` (100% connected to live DB/API).
- **Unlinked dashboard pages**: `34 / 34` (Holding baseline).
- **Orphaned components**: `7 / 7` (Holding baseline).
