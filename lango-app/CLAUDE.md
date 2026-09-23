# SchoolOS — AI Agent Development Rules & Context

> **Multi-agent rule:** other agents edit this tree at the same time. Before changing files, follow `../.agent-hub/PROTOCOL.md` (skill: `schoolos-agent-hub`): join, claim, log with proof, never `git stash`/`reset --hard`/`checkout --`/`clean`.

## 1. Project Architecture & Migration Philosophy
This project is an enterprise multi-tenant school operating system (SchoolOS) built with Next.js 15 App Router, TypeScript, Tailwind CSS, and shadcn/ui.

We use **ESchool SaaS v1.6.0** as our business logic & database reference:
- Database Schema: [`insperations/ESCHOOL_SAAS_DATABASE_SCHEMA.md`](file:///c:/Users/oussama/oussama/OneDrive%20-%20%E9%9B%AA%E7%8E%B2%E5%9B%A2%E9%98%9F/Documents/schoolos/insperations/ESCHOOL_SAAS_DATABASE_SCHEMA.md) and [`insperations/eschool_saas_full_schema.sql`](file:///c:/Users/oussama/oussama/OneDrive%20-%20%E9%9B%AA%E7%8E%B2%E5%9B%A2%E9%98%9F/Documents/schoolos/insperations/eschool_saas_full_schema.sql)
- PHP Business Logic & Repositories: [`insperations/eschool-saas-codebase/`](file:///c:/Users/oussama/oussama/OneDrive%20-%20%E9%9B%AA%E7%8E%B2%E5%9B%A2%E9%98%9F/Documents/schoolos/insperations/eschool-saas-codebase/)

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

### Blocking gates (run these, don't assume)
- `npm run check:isolation` — static tenant-isolation check on API routes.
- `npm run check:types` — `tsc --noEmit`.
- `npm run check:ui` — **UI-reality ratchet.** Four defect classes no unit test can
  see, because each sits between a working API and the user: controls with no
  handler, client screens rendering invented records without fetching, dashboard
  pages no nav entry reaches, and exported components nothing imports.
  Counts may only go **down**; baselines in `scripts/ui-reality-baseline.json`.
  Fix something, lower the baseline. Raising one means shipping a dead button, a
  fake screen or an unreachable page — do it deliberately and say so in the PR.
- `npm run test` — the suite. Requires a reachable Postgres.

**A passing API test does not mean the feature works.** The grading path had a
working API, a working Moroccan grade engine and passing route tests while
`/academics/grades/entry` served a hardcoded exam paper with pre-filled answers.
Open the screen as the role that uses it before calling anything done.

**Nav permission must equal the page's own guard.** A nav entry whose `permission`
differs from its page's `requireServerPage` capability bounces the user to the
public marketing site. `src/libs/api/__tests__/nav-page-guard-parity.test.ts`
enforces this and has caught three such mismatches.

---

## 3. Module Index
- **Students**: `/dashboard/students` (Directory, Admissions, Wizard, Guardians, Transfers, Promotions, Matricules, Photos)
- **Teachers**: `/dashboard/teachers/manage` (Directory, Bulk Import, Workload)
- **Academics**: `/dashboard/academics/*` (Mediums, Sections, Subjects, Semesters, Streams, Shifts, Optional Subjects)
- **Settings & Admin**: `/dashboard/settings/*` (General, Access Reset, CNDP F211)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
