# SchoolOS — Current State Handoff (2026-08-26)

Written for a developer, partner, or agent joining with no prior context.
Everything here was verified on 2026-08-26 at commit `b0c9124`.

## 1. What this is

A multi-tenant school operating system for the Moroccan market — a single
platform where a school runs admissions, students, guardians, academics,
timetabling, attendance, grading, finance/accounting, HR/payroll, library,
hostel, transport, events, communication, and reporting. A platform operator
(`super_admin`) provisions and licenses schools; each school
(`school_admin`) then operates independently with its own users and data.

The reference model is ESchool SaaS v1.6.0 (PHP), whose schema and business
logic live in `insperations/` and are consulted when building modules.

## 2. Where to find things

```
lango-english-center-project-fully/
├── lango-app/                  ← the actual application ("schoolos")
│   ├── src/app/[locale]/(dashboard)/dashboard/   ← 318 dashboard pages
│   ├── src/app/api/                              ← 788 API route handlers
│   ├── src/features/<module>/                    ← ui/ services/ models/ per module
│   ├── src/libs/api/          ← context, permissions, page-guard, validation
│   ├── src/models/Schema.ts   ← single Drizzle schema file (432 tables)
│   ├── migrations/            ← 138 SQL migrations + meta/_journal.json
│   ├── src/scripts/seed-full.ts ← the comprehensive demo seed
│   └── locales/{ar,en,fr}.json  ← 51 keys, largely unused (see §7)
├── docs/audit/2026-08-26/     ← this audit
└── insperations/              ← ESchool reference schema + PHP codebase
```

## 3. Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind + shadcn/ui ·
Drizzle ORM · PostgreSQL 17 · better-auth · ClamAV (upload scanning) · Docker Compose.
Node ≥24 required. npm (not pnpm/yarn).

## 4. The conventions that matter

**Every API route follows this shape:**
```ts
requireRequestContext(req, [roles])   // authn + role allowlist
  → requireTenant(context)            // tenant scope from SESSION, never client
  → requireCapability(context, 'x.y') // fine-grained permission
  → Zod .strict() validation
  → tenant-scoped Drizzle query
  → recordAudit()
  → apiErrorResponse() on throw
```

**Every page must carry a server guard.** Prefer:
```ts
await requireServerPage(locale, { requiredCapability: 'students.read' });
```
Do **not** add new pages using `allowedRoles: [...]` alone — that is the
drift-prone legacy pattern (see §7, D-1).

**Multi-tenancy:** every tenant-scoped table has `tenant_id`; it must always be
derived from the authenticated session. Only `super_admin` routes may accept a
`tenantId` from the client.

## 5. Running it

```bash
cd lango-app
docker compose up -d db          # Postgres on localhost:5432
npm ci --legacy-peer-deps
npm run db:migrate               # 138 migrations → 432 tables
npm run db:seed:full             # demo tenant "Groupe Scolaire Atlas"
npm run dev                      # http://localhost:3000
```

Full Docker stack: `docker compose up -d` (db + clamav + migrate + app).
Note the production image build is CPU-heavy; `next.config.ts` caps build
workers to 2 (`experimental.cpus`) after a build caused a thermal shutdown.

## 6. Demo credentials

Password for **all** accounts: `Admin123!`
Tenant: *Groupe Scolaire Atlas* (200 students, 20 teachers, full module data).

| Role | Email |
|---|---|
| super_admin | `superadmin@schoolos.ma` |
| school_admin | `y.elamrani@atlas.ma` |
| accountant | `accountant@atlas.ma` |
| teacher | `prof.01@atlas.ma` … `prof.20@atlas.ma` |
| student | `etudiant.0001@atlas.ma`, `.0051`, `.0101`, `.0151` |
| parent | `parent.001@atlas.ma` … `.006` (001–004 linked to real children) |
| librarian | `bibliotheque@atlas.ma` |
| guard | `securite@atlas.ma` |
| receptionist | `accueil@atlas.ma` |
| alumni | `ancien.eleve@atlas.ma` |

Librarian/guard/receptionist/alumni accounts were added manually — they
authenticate and reach their portals, but **have no seeded history**, so those
portals appear empty.

Deployed instance: `https://schoolos.epioso.com` (Tencent VPS, shared with four
unrelated production apps — see D-9).

## 7. What you must know before changing anything

| # | Issue | Why it matters to you |
|---|---|---|
| D-1 | 226 pages gate on hardcoded `allowedRoles`; nav gates on capability | Change a permission and the nav updates but the page doesn't → "link visible, redirects home". Use `requiredCapability` for anything you touch. |
| D-5 | Shared endpoints return privileged fields to lesser roles | 3 finance leaks to `teacher` found+fixed; ~780 routes unswept. If you open a route to a new role, **trim the response shape too**. |
| D-2 | `npm run check:isolation` green ≠ tenant-safe | It never scans `db.insert` and only checks token proximity. Don't trust it as proof. |
| D-6 | 0 of 354 components use i18n | `/ar` and `/en` render French. Don't assume translation exists. |
| D-3/D-4 | Test suite can't exit 0; 75% skips without a DB | Always run tests with Postgres up. Don't build a CI gate on the exit code yet. |
| D-7 | Migration journal was broken (fixed) | Local dev DBs created before 2026-08-26 are **not** schema-identical to a fresh migrate — they still have `sms_templates`. |
| D-9 | VPS is at ~90% RAM with 4 other clients' apps | A careless deploy there can take down unrelated production services. |

## 8. Where the product decisions are unresolved

1. Is the 10-role surface intended v1 scope, or should it narrow for pilot?
2. Is the parent portal in v1? (a written brief says no; the code says yes)
3. Final brand: **SchoolOS** (product/UI) vs **Lango** (repo, paths, images)?
4. Hosting / CNDP Law 09-08 data residency — currently a Tencent VPS, never
   assessed, needs legal input.
5. Is ClamAV required for pilot? It holds ~25% of VPS RAM.

## 9. Honest assessment

The foundations are good — the permission model, tenant scoping, audit logging,
and API conventions are better than typical for this stage, and 1772 tests pass.

But this audit verified **structure**, not **behaviour**. No screen was opened,
no workflow run end to end. The systemic patterns found (guard drift, per-role
response leaks) are the kind that generate defects continuously until the
pattern itself is fixed — so expect partner testing to surface more, especially
in "does this actually work end to end" territory.

Treat it as: solid architecture, real functionality, **unproven behaviour**.
Good for supervised partner testing. Not ready for real student, guardian, or
financial data.
