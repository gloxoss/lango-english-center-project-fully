# Technical Handover

For a new engineer picking up this codebase. Everything here was verified against the actual repository this session — commands and paths are real, not templated.

## Architecture

- **Framework:** Next.js 15, App Router, TypeScript.
- **Styling:** Tailwind CSS + shadcn/ui, following a documented slate/blue design system (`#0066FF`, `#16212B`, `#D1F5E8` — see the project's `CLAUDE.md`).
- **ORM / Database:** Drizzle ORM against Postgres. Schema lives in `src/models/Schema.ts` plus feature-scoped schema files (e.g. `src/features/finance/models/student-accounting-schema.ts`). Migrations are hand-written SQL in `migrations/`, currently sequential through `0127` (as of `a431047`, 2026-08-24).
- **Auth:** Better Auth.
- **Multi-tenancy:** every table with tenant-scoped data carries a `tenantId`; every API route is expected to follow the pattern `requireRequestContext(req, [roles]) → requireTenant(context) → requireCapability(context, 'x.y') → Zod .strict() validation → tenant-scoped query → recordAudit() → apiErrorResponse()` (documented in the project's `CLAUDE.md` and enforced in practice across a documented security-hardening commit sweep on 2026-08-03).
- **Reference domain model:** the project explicitly uses ESchool SaaS v1.6.0 as a business-logic/schema reference (`insperations/` directory, outside this repo proper) — worth consulting when a module's intended behavior is unclear.

## Repository structure (high-level)

```
src/
  app/                  Next.js App Router — pages under [locale]/(dashboard)/dashboard/**,
                         API routes under app/api/**
  features/<module>/
    model/ or models/   TypeScript interfaces + Drizzle schema
    services/           Business logic
    ui/                 React components (client components mostly)
  libs/                 Shared: api/ (context, permissions, validation, errors),
                         finance/, settings/, services/, payments/
  addons/               Addon registry (src/addons/registry.ts) + addon-specific code
  components/shared/    Shared UI (sidebar.tsx, coming-soon-view.tsx, etc.)
  scripts/              Seed scripts (seed.ts, seed-full.ts, seed-frappe.ts)
migrations/              Hand-written SQL, sequential (0001...0127)
scripts/                 Repo-root operational/verification scripts (apply-NNNN.mjs, verify-*.mjs)
future-implementation/   Per-module planning/status docs — a real, actively-used internal
                         documentation convention (36 module plans tracked in
                         future-implementation/_tracker/PLANS-AUDIT-AND-PROGRESS.md)
docs/                    General docs (backup-restore.md, role-matrix.md, secret-rotation.md)
docs/progress-audit/     This audit
```

## Local setup

1. `npm ci` (or `npm install --legacy-peer-deps` if you hit peer-dependency conflicts — this exact flag was added to the Docker build for the same reason, commit `30b64b0`).
2. Environment variables: `.env` and `.env.production` exist in the repo but are not documented here (values intentionally excluded per this audit's no-secrets rule). **No `.env.example` template was found in the repo** — recommend creating one as a P2/P3 documentation task so a new engineer doesn't have to reverse-engineer required variables from `src/libs/env/`.
3. Database: Postgres, via Docker (`docker-compose.yml` exists at repo root) or a local instance. **At audit time, the project's `docker-desktop` WSL distro was reported `Stopped`** — start it before anything DB-dependent will work.
4. Run migrations: `npm run db:migrate` (wraps `drizzle-kit migrate` with `dotenv -c`).
5. Seed data: `npm run db:seed:full` for the richest demo dataset (the "Atlas" tenant), or `npm run db:seed` for a minimal seed.
6. Start the dev server: `npm run dev` (or `npm run dev:next` directly).

## Running tests

- `npm run test` — Vitest unit/integration tests. **Not confirmed passing this session** — blocked by the database outage at audit time. Some real test files exist, e.g. `src/features/finance/__tests__/{currency,gateway-session,journal-export,payment-method-config}.test.ts`, plus others referenced in `future-implementation/_tracker/PLANS-AUDIT-AND-PROGRESS.md` (settings module reports ~64 passing tests as of its own last update, not independently re-run here).
- `npm run test:e2e` — Playwright. Not run this session.
- `npm run check:types` — `tsc --noEmit --pretty`. **Run this session: FAILED, 3 errors.** See `07-testing-results.md` for exact locations. Fix these first, before anything else.
- `npm run lint` — ESLint plus a custom `scripts/check-tenant-isolation.ts` script that heuristically flags routes missing tenant-scoping. Not run this session; per `PLANS-AUDIT-AND-PROGRESS.md` it has known heuristic false positives for delegate-style self-service routes (`guard/me/*`, `guard/kiosk-sessions/*`, `leadership/me/home`) — don't treat every flag as a real bug without checking.

## Building for production

`npm run build` = `npm run db:migrate && npm run build:next`. **Not run this session** (database was down; also avoided to prevent resource contention with concurrent work in this repo during the audit). Note from prior project history (`PLANS-AUDIT-AND-PROGRESS.md`): a Next/Turbopack type-checker false-positive was previously found in `subscription-overview-view.tsx:180` and worked around by relying on `tsc --noEmit` + tests instead of the Next build's own type gate — worth knowing if `next build` fails on that file specifically in a way `tsc --noEmit` doesn't reproduce.

## Deployment

`Dockerfile` and `docker-compose.yml` exist at repo root. The Dockerfile has been patched at least twice in this project's history for real build failures (`.npmrc` copy made optional, `--legacy-peer-deps` added) — treat container builds as something that has broken before and could again, not as a solved problem. **No evidence of a successful production deployment was found in this repository** — this audit could not confirm the app has ever been deployed and run outside a local/dev environment.

## Main modules and data flow

See `04-complete-feature-inventory.md` for the full module list. The core flow for any feature: a page under `src/app/[locale]/(dashboard)/dashboard/<module>/` renders a client component from `src/features/<module>/ui/`, which calls an API route under `src/app/api/<module>/`, which runs the standard guard chain (see Architecture above) against Drizzle-modeled tables.

## Authentication and role model

Roles found in code (via page guards and sidebar permission checks across this session's audits): `super_admin`, `school_admin`, `teacher`, `student`, `parent`, `accountant`, `receptionist`, `librarian`, `guard`, and a generic "employee" concept for HR self-service (gated by having an `employeeProfiles` row, not by role — see `12-user-and-admin-guide.md`). Authorization is capability-based (e.g. `finance.read`, `students.create`), not purely role-based — a role's default capabilities are defined in `src/libs/api/permissions.ts`, and per-user overrides can both grant and deny (deny-override support added commit `6fc02d3`, 2026-08-02).

## Integrations found in the codebase

- **SMS/communication:** a webhook-based provider adapter (`src/features/broadcast/providers/webhook-provider.ts`), real but generic — not a named commercial SMS gateway.
- **Payments:** CMI NAPS (Moroccan payment gateway) and Stripe adapters (`src/libs/payments/`), both real code, both explicitly uncertified for live transactions per the Student Accounting plan doc.
- **Live classrooms:** provider-neutral scheduling with a deterministic dev provider; a BigBlueButton adapter exists but is "implemented to contract, not certified" per the addon registry's own description.

## Background jobs

A scheduled-jobs pattern exists (`src/features/settings/services/scheduled-jobs-service.ts` + a worker wired into `instrumentation.ts`, polling every 60s per `PLANS-AUDIT-AND-PROGRESS.md`). Currently used for at least `purge_sessions` and a no-op handler; this is the pattern to extend for the backlog's alumni-auto-transition job (see `06-remaining-work-and-prioritized-backlog.md`).

## Troubleshooting / known issues

1. **`docker-desktop` WSL distro stopping unexpectedly** — happened mid-session during this very audit. Restart it before anything DB-dependent.
2. **3 active TypeScript errors** as of `a431047` — see `07-testing-results.md`.
3. **CRLF/LF line-ending warnings on every git operation** — the repo mixes line endings; not a functional bug, but worth normalizing via `.gitattributes` if it becomes noisy.
4. **`check-tenant-isolation.ts` heuristic false positives** on delegate-style self-service routes — see Running Tests above.

## Contribution workflow

No branch-protection rules, PR template, or CI-gate evidence was found — all 68 commits landed directly on `main`. **Recommend establishing a real branching/PR/CI-gate workflow before any second contributor joins**, given the project has operated as a single-identity, direct-to-main workflow throughout its history to date.
