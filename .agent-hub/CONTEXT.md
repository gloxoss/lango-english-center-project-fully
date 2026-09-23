# SchoolOS: context every agent needs before touching code

Read this once per session. It is the short version; the long versions are linked.

## What the product is

SchoolOS is a multi-tenant school management platform for Moroccan schools. One Postgres database, rows separated by `tenant_id`. Roles: super_admin, school_admin, teacher, accountant, student, parent, alumni, guard, receptionist, librarian. Languages: French (default), Arabic (RTL), English.

## Where things are

| What | Where |
|---|---|
| Git repo root | `lango-english-center-project-fully/` (this folder's parent) |
| The app | `lango-app/` (Next.js 16 App Router, TypeScript, Drizzle ORM, better-auth, next-intl, vitest, Playwright) |
| Pages | `lango-app/src/app/[locale]/(dashboard)/dashboard/**/page.tsx`, public site `src/app/[locale]/[tenantSlug]/**` |
| API routes | `lango-app/src/app/api/**/route.ts` |
| Features | `lango-app/src/features/<module>/{services,ui,models,data}` |
| Permissions and role defaults | `lango-app/src/libs/api/permissions.ts` (`DEFAULT_ROLE_PERMISSIONS`) |
| Page guard | `lango-app/src/libs/api/page-guard.ts` (`requireServerPage`) |
| Translations | `lango-app/locales/{fr,ar,en}.json` |
| Full architecture map | `AGENTS.md` at the repo root (subsystems, 798 API routes, 420 tables) and `lango-app/CLAUDE.md` |
| Knowledge graph query | `cd lango-app && npx tsx scripts/graph-query.ts "hostel"` |

**Next.js here is newer than your training data.** Read `lango-app/node_modules/next/dist/docs/` before using a Next API you are unsure about.

## Rules the code must keep

- **API pipeline, in this order:** `requireRequestContext(req, [roles])` → `requireTenant(ctx)` → `requireCapability(ctx, 'perm')` → Zod `.strict()` body → tenant-scoped Drizzle query → `recordAudit()` → `apiErrorResponse()`.
- **Every query on tenant data filters `eq(table.tenantId, ctx.tenantId)`.** `npm run check:isolation` enforces it.
- **A sidebar link's permission must equal its page guard's capability.** Otherwise users bounce out of the app. Test: `src/libs/api/__tests__/nav-page-guard-parity.test.ts`.
- **Money:** use `libs/finance/definitions.ts` helpers (overdue = past due only, balance = net − paid, collected = posted net of refunds). Never invent a local formula.
- **Grades** are on the /20 scale with subject coefficients. Exam terms go `draft → open → locked → published`.
- **Moroccan compliance:** Law 09-08 (CNDP) for personal data and guardian consent on photos; CNSS/AMO/IR payroll; GSM-7 SMS with STOP opt-out.
- **No fake data on screens.** No hardcoded KPIs, no placeholder records. `npm run check:ui` is a ratchet: counts may only go down.
- **Code comments** explain why, not what. No chat formatting in code.

## Commands (run from `lango-app/`)

| Gate | Command |
|---|---|
| Types | `npm run check:types` |
| Tenant isolation | `npm run check:isolation` |
| UI reality ratchet | `npm run check:ui` |
| Missing translation keys | `node scripts/check-missing-i18n-keys.mjs` (must exit 0) |
| Tests (needs Postgres) | `npx vitest run <pattern>`; full suite `npm run test` |
| Screen check as a role | `AUDIT_BASE=http://localhost:<port> node scripts/visual-sweep.mjs <role> routes.txt out/` (read-only; `NO_LOGIN=1` for public pages) |

A passing API test does not prove the screen works. Open the page as the role that uses it.

## Shared machine: do not break other agents

- **Databases** (Docker container `lango_postgres`): `schoolos` is the main dev DB; `schoolos_audit` is the seeded audit copy (all add-ons on, 37 logins, password `Admin123!`: `y.elamrani@atlas.ma` school_admin, `prof.01..20@atlas.ma` teachers, `accountant@`, `etudiant.0001@`, `parent.001..006@`, `ancien.eleve@`, `accueil@`, `securite@`, `bibliotheque@atlas.ma`, `superadmin@schoolos.ma` needs TOTP). Write test data only to `schoolos_audit`.
- **Dev servers:** each agent runs its own, on its own port and build folder, and claims the port first (`claim task:port-3444`). Example: `NEXT_DIST_DIR=.next-<agent> DATABASE_URL=<...>/schoolos_audit BETTER_AUTH_URL=http://localhost:3444 NEXT_PUBLIC_APP_URL=http://localhost:3444 npx next dev -p 3444`. Never kill a process you did not start. Ports 3111 and 3222 belong to long-running agents.
- **Production** (`43.157.17.129`, schoolos.epioso.com): never build or run `npm run build` on the VPS; deploy only via `npm run deploy:vps` after a human asks.

## The work queue

- **Audit, one file per page and per finding:** `lango-app/docs/audit/page-audit/README.md` (337 pages, 58 findings). Each finding file has evidence, cause, fix, plan and a "Done when" test. Each page file has screenshots and a checklist.
- **Do not edit the generated audit files** to mark progress. Progress lives in the hub (`.agent-hub/BOARD.md`).
- Older root files (`AGENT-TASK-QUEUE.md`, `AGENT-TASK-LOG.md`, `AGENT-HANDOFF.md`) are history. The queue was found to contain tasks marked Done that were not done; that is why the hub requires proof and a second agent's verification.
