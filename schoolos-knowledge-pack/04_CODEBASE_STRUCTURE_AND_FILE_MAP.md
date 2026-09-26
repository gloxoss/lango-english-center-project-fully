# 📁 Codebase Structure & File Map

## 1. Directory Tree Overview

```
lango-english-center-project-fully/
├── docker-compose.yml          # Production multi-container composition
├── deploy-vps.bat              # One-click Windows deployment trigger
├── AGENTS.md                   # AI Agent Ground Truth & Operational Rules
├── schoolos-knowledge-pack/    # Standalone System Context & Agent Dossier
└── lango-app/                  # Main Next.js 15 Application Root
    ├── package.json            # Dependencies & build scripts
    ├── next.config.ts          # Next.js config (standalone build, 308 redirects)
    ├── drizzle.config.ts       # Drizzle ORM configuration
    ├── Dockerfile              # Multi-stage Linux/AMD64 production container build
    ├── migrations/             # 147 sequential SQL database migration files
    ├── scripts/
    │   ├── deploy-to-vps.ps1   # PowerShell automated zero-downtime VPS deployment
    │   ├── check-ui-reality.ts # UI Reality ratchet analysis tool
    │   └── check-tenant-isolation.ts # Static multi-tenant safety auditor
    └── src/
        ├── app/                # Next.js App Router (Pages & API endpoints)
        ├── components/         # Reusable design system UI primitives
        ├── features/           # Bounded context feature domains
        ├── libs/               # Cross-cutting platform libraries & utilities
        ├── models/             # Drizzle database schemas & types
        └── locales/            # Translation dictionaries (ar, fr, en)
```

---

## 2. Source Code Architecture (`src/`)

### 2.1 The Next.js App Router (`src/app/`)

The app uses **locale-prefixed route groups** under `[locale]/`. There are four top-level route groups:

- **`[locale]/(auth)/`**: Login, registration, password reset, and session recovery screens.
- **`[locale]/(dashboard)/dashboard/`**: The main authenticated school management console (see full listing below).
- **`[locale]/(alumni-portal)/`**: Dedicated alumni self-service portal. Separate layout and auth context from the staff dashboard.
- **`[locale]/(marketing)/`**: Public-facing marketing and landing pages for SchoolOS SaaS acquisition. Not tenant-scoped.
- **`[locale]/(school-site)/`**: School public website builder output — rendered public pages for each tenant's custom school website.

**`(dashboard)/dashboard/` sub-routes:**
  - `academics/`: Timetable solver, classes, sections, rooms, exams, marksheet, assessment.
  - `students/`: Directory, admissions, matricules, photo grid, promotions, parents.
  - `finance/`: Invoicing, cashier sessions, online payments, Moroccan accounting journal.
  - `hr/`: Employee directory, contracts, leave management.
  - `workforce/`: Timeclock kiosk, Moroccan CNSS/IR payroll engine, payslips.
  - `communication/`:
    - `reminders/` (Canonical Reminders Hub, with permanent 308 redirect from `sms-reminders`).
    - `broadcast/`: Broadcast campaigns and outbound connectors.
  - `transport/`: Fleet routes, stops, and allocations.
  - `hostel/`: Boarding facility room allocation and bed registry.
  - `library/`: Library catalogue, book loans, and returns.
  - `guard/`: School gate check-in kiosk and visitor log.
  - `events/`: School events calendar and scheduling.
  - `leadership/`: Director-level analytics, cohort performance, and KPI dashboard.
  - `super-admin/`: Platform owner multi-school console.
  - `settings/`: Institutional profile, branding, grading rules, notification preferences.

- **`api/`**: 800+ RESTful API endpoints organized symmetrically by feature module. Top-level namespaces: `academics`, `accountant`, `addons`, `admissions`, `alumni`, `analytics`, `attendance`, `audit-logs`, `auth`, `cards`, `certificates`, `communication`, `content`, `crm`, `dashboard`, `employee`, `exports`, `finance`, `gate`, `guard`, `guardian`, `health`, `hr`, `identity-badges`, `leadership`, `me`, `notifications`, `platform`, `portal`, `public`, `reception`, `scanner-devices`, `search`, `security`, `settings`, `student`, `students`, `super-admin`, `support`, `teacher`, `teachers`, `tenant`, `transport`, `users`, `waitlist`, `webhooks`, `workforce`.

### 2.2 Feature Modules (`src/features/`)
Each feature module encapsulates its own UI views, client controllers, domain services, models, and tests. There are **40 feature modules** total:

**Core Academic & Assessment:**
- `academics/` _(data, model, services, ui)_: `services/room-registry.ts`, `services/massar-sync-service.ts`, `ui/exam-planning-client.tsx`.
- `assessment/` _(models, services, types, ui, tests)_: `services/homework-service.ts`, `services/teacher-question-bank-service.ts`, `ui/marksheet-grid-view.tsx`.
- `grading/` _(data, ui)_: Dedicated /20 grading logic layer separate from assessment. Handles coefficient calculations and grade normalization.
- `homework/` _(data, ui)_: Homework assignment views and submission handling, consumed by the assessment module.
- `attendance/` _(data, models, ui)_: Attendance roster scanning, session tracking, and absence recording.

**Students & People:**
- `students/` _(data, model, ui)_: Student directory, bulk import, and enrollment wizard.
- `student/` _(api, ui)_: Student portal-facing API adapters and views (read-only, role-restricted).
- `parent/` _(api, models, services, ui)_: Parent portal domain logic, guardian link tokens, and child progress APIs.
- `alumni/` _(ui)_: Alumni portal views and directory. Consumes the `(alumni-portal)` route group.
- `cards/` _(models, services, ui, tests)_: Student and staff ID card generation and printing.
- `attachments/` _(models, services, tests)_: Document vault service — file upload, storage, retrieval, and tenant-scoped access control.

**Finance & Workforce:**
- `finance/` _(models, ui, tests)_: `ui/invoices-view.tsx`, `ui/cashier-sessions-view.tsx`, `ui/journal-explorer-view.tsx`.
- `accounting/` _(models, services, ui)_: Moroccan Plan Comptable Général journal explorer, double-entry ledger, and trial balance.
- `workforce/` _(data, models, services, ui)_: `services/payroll-engine.ts`, `services/ma-regulation-adapter.ts` (Moroccan CNSS/AMO/IR formulas).
- `subscriptions/` _(services, ui)_: SaaS plan billing and subscription lifecycle management (tenant-facing).

**Communication & Broadcast:**
- `broadcast/` _(api, models, providers, services, ui)_:
  - `providers/`: `whatsapp-waha-provider.ts`, `android-sms-provider.ts`, `smsto-provider.ts`, `twilio-sms-provider.ts`, `resend-email-provider.ts`, `brevo-email-provider.ts`.
  - `services/`: `whatsapp-anti-spam-service.ts`, `sms-delivery.ts`, `connections-service.ts`.
  - `ui/`: `connections-view.tsx` (QR Code pairing modal, test dispatches).
- `communication/` _(ui)_: `ui/sms-reminders-view.tsx` (Interactive multi-channel dispatch hub).
- `support/` _(ui)_: In-app help desk and support ticket UI.

**HR & Staff:**
- `hr/` _(model, models, services, ui)_: Employee directory, contracts (CDI/CDD/ANAPEC), credential lifecycle, offboarding.
- `teacher/` _(api, ui)_: Teacher portal-facing API adapters and views.
- `teachers/` _(model, ui)_: Teacher management from the admin perspective — schedules, assignments, HR links.

**Operations & Facilities:**
- `transport/` _(models, services, ui, tests)_: Fleet routes, stops, vehicle registry, and driver assignments.
- `hostel/` _(model, models, server, services, ui, tests)_: Boarding room allocation, bed registry, and hostel fee billing.
- `guard/` _(models, services, ui)_: School gate security kiosk — check-in/check-out, visitor log, and student scan events.
- `reception/` _(models, services, ui)_: Reception desk module — visitor management, front-desk CRM, and inquiry handling.
- `inventory/` _(models, services, ui)_: School resource inventory — equipment, supplies, and asset tracking.
- `library/` _(api, models, services, ui)_: Library catalogue, book loans, returns, and overdue tracking.
- `events/` _(models, services, ui)_: School events calendar — creation, registration, and notifications.

**Classrooms & Learning:**
- `live-classrooms/` _(data, models, providers, services, ui)_: Real-time video class delivery engine. Includes provider adapters for external streaming services.
- `certificates/` _(models, services, ui, tests)_: Certificate generation beyond Document Studio — custom templates, bulk issuance.

**Portals & Platform:**
- `portal/` _(models, services)_: Generic portal services and session models shared across student/teacher/parent portals.
- `platform/` _(models, services, ui)_: Platform configuration, feature flags, and tenant provisioning utilities.
- `settings/` _(data, models, services, ui, tests)_: School settings — institutional profile, branding, grading rules, notification preferences.
- `super-admin/` _(ui)_: Super admin console UI layer — school provisioning, subscription management, resource monitoring.

**Analytics & Leadership:**
- `dashboard/` _(model, ui)_: Core dashboard KPI tiles, summary cards, and data aggregation layer.
- `leadership/` _(models, services, ui)_: Director-level analytics — cohort performance, cross-class trends, and executive reports.
- `crm/` _(data, services, ui, tests)_: Prospect and lead intake CRM — contact management, conversion pipeline, and intake forms.

**Public & Marketing:**
- `website/` _(models, services, ui, tests)_: School public website builder — page templates, content management, and `(school-site)` rendering layer.
- `marketing/` _(context, data, model, ui)_: Marketing site content and lead capture for SchoolOS SaaS acquisition. Feeds the `(marketing)` route group.

**Auth & Identity:**
- `auth/` _(model, ui)_: Authentication UI, session models, and provider wrappers.
- `identity-badges/` _(via API namespace)_: Badge and ID printing endpoint layer.

### 2.3 Shared Primitives (`src/components/`)
- `ui/`: Radix-powered, Tailwind-styled primitives (`button.tsx`, `badge.tsx`, `card.tsx`, `dialog.tsx`, `input.tsx`, `select.tsx`, `tabs.tsx`).
- `shared/`: App headers, tenant switchers, sidebars, navigation drawers, and global breadcrumbs.

### 2.4 Platform Libraries (`src/libs/`)
- **`api/context.ts`**: Authentication pipeline. Validates Bearer token or session cookie, resolves tenant context, checks capabilities (`requireRequestContext`, `requireTenant`, `requireCapability`).
- **`api/errors.ts`**: Standardized `ApiError` class (HTTP status, error code, friendly message) and `apiErrorResponse()` handler.
- **`api/validation.ts`**: Centralized Zod request validation schemas (`smsMessageCreateSchema`, `studentCreateSchema`, etc.) enforcing `.strict()`.
- **`api/audit.ts`**: Law 09-08 compliant audit logger (`recordAudit`).
- **`DB.ts`**: Drizzle client connection singleton connected to PostgreSQL pool.
- **`sms/gsm7.ts`**: Moroccan GSM-7 character analysis, accent substitution, and segment calculator.

---

## 3. State Management & Component Conventions

1. **Server vs. Client Components**:
   - Page files (`page.tsx`) act as lightweight server wrappers handling metadata, i18n locale loading, and SSR pre-fetching.
   - Interactive logic is delegated to corresponding client views (`page.client.tsx` or `*Client.tsx`, `*View.tsx`) tagged with `'use client'`.
2. **URL State as the Single Source of Truth**:
   - Filtering, search queries, pagination (`page`, `pageSize`), and active tabs are stored in URL query parameters (`searchParams`) for instant shareability and browser back-button fidelity.
3. **Optimistic Feedback**:
   - Fast state toggles (like Primary/Emergency contact switches or row selections) update client state optimistically and reconcile via background fetch.
