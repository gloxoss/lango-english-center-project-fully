# Findings & Decisions

## Requirements
- Follow `CLAUDE.md` and `PRODUCT-TRUTH.md` as target-product authority.
- Use `insperations/eschool_saas_full_schema.sql` and `insperations/eschool-saas-codebase` as business-logic references.
- Make the application dynamic and persist business workflows through real APIs.
- Apply API security, tenant isolation, authorization, validation, and business invariants throughout.
- Maintain a passing TypeScript/Next.js production build and Docker image.

## Research Findings
- The application is Next.js App Router with Drizzle/PostgreSQL schema support.
- `/api/students` and `/api/users` were recently moved to PostgreSQL but currently resolve a seeded default tenant, not an authenticated tenant.
- The repository is already broadly dirty/untracked; changes must stay narrowly attributable.
- TypeScript, the two migrated GET handlers, the Next.js production build, and Docker build passed on 2026-07-29 after casing and optional-public-directory fixes.
- `PRODUCT-TRUTH.md` explicitly treats the current code as a prototype and is authoritative over older plans.
- v1 roles are school admin/director, teacher, and accountant/finance staff, plus platform super-admin. Student, parent, receptionist, and guard login are not v1.
- Teacher authorization is assignment scoped; accountants must have no academic-data access; school admins have full access only inside their tenant.
- Core v1 domains are student lifecycle, classes/groups, attendance, Moroccan `/20` grading, flexible fees/invoices/payments, timetable, staff, documents/certificates, and SMS communication.
- Attendance must support school-configured daily and per-session modes; academic periods are school configurable; fee schedules support monthly, termly, annual, and custom structures.
- French, Arabic RTL, and English are launch requirements. Excel import is a primary onboarding workflow. Massar and WhatsApp are excluded from v1.
- The reference SQL defines tenant-scoped academic years, periods, mediums, sections, streams, shifts, classes, subjects, student enrollment/subjects/promotions, staff assignments, attendance/timetables, and fees/payments with foreign keys and uniqueness constraints.
- The supplied reference SQL is labeled “48 tables” but its current file ends after `fees_paids`; controller/model inspection is needed for business behavior and any schema omitted from this extract.
- The PHP reference contains 105 HTTP files, 99 models, 193 repositories, and explicit middleware for authentication, role checks, school status, and per-school database switching.
- The target currently has 14 API route files. Only `/api/students` and `/api/users` use Drizzle/PostgreSQL; teacher, admissions, guardian, promotion, transfer, photo, matricule, optional-subject, settings, and access-reset routes are prototype/static handlers.
- `/api/auth/me` returns a hard-coded mock session token. No target middleware or central authorization layer was found.
- The target schema already contains many domain tables (academic periods, programs/courses, assessment plans/results, attendance, groups/enrollments, fees/invoices/payments, guardians, rooms/timetable, documents), so initial work should secure and expose existing structures before adding duplicates.
- `better-auth`, `bcryptjs`, and `zod` are installed, and Better Auth-compatible `user`, `account`, `session`, and `verification` tables exist, but application auth wiring is absent.
- Current role enum contains obsolete v1 roles and omits accountant; a migration and compatibility strategy are required before enforcing the authoritative role matrix.
- The installed Better Auth 1.6.18 package exposes a Drizzle adapter, Next.js handler integration, and server-side `auth.api.getSession({ headers })` suitable for central request authentication.
- The current server environment has a committed fallback Better Auth secret. Production must require an externally supplied secret; build-time handling must not become a deploy-time credential.
- The ESchool API selects a tenant database from a `school-code` header before resolving the bearer token. The target shared-database design must instead derive tenant identity from the authenticated user to avoid forged-header tenant confusion.
- Protected context must reject expired/missing sessions, inactive users, inactive tenants, and tenantless non-super-admin users.
- Better Auth login, signed session cookies, anonymous denial, tenant isolation, strict mutation validation, and self-delete protection have been verified against live PostgreSQL.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Central request context for user, tenant, and permissions | Prevents ad hoc tenant selection and inconsistent route security. |
| Zod-style allowlist validation at API boundaries | Protects business invariants and blocks mass assignment. |
| Transactions for multi-record business workflows | Admissions, promotions, invoices, and payments must not partially apply. |
| Explicit API DTO mapping | Avoids leaking database/security fields and keeps UI contracts stable. |
| Restrict roles to the PRODUCT-TRUTH v1 matrix | The existing seven-role prototype conflicts with the authoritative product decision. |
| Encode teacher assignment and finance-domain checks in authorization helpers | Role-only checks cannot enforce teacher object-level boundaries. |
| Make request authentication/authorization the first code slice | Every subsequent dynamic route otherwise repeats the current default-tenant vulnerability. |
| Never accept tenant ID/slug from protected request bodies or headers | Tenant scope is an authorization fact derived from the authenticated principal. |
| Require `DATABASE_URL` and a 32+ character `BETTER_AUTH_SECRET` at runtime | Silent credential/database defaults are unsafe in production and dedicated installs. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Code graph skill backend is unavailable | Fall back to scoped filesystem and Git analysis. |

## Resources
- `C:/Users/oussama/oussama/OneDrive - 雪玲团队/Documents/lango/CLAUDE.md`
- `C:/Users/oussama/oussama/OneDrive - 雪玲团队/Documents/lango/PRODUCT-TRUTH.md`
- `C:/Users/oussama/oussama/OneDrive - 雪玲团队/Documents/lango/insperations/eschool_saas_full_schema.sql`
- `C:/Users/oussama/oussama/OneDrive - 雪玲团队/Documents/lango/insperations/eschool-saas-codebase`

## Visual/Browser Findings
- None.
