# Lango / SchoolOS — AI Agent Development Rules & Context

## 1. Project Architecture & Migration Philosophy
This project is an enterprise multi-tenant school operating system (SchoolOS / Lango) built with Next.js 15 App Router, TypeScript, Tailwind CSS, and shadcn/ui.

We use **ESchool SaaS v1.6.0** as our business logic & database reference:
- Database Schema: [`insperations/ESCHOOL_SAAS_DATABASE_SCHEMA.md`](file:///c:/Users/oussama/oussama/OneDrive%20-%20%E9%9B%AA%E7%8E%B2%E5%9B%A2%E9%98%9F/Documents/lango/insperations/ESCHOOL_SAAS_DATABASE_SCHEMA.md) and [`insperations/eschool_saas_full_schema.sql`](file:///c:/Users/oussama/oussama/OneDrive%20-%20%E9%9B%AA%E7%8E%B2%E5%9B%A2%E9%98%9F/Documents/lango/insperations/eschool_saas_full_schema.sql)
- PHP Business Logic & Repositories: [`insperations/eschool-saas-codebase/`](file:///c:/Users/oussama/oussama/OneDrive%20-%20%E9%9B%AA%E7%8E%B2%E5%9B%A2%E9%98%9F/Documents/lango/insperations/eschool-saas-codebase/)

When building or refactoring any module (Students, Teachers, Academics, Attendance, Finance, Exams, Settings):
1. **Consult Reference Logic**: Inspect corresponding models, controllers, and database tables in `insperations/`.
2. **Multi-Tenant Isolation**: Enforce `school_id` filtering on all database queries & API routes.
3. **Layered Feature Architecture**:
   - `model/types.ts` — Strict TypeScript interfaces
   - `data/` — Data layer and API fetch helpers
   - `ui/` — Rich, stateful, dynamic React views using `@/components/ui/` primitives
   - `app/api/` — Next.js App Router API route handlers (`GET`, `POST`, `PUT`, `DELETE`)
4. **Interactive CRUD**: All pages must feature dynamic state management (modals, search, filter, inline edit, delete confirmation) — no static dummy placeholders.
5. **Design Excellence**: Slate/blue color palette (`#0066FF`, `#16212B`, `#D1F5E8`, etc.), data-dense tables, top KPI card banners, and quick inspector sidebars.

---

## 2. Command Rules
- **Build Verification**: Run `npx next build` after significant edits. Ensure 0 TypeScript / build errors.
- **Never CD**: Execute commands in working directory without changing directories.
- **Async Tasks**: Launch background tasks and wait for system completion notifications.

---

## 3. Module Index
- **Students**: `/dashboard/students` (Directory, Admissions, Wizard, Guardians, Transfers, Promotions, Matricules, Photos)
- **Teachers**: `/dashboard/teachers/manage` (Directory, Bulk Import, Workload)
- **Academics**: `/dashboard/academics/*` (Mediums, Sections, Subjects, Semesters, Streams, Shifts, Optional Subjects)
- **Settings & Admin**: `/dashboard/settings/*` (General, Access Reset, CNDP F211)
