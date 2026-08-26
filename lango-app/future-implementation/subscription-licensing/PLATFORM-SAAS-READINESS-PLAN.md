# Platform SaaS-Readiness Plan — self-serve signup, real enforcement, platform billing

**Built from:** a full audit of 5 open-source multi-tenant SaaS boilerplates, cloned into
`insperations/saas-billing-references/` and read line-by-line against our own code
(not just their READMEs). Each repo has its own `<name>-AUDIT.md` in that folder with
exact file paths and code excerpts — this document is the synthesis + the actual plan.
Repos audited: `ixartz/SaaS-Boilerplate`, `nextacular/nextacular`, `boxyhq/saas-starter-kit`,
`sudharsangs/nextjs-multitenant-saas-boilerplate`, `saasfly/saasfly` — all MIT/Apache-2.0,
free to port patterns from.

**Supersedes nothing, extends `SUBSCRIPTION-AND-LICENSING-SYSTEM.md`.** That doc's plan
#4 has since been substantially built (see "What already exists" below) — this doc picks
up from there and is scoped specifically to the three gaps identified when we asked
"can we start giving schools access?": self-serve signup, real enforcement, platform billing.

---

## 0. The one finding that changes the shape of this plan

Every single one of the 5 reference repos was weaker than our own codebase on the thing
we thought we were missing. Concretely:

- **3 of 5 repos have *zero* subscription-status enforcement** (Nextacular, BoxyHQ,
  saasfly) — a cancelled/expired subscription leaves full product access untouched.
  BoxyHQ additionally has a live RBAC hole: any team *member* (not just the owner) can
  hit its Stripe checkout/portal endpoints, because those three routes forgot the
  permission check every other mutating route in the same file remembers.
- **saasfly has no org/tenant model at all** — its billing is 1:1 with a single user.
- **sudharsangs' repo has real self-serve signup**, but company-creation and
  subscription-creation are two separate client fetches with no DB transaction (an
  orphaned-company bug waiting to happen), a broken dedupe query (`||` instead of
  `or()` between Drizzle conditions — silently only checks one field), and its
  `subscriptions` table hardcodes plan limits at creation time instead of reading them
  from a catalog.
- **Our own `schoolLicenses` / `licensePayments` / `planLimits` / `addonEntitlements`**
  (`src/models/Schema.ts:3074-3189`) already out-class every reference repo's billing
  schema: transactional history (not a single mutable row), a real
  super-admin-approval workflow (`requestRenewal` → `decidePayment`, see
  `src/features/subscriptions/services/subscription-service.ts`), and a catalog table
  (`planLimits`) instead of copying limits onto each row.

**So the real gap was never "we have no SaaS billing logic."** It's narrower and cheaper
than the original question implied: **nothing in the request path actually reads any of
this and blocks access.** `requireRequestContext` (`src/libs/api/context.ts:58`) checks
only `tenants.isActive`. `schoolLicenses.status`/`expiresAt` and `tenants.subscriptionStatus`
are computed and displayed (`deriveLicenseStatus()` exists) but never enforced — confirmed
by grep: `schoolLicenses`/`licensePayments` are referenced in exactly one service file and
never in `context.ts`, `permissions.ts`, or any middleware.

This reframes priority. Section 1 below is small, closes a real risk, and should happen
regardless of any other decision. Sections 2 and 3 are genuine product decisions — not
"finish what's obviously unfinished."

---

## 1. Unified enforcement gate — do this first (Small, ~half a day)

Every reference repo that has *any* enforcement does it in exactly one place: the single
function every authenticated request already passes through. We have that function —
`requireRequestContext` in `src/libs/api/context.ts` — it's just not finished.

**Current code** (`src/libs/api/context.ts:41-60`, abbreviated):
```ts
const [principal] = await db.select({
  role: user.role, status: user.userStatus, name: user.name, email: user.email,
  tenantActive: tenants.isActive,
}).from(user).leftJoin(tenants, eq(user.tenantId, tenants.id))
  .where(and(eq(user.id, session.user.id), eq(user.userStatus, 'active')));
...
if (principal.role !== 'super_admin' && (!principal.tenantId || !principal.tenantActive)) {
  throw new ApiError(403, 'TENANT_DISABLED', 'Cet établissement est indisponible.');
}
```

**Change:**
1. Add `tenantSubscriptionStatus: tenants.subscriptionStatus` to the `.select()`.
2. Add a second condition (distinct error code, so the frontend can render a
   different screen than "disabled" — e.g. a "your school's subscription needs
   renewing" page with a link to the billing/renewal screen, vs. a hard "contact
   support" screen for `isActive: false`):
   ```ts
   if (principal.role !== 'super_admin' && principal.tenantSubscriptionStatus === 'suspended') {
     throw new ApiError(402, 'SUBSCRIPTION_SUSPENDED', 'Abonnement suspendu. Contactez votre administrateur.');
   }
   ```
3. **Decide what `cancelled` means** — every reference repo that had this concept
   (only ours, really) needs an explicit answer, not a guess: does `cancelled` behave
   like `suspended` (hard block), or get a grace period? Recommendation: treat
   `cancelled` the same as `suspended` for v1 — a tenant that reaches `cancelled` was
   already `suspended` first under this plan (see 1.4), so there's no path to
   `cancelled` without a prior warning period.
4. **Also close the loop the other direction**: `schoolLicenses.status`/`expiresAt`
   currently drive nothing. Either (a) have a scheduled job (see `src/libs/api/context.ts`'s
   sibling scheduled-jobs pattern, or `settings/__tests__/scheduled-jobs.test.ts` for the
   existing convention) flip `tenants.subscriptionStatus` to `suspended` when
   `schoolLicenses.expiresAt` passes with no paid renewal, or (b) fold the license-expiry
   check directly into `requireRequestContext` alongside the `subscriptionStatus` check.
   **(a) is cleaner** — keeps `requireRequestContext` a single cheap query, puts the
   "is this license actually current" logic in one scheduled place instead of on every
   request — and matches the existing `scheduled-jobs` pattern already in the codebase.

**Verify:** set a tenant's `subscriptionStatus` to `suspended` by hand, confirm every
role except `super_admin` gets `402 SUBSCRIPTION_SUSPENDED` on any route; confirm
`super_admin` is unaffected; confirm an expired `schoolLicenses` row flips
`subscriptionStatus` to `suspended` via the scheduled job within one run cycle.

---

## 2. Product decision — do we want self-serve signup at all?

This is the fork in the road every reference repo assumed the answer to without asking
it. **Recommendation, with reasoning — not a re-ask of something already answered
elsewhere:** given SchoolOS already has a deliberate, working **manual B2B model** —
super-admin creates the school (`POST /api/super-admin/schools`), issues a license,
and payment is settled by bank transfer with super-admin approval
(`requestRenewal`/`decidePayment`) — this matches how school-management software is
actually sold in Morocco (sales-assisted, invoiced, often bank-transfer, not
credit-card self-checkout). None of the 5 reference repos' self-serve flows are
mature enough to justify the switch on their own merits either: two don't really have
one (ixartz's is 100% Clerk-hosted UI with zero app-side logic to study; saasfly's is
disabled), and the one that does (sudharsangs) has a real transaction-safety bug in
the exact code you'd be copying.

**So: keep manual provisioning as the primary path.** Section 3 below exists so the
option is fully planned, not blocked — build it later, when/if there's evidence of
demand for open self-signup (e.g. inbound schools you don't have a sales relationship
with). Don't build it speculatively now.

**What's worth doing now, cheaply, is finishing the manual path's rough edges** —
these were flagged by comparing our real routes against the reference repos' more
complete (if less safe) versions:

- `POST /api/super-admin/schools` (`route.ts:67-125`) already wraps tenant + admin-user
  + credential creation in one `db.transaction` — this is already better than
  sudharsangs' two-separate-fetches bug. Nothing to fix here.
- Check whether `requestRenewal`/`decidePayment` (`subscription-service.ts:331,366`) are
  actually wired to a school-admin-facing UI yet, or if they're API-only — if the
  school-facing "Manage School" pages you referenced earlier
  (`SUBSCRIPTION-AND-LICENSING-SYSTEM.md`'s RamomSchool reference) aren't built, that's
  the real next increment, not new signup machinery.
- Borrow the **onboarding-completeness redirect** idea (sudharsangs' one genuinely
  reusable pattern): if a super-admin-created school's first login should force a
  "complete school setup" wizard (logo, address, academic year — the fields
  `school-onboarding-view.tsx` already has per earlier session work) before reaching
  the dashboard, that's a small, real UX improvement independent of self-serve signup.

---

## 3. Self-serve signup + platform Stripe billing — planned, not scheduled (Large)

Only build this if Section 2's decision changes. Kept here so the plan is complete,
per your request, and so a future "let's do it" doesn't start from zero.

### 3.1 Self-serve tenant signup
- **Schema**: no new tables required structurally — reuse `tenants` + `user`. Add a
  `tenant_invitations` table if we want in-app invite-by-email once a school has
  self-provisioned (mirrors Nextacular's `Member`/BoxyHQ's `Invitation` shape):
  `id uuid pk, tenantId fk, email text, role text, token text unique, status enum
  (pending/accepted/revoked/expired), invitedById fk, expiresAt timestamp, createdAt`.
- **New route**: `POST /api/public/signup` — public, no `requireRequestContext` (no
  tenant/session exists yet). Zod `.strict()` on `{schoolName, slug, adminName,
  adminEmail, adminPassword}`. In one `db.transaction` (do **not** repeat sudharsangs'
  two-fetch bug): create the Better Auth user → create `tenants` row
  (`planTier: 'trial'`, `subscriptionStatus: 'active'`, `isActive: true`) → create
  `user` row (`role: 'school_admin'`) → create a `schoolLicenses` row (trial, e.g.
  14-30 day `expiresAt`) so the Section 1 enforcement job has something real to expire
  → `recordAudit()`.
- **Better Auth**: check whether Better Auth's official `organization` plugin (it ships
  Drizzle schema for org/member/invitation) covers most of this before hand-rolling —
  every audited repo's custom invite/member code exists only because Clerk (which has
  this built-in) wasn't being used, or because the repo predates checking. If the
  plugin fits our `tenants`-as-organization model, this drops from Large to Medium.
- **Onboarding-completeness gate**: reuse the sudharsangs pattern — a session with a
  fresh trial tenant gets routed through the same "complete school setup" wizard
  flagged in Section 2, before the dashboard.

### 3.2 Platform Stripe billing (charging schools, not parents)
**Keep this fully separate from `src/libs/payments/stripe-provider.ts`/`provider.ts`**
— those handle parents paying school tuition; this is a different Stripe
customer/product per tenant. Every audited repo that had both concerns risked
conflating them; BoxyHQ and Nextacular both keep billing-customer creation isolated
per concern, which is the pattern to follow. New file:
`src/libs/payments/platform-billing-provider.ts`.

- **Schema** — add to `tenants`: `stripeCustomerId text unique`, `stripeSubscriptionId
  text unique`, `stripePriceId text`, `stripeCurrentPeriodEnd timestamp`. Critically,
  **store Stripe's actual subscription status string** in `tenants.subscriptionStatus`
  from the webhook payload (`active`/`trialing`/`past_due`/`canceled`/`unpaid`) —
  every reference repo that skipped this (saasfly infers "paid" from a period-end
  date instead) got it wrong; we already have the right enum shape, just keep it
  synced from source of truth instead of hand-set.
- **New routes**:
  - `POST /api/tenant/billing/checkout-session`, `POST /api/tenant/billing/portal-session`
    — `requireRequestContext(['school_admin'])` + explicit tenant-admin-only check.
    **This explicit check is not optional** — it's the exact line BoxyHQ's real,
    live security hole is missing (their three billing routes check team-membership
    but never the `team_payments` OWNER-only permission their own permission model
    defines). Write a test asserting a non-admin tenant role gets 403 here.
  - `POST /api/webhooks/stripe-platform` — separate signing secret from the tuition
    webhook. No `requireRequestContext` (Stripe calls this unauthenticated by
    session; verify via `stripe.webhooks.constructEvent` only). Handle, at minimum:
    `checkout.session.completed`, `customer.subscription.updated`,
    `customer.subscription.deleted`, `invoice.payment_failed` — every reference repo
    that shipped a webhook handled 2-3 events at most and left cancellation/dunning
    as a stub; don't repeat that, it's the single most-flagged gap across all 5 audits.
- **Reconciling with the existing manual ledger**: decide whether Stripe subscriptions
  and manual bank-transfer licenses coexist per-tenant (some schools pay by card,
  most by transfer) or whether Stripe is additive only for a future self-serve tier
  while enterprise/manually-onboarded schools stay on the existing
  `licensePayments` approval flow. Recommendation: **coexist** — `tenants.subscriptionStatus`
  is the single field either path writes to; `licensePayments` remains the ledger for
  manual payments, a new lightweight `stripe_events` audit table covers the automated
  path, and Section 1's enforcement gate doesn't care which path last updated the status.

**Verify** (once built): a fresh self-serve trial signs up, expires on schedule and
gets blocked by Section 1's gate without further code changes; a Stripe subscription
webhook correctly flips `subscriptionStatus`; a non-owner tenant role gets 403 on
billing routes; the tuition-payments Stripe webhook and the platform-billing Stripe
webhook never cross-process each other's events (test with both configured against
the same Stripe test account, using metadata to disambiguate).

---

## Priority summary

| # | Item | Effort | Do when |
|---|---|---|---|
| 1 | Unified `subscriptionStatus` + license-expiry enforcement in `requireRequestContext` | Small | Now — closes a real gap regardless of any other decision |
| 2 | Finish manual-path rough edges (renewal UI, onboarding-completeness redirect) | Small-Medium | Now/next — cheap, no new architecture |
| 3.1 | Self-serve tenant signup | Large | Only if/when demand for open signup is real |
| 3.2 | Platform Stripe billing | Medium-Large | Only alongside 3.1, or if manual bank-transfer billing becomes a bottleneck at scale |

Full per-repo detail, exact file paths, and code excerpts backing every claim above:
`insperations/saas-billing-references/{SaaS-Boilerplate,nextacular,saas-starter-kit,nextjs-multitenant-saas-boilerplate,saasfly}-AUDIT.md`.
