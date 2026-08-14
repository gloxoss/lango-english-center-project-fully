# Custom Domain Per School — Implementation Plan

> Read `future-implementation/_shared/APP-CONTEXT-AND-UI-SYSTEM.md` FIRST. Read the source spec `CUSTOM-DOMAIN.md` in this same folder — its product logic (super-admin approval list, school-admin request form, subdomain-vs-custom-domain distinction) is already sound and is not repeated here. This plan confirms the technical starting point against the real codebase and resolves the one sequencing question the source doc left open.

## 1. Confirmed against the real codebase — this is genuinely new infrastructure, not a CRUD feature

`src/middleware.ts` (46 lines, read in full) does zero hostname-based routing today — it only prefixes a locale onto `/dashboard`/`/login` paths and gates `/dashboard*` on a session cookie. Tenant resolution happens entirely downstream, per-request, via `auth.api.getSession()` → `tenantId`. There is no `tenantDomains`-style table anywhere in `src/models/Schema.ts` (confirmed by grep). `docker-compose.yml` defines only `db`, `clamav`, `app` (bound directly to a host port), and a one-shot `migrate` — **no reverse proxy exists anywhere in this repo** (no Caddyfile, no nginx config). The source doc's technical assessment is accurate on every point — this really is new routing infrastructure plus a real deployment-topology change, not a page and a table.

## 2. Resolving the sequencing question — the doc's own concern is smaller than it looks

The source doc says "don't start this before subscription-licensing's plan-tier gating is decided." Checked `subscription-licensing/SUBSCRIPTION-AND-LICENSING-SYSTEM.md`: it confirms `tenants.planTier` (`trial`/`basic`/`standard`/`premium`) **already exists in the schema today**, just never enforced anywhere. The full subscription-licensing system (license keys, payment history, per-addon activation) is a much bigger, separately-scoped, not-yet-started effort — but the one thing custom-domain actually needs (a plan-tier check) doesn't require any of that. **Decision: gate on `tenants.planTier` directly** with a small `requirePlanTier(context, ['standard', 'premium'])` helper (same call shape as `requireCapability`, added to `src/libs/api/permissions.ts` or a sibling file) — this unblocks custom-domain now without waiting on subscription-licensing, and the gate can be swapped to check `addonActivations` later with a one-line change if/when that system ships, since the check is isolated to one helper function.

## 3. Scope decision — subdomain first, real custom domains as a documented phase 2

The source doc itself recommends this ("Recommend building subdomain support first; it's dramatically simpler and covers most of the value") — this plan follows that recommendation as the actual v1 boundary, not just a suggestion:

- **V1: subdomain support only** (`school.yourdomain.com`). One wildcard DNS record + one wildcard SSL cert, configured once at the infra level (outside this app's code — an ops/deployment task, not something the app provisions per-request). Sub-domain requests can be auto-approved per the source doc's own business logic.
- **V2 (documented, deferred): fully independent custom domains.** Needs per-domain DNS verification (TXT record challenge), per-domain SSL provisioning, and the harder ops story the source doc flags (Caddy's automatic per-domain HTTPS is the concrete mechanism, but adopting it is a real infra decision affecting the whole deployment, not just this feature — confirm current deployment topology with whoever owns ops before touching `docker-compose.yml`'s network/port topology).

This keeps the schema and business logic (`tenantDomains`, request/approval flow) identical across both phases — only the verification and cert-provisioning mechanics differ, so v1 doesn't need to be redone for v2, just extended.

## 4. Schema

New `src/features/platform/models/domains-schema.ts` (or `src/features/tenancy/`, matching wherever this codebase's other cross-tenant-but-not-addon-specific platform concepts live — check for precedent before picking a location):

- `tenantDomains`: `id`, `tenantId`, `domain` (unique across the whole table, not just per-tenant — two tenants can never claim the same hostname), `domainType` (`subdomain` | `custom`), `status` (`pending` | `verified` | `approved` | `rejected`), `verificationToken` (for the TXT-record challenge, v2 only — null for subdomains), `requestedAt`, `requestedById`, `approvedAt`, `approvedById`, `createdAt`, `updatedAt`.

Follow the shared reference doc's schema/migration conventions exactly (barrel export, hand-written migration, idempotent `CREATE TYPE` if using a pgEnum for `status`/`domainType`).

## 5. Middleware change — the highest-risk part of this plan

`src/middleware.ts` needs a new early branch: read `request.headers.get('host')`, check it against `tenantDomains` (approved + verified rows only) before falling through to the existing session-based path. This is a genuinely load-bearing change to a file every single request passes through — treat it with the same care as a security-sensitive route, not a routine edit:

- The lookup must be fast (this runs on every request) — cache the domain→tenant mapping (in-memory with a short TTL, or check whether this codebase already has any request-level or edge caching precedent) rather than hitting the database on every single request unconditionally.
- A hostname with no matching `tenantDomains` row must fall through to the existing default behavior unchanged — this feature is additive, it must never break the current shared-domain access path for tenants who haven't set up a custom domain.
- Middleware runs in the Edge runtime in Next.js by default — confirm whether a direct Drizzle/`pg` DB call is even possible there, or whether this needs to go through a lightweight fetch to an API route, or whether this app's middleware already opts out of Edge runtime (check `export const config` / `runtime` export at the bottom of the current `middleware.ts` before assuming either way).

## 6. Pages

Both already fully specified in the source doc (`CUSTOM-DOMAIN.md` §"Page-by-page business logic") — build them verbatim: `/dashboard/super-admin/domains` (cross-school approval list) and a request form inside the school's own settings (e.g. `/dashboard/settings/domain`). Follow the shared UI system doc's conventions (KPI banner, real fetch, correct `Badge` variants for status). The school-admin side must show live status (pending / verification instructions / approved + link) per the source doc's explicit "honest status visibility, not a black-box request" requirement.

## 7. Suggested build order

1. Schema + migration (§4).
2. `requirePlanTier` helper (§2) — small, unblocks the rest.
3. Request/approval API routes + both pages (§6) — build and verify these fully functional BEFORE touching middleware, using a manually-inserted test `tenantDomains` row to prove the approval flow works end to end.
4. Middleware change (§5) — the risky part, done last and in isolation, with the rest of the feature already proven correct so any bug is isolated to the routing change itself.
5. Live-verify hostname resolution with a real `/etc/hosts` entry or local DNS override pointing a test subdomain at the dev server, not just by unit-testing the lookup function.

## 8. Acceptance checklist

- [ ] A request for a hostname with no `tenantDomains` row behaves identically to today (zero regression on the existing shared-domain path) — this is the single most important test in this whole plan.
- [ ] A verified, approved subdomain correctly resolves to its tenant and only that tenant, confirmed with a real request against a real hostname mapping.
- [ ] Two different tenants' custom domains never cross-resolve, even adversarially (request tenant A's approved domain, confirm it never somehow serves tenant B's data).
- [ ] Plan-tier gating actually blocks a `trial`/`basic` tenant from requesting a domain, and the check is easy to find and swap to `addonActivations` later (confirm it's isolated to one helper, not scattered).
- [ ] `tsc --noEmit` and `check-tenant-isolation.ts` clean (same 3-file baseline) — and confirm the isolation script's static analysis even covers middleware.ts, since that file sits outside the usual `src/app/api/**` pattern it scans; if not, that's a real blind spot worth flagging, not silently accepting.
