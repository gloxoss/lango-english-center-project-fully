# Custom Domain Per School — Future Feature

**Status: not started, deliberately deferred.** Genuinely new infra
capability — this app currently has zero domain-based routing. Read
`AGENT-HANDOFF.md` first for overall project state, and
`future-implementation/subscription-licensing/` — this feature is a direct
extension of that same "sell SchoolOS as a SaaS across Morocco and
internationally" goal, not a standalone idea.

## What the reference screenshot shows

One RamomSchool page, shared 2026-08-01 (not saved to this repo — inline
in the conversation that produced this doc): a **super-admin-only**
"Custom Domain" list. Columns: School Name, the real underlying system
URL ("Origin Url", e.g. `ramomcoder.com/saas/iconschool`), the custom
domain granted (e.g. `iconschool.ramomcoder.com`), Domain Type ("Sub
Domain" shown; presumably a fully-independent-domain option exists too),
Request Date, Approved Date, Status (Approved), and an edit action.

## Who sees what

- **Super-admin (platform operator):** this exact approval list, across
  every school on the platform.
- **A school's admin:** a simple self-service "request a custom domain"
  form somewhere in their own settings — never the full cross-school list.
- **End users at a school** (teachers/parents/students): never see any
  admin UI for this — they just get a branded login address instead of a
  generic shared one.

## Why a school would want this

Ties directly to the stated goal in `subscription-licensing/`: once
SchoolOS is sold to many independent schools rather than run for just the
2-3 tenants it has today, each school wants to feel like it's *their own*
system, not a shared tool with someone else's branding in the URL. A
custom/branded address (`portal.votre-ecole.ma` instead of a generic
shared domain) is a standard expectation once selling to organizations
that care about their own identity — genuinely useful for the same
audience the subscription/licensing work targets, not a separate market.

## The real technical starting point (verified, not assumed)

Checked `src/middleware.ts` directly: **this app currently has zero
domain-based routing.** Every school shares the exact same URL — which
tenant you're in is determined purely by `auth.api.getSession()` resolving
your logged-in account's `tenantId`, never by what hostname you visited.
This is a meaningfully different starting point than a lot of "add a
feature" work in this codebase — it's not a new table plus a new page,
it's new *routing infrastructure*.

## What would actually need building

1. **Hostname-based tenant resolution.** `src/middleware.ts` would need
   to read the incoming request's `Host` header, look up which tenant
   that hostname belongs to (new `tenantDomains` table: tenantId, domain,
   verified, createdAt), and inject that into the request context instead
   of (or alongside) session-based resolution. This is a real change to a
   load-bearing file every request passes through — needs careful testing
   against tenant isolation, not a quick add.
2. **DNS + SSL, and this is the part that's harder on self-hosted
   infrastructure than it would be on a platform like Vercel that
   provisions custom-domain SSL automatically.** This app runs on Docker
   Compose. The realistic path: put a reverse proxy in front of the app
   that can provision Let's Encrypt certificates dynamically per
   incoming hostname (Caddy is the standard choice for this — automatic
   HTTPS per domain with no manual cert management — simpler to operate
   than hand-rolling certbot automation on top of Nginx). Whoever builds
   this should confirm current deployment topology first
   (`SERVER_SETUP_AGENT_PROMPT.md`, `docker-compose.yml`) rather than
   assume.
3. **Subdomain-of-platform vs fully-independent-domain are different
   problems.** A subdomain (`school.yourdomain.com`) only needs one
   wildcard DNS record + one wildcard SSL cert, set up once. A school's
   own independent domain needs per-domain DNS instructions for the
   school to follow (point a CNAME at you) and per-domain certificate
   provisioning — more support burden, but the more premium-feeling
   option. Recommend building subdomain support first; it's dramatically
   simpler and covers most of the value.
4. Super-admin approval UI (the screenshot's page) + school-admin request
   form — standard CRUD, no new patterns needed once the routing/infra
   piece above exists.

## Page-by-page business logic (implementation-ready detail)

### 1. Super-Admin Domain List (`/dashboard/super-admin/domains`)

- Columns per the reference screenshot: school name, origin URL (the
  real underlying system address), custom domain, domain type (Sub
  Domain / Custom Domain), request date, approved date, status
  (Pending/Approved/Rejected), edit action.
- **Business logic**:
  - A **Sub Domain** request (`school.yourdomain.com`) can plausibly be
    **auto-approved** — it's just a `tenantDomains` row plus a wildcard
    DNS/cert that already covers it, no new infrastructure per request.
  - A **Custom Domain** request (the school's own domain) needs manual
    verification before approval — confirm the school actually controls
    that domain (standard approach: give them a TXT record to add, only
    mark `verified: true` once it's detected) before provisioning SSL for
    it, otherwise anyone could claim a domain they don't own.
  - "Edit" action lets the super-admin change status or re-trigger
    verification, not freely rewrite the domain string on an approved
    record (that should require going through the request flow again).

### 2. School-Admin "Request Custom Domain" form (implied by the reference product, not directly shown — belongs in the school's own settings)

- Single field: desired domain (or subdomain slug, if choosing the
  sub-domain path). Submits a request row with status `pending`.
- **Business logic**: show the school their current status inline
  (Pending / Verification instructions if a custom domain / Approved +
  the live link) rather than a fire-and-forget form with no feedback —
  matches this app's established pattern of honest status visibility
  (e.g. the excuse-review workflow, the register-lock status banners)
  rather than a black-box request.
- If a custom (non-subdomain) domain: show the exact DNS TXT record the
  school needs to add, and a "Verify now" button that re-checks rather
  than making them wait for the super-admin to notice — reduces manual
  super-admin toil for the case that can actually be self-service-verified.

## Addon or plan-tier gate?

Unlike 2FA (where paywalling basic security felt wrong), gating *branding
polish* behind a paid tier is normal, reasonable SaaS practice — this is
the one future feature so far where following the reference product's
"premium feature" framing is fine. Recommend: plan-tier gate (e.g.
`standard`+) once `tenants.planTier` gating is actually wired up per
`subscription-licensing/`, rather than the `src/addons/registry.ts`
model — it's a single always-on-or-off platform capability per tenant,
not a self-contained optional module like Inventory or Hostel.

## Sequencing note

This is naturally a **follow-on to `subscription-licensing/`**, not
independent of it — plan-tier gating needs to actually exist before
"gate this by plan tier" means anything. Don't start this before that
decision is made.
