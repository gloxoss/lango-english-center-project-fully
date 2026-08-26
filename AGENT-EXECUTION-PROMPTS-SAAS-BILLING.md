# Agent Execution Prompts — Platform SaaS Readiness

Four standalone, copy-pasteable prompts implementing `schoolos-app/future-implementation/subscription-licensing/PLATFORM-SAAS-READINESS-PLAN.md` — built from a full audit of 5 open-source multi-tenant SaaS boilerplates (`ixartz/SaaS-Boilerplate`, `nextacular/nextacular`, `boxyhq/saas-starter-kit`, `sudharsangs/nextjs-multitenant-saas-boilerplate`, `saasfly/saasfly`, cloned into `insperations/saas-billing-references/`).

**Priority — read before dispatching:**
- **Part A and Part B are the recommended work.** They close a real, live gap (nothing currently enforces subscription/license status) using only what already exists. Small-to-Medium effort. Do these regardless of anything else.
- **Part C and Part D (self-serve signup + platform Stripe billing) are planned but *not yet decided*.** The plan document's explicit recommendation is to keep manual, sales-assisted school provisioning as the primary model — none of the 5 reference repos' self-serve flows were mature enough to justify switching, and our existing bank-transfer license-approval workflow already matches how this kind of software is actually sold in Morocco. Only dispatch C/D if you've decided you actually want open self-serve signup. They're written and ready either way.

**Suggested use:** Part A and Part B touch different files and can run fully in parallel with each other and with anything else. **Part C and Part D both add Drizzle migrations — do not run them literally simultaneously against the same working tree** unless you're comfortable resolving a migration-number collision by hand; run them sequentially, or have whichever starts second check `migrations/` fresh immediately before writing its migration file (both prompts already say this).

---

## PART A — Unified subscription/license enforcement gate

**Copy everything below this line into your agent:**

```
# App Context — SchoolOS

You are working in a real, partially-built production codebase: SchoolOS, an enterprise multi-tenant school-management SaaS.

**Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Drizzle ORM + Postgres, Better Auth. Runs via Docker Compose.

**Multi-tenant isolation is non-negotiable.** Every query, every API route, every page must filter by tenantId/school_id.

**Standing API route convention:** requireRequestContext(req, [allowedRoles]) → requireTenant(context) → requireCapability(context, 'module.action') → Zod .strict() schema → tenant-scoped Drizzle query → recordAudit() on mutations → apiErrorResponse() catch-all.

**Build verification:** `docker compose build app` is authoritative, not `tsc --noEmit` alone. Run `docker compose build migrate` too if you add a migration (separate image, separate cache — this bit a prior session hard, see `MIGRATION-NOTES.md`).

**Command discipline:** Never `cd`. Touch only what's listed below — no adjacent refactors.

---

# Background

`src/libs/api/context.ts`'s `requireRequestContext` is the single choke point every authenticated request passes through. Today it only checks `tenants.isActive` (`principal.tenantActive`) — it does NOT check `tenants.subscriptionStatus` (enum: active/suspended/cancelled, `src/models/Schema.ts:70`) or whether the tenant's license (`schoolLicenses` table, `src/models/Schema.ts:3126`) has actually expired. Both fields exist and are computed for display (`deriveLicenseStatus()` in `src/features/subscriptions/services/subscription-service.ts:49`) but nothing blocks a request based on them. A tenant could be fully expired/suspended and every user in it would still have complete, unrestricted access.

This was confirmed by auditing 5 open-source multi-tenant SaaS boilerplates — most of them had the exact same gap (or worse), but the one lesson worth carrying over is: **do this check in exactly one place**, the same place `tenants.isActive` is already checked, not scattered per-route.

# Your tasks

1. **Extend `requireRequestContext`** (`src/libs/api/context.ts`, look around lines 41-60): add `tenantSubscriptionStatus: tenants.subscriptionStatus` to the existing `.select()` (it already joins `tenants` for `tenantActive`). Add a new check, for every role except `super_admin`: if `tenantSubscriptionStatus === 'suspended'` OR `'cancelled'`, throw `new ApiError(402, 'SUBSCRIPTION_SUSPENDED', 'Abonnement suspendu. Contactez votre administrateur.')`. Keep the existing `TENANT_DISABLED` check for `isActive` as a separate, distinct error code — they mean different things (hard admin kill-switch vs. billing lapse) and the frontend should be able to render different messaging for each.

2. **Add a license-expiry sweep job.** Follow the exact existing pattern in `src/features/settings/services/settings-worker.ts` (a singleton `setInterval` poller, guarded by a `started` boolean, registered in `src/instrumentation.ts` inside the `NEXT_RUNTIME === 'nodejs'` block, wrapped in try/catch so a failure never blocks server startup). Create a new small worker (e.g. `src/features/subscriptions/services/license-expiry-worker.ts`) that, on each poll (once every few hours is enough — this isn't latency-sensitive), finds every `schoolLicenses` row where `status = 'active'` and `expiresAt` has passed with no corresponding recent `licensePayments` row in `status = 'paid'` extending it, and sets the matching `tenants.subscriptionStatus` to `'suspended'`. Use `recordAudit()` with a system actor for each transition (check how other system-initiated audit entries are recorded elsewhere in the codebase — grep `recordAudit` call sites for a non-request-context example, or use a minimal synthetic context if that's the established pattern). Register the new worker in `src/instrumentation.ts` next to `startSettingsWorker()`.

3. **Frontend handling for the new error code.** Find wherever `TENANT_DISABLED` is currently handled client-side (the existing `isActive`-blocked screen/redirect) and add equivalent handling for `SUBSCRIPTION_SUSPENDED` — a distinct screen/message pointing the school_admin toward the renewal flow (`requestRenewal` in `subscription-service.ts` — check whether it already has a UI, and if not, at minimum link to wherever the super-admin-facing subscription management screens are; a full renewal UI is out of scope for this task, just don't leave suspended schools looking at a raw JSON error).

**Do not touch:** anything in `src/libs/payments/` (parent-tuition Stripe, unrelated), anything under `future-implementation/subscription-licensing/reference-screenshots/`.

**Verify:** manually set a test tenant's `subscriptionStatus` to `'suspended'` in the DB, confirm every role except `super_admin` gets a `402 SUBSCRIPTION_SUSPENDED` on any API route, confirm `super_admin` is unaffected, confirm the frontend shows a real message instead of a raw error. Manually set a `schoolLicenses` row's `expiresAt` to yesterday with `status: 'active'` and no paid renewal, confirm the new worker flips the tenant to `suspended` within one poll cycle (trigger it manually / reduce the interval for testing, then restore it).

**When done:** run the build, report what you built with file paths, and confirm no existing route/page regressed.
```

---

## PART B — Finish the manual provisioning path's rough edges

**Copy everything below this line into your agent:**

```
# App Context — SchoolOS

[Use the identical "App Context" block from Part A above. Not repeated here — copy it verbatim if handing this to a fresh agent session.]

---

# Background

SchoolOS's real provisioning model (and the one the platform plan recommends keeping as primary) is manual/B2B: a super_admin creates a school via `POST /api/super-admin/schools` (`src/app/api/super-admin/schools/route.ts` — already transactional: tenant + admin user + credential account in one `db.transaction`, already audited via `recordAudit`), then billing runs through a bank-transfer-first ledger: `src/features/subscriptions/services/subscription-service.ts` already has `requestRenewal()` (school-initiated) and `decidePayment()` (super-admin approve/reject) working against the `schoolLicenses`/`licensePayments` tables. What's unclear is whether the *school-facing* side of this is actually wired to a real UI yet, or only exists as backend functions.

# Your tasks

1. **Audit first, then build only what's missing.** Check `src/features/subscriptions/ui/` and any `dashboard/settings/subscription` or similar school-admin-facing route for whether `requestRenewal()` is callable from a real screen (a "Renew Subscription" button/form a school_admin can actually use) and whether `listTenantPayments()`/`getSubscriptionDetail()` (both in `subscription-service.ts`) back a real "Payment History" + "School Details" view for the school itself (not just the super-admin's cross-tenant view). The reference for what this screen should look like already exists in this repo: `future-implementation/subscription-licensing/SUBSCRIPTION-AND-LICENSING-SYSTEM.md` and its `reference-screenshots/` (match SchoolOS's own Slate/Blue design system, do NOT copy the reference screenshots' visual style — see that doc's explicit note on this). If this already exists and works end-to-end, say so and stop here for this item — do not rebuild something that's already done.

2. **Onboarding-completeness redirect.** If a super_admin creates a fresh school (via the route above) and its `school_admin` logs in for the first time, check whether they're forced through a "complete your school's setup" flow (logo, address, academic year — check `school-onboarding-view.tsx` for what fields already exist there from prior session work) before reaching the main dashboard. If this redirect doesn't exist, add it: a simple check (e.g. a `schoolSettings` completeness flag, or checking whether core required fields are still null) in the dashboard's server-side layout/page-guard that redirects to the onboarding wizard until complete. Keep this small — reuse the existing onboarding UI, don't build a new one.

**Do not touch:** `src/app/api/super-admin/schools/route.ts` itself (already correct, transactional, audited — no changes needed there), anything in `src/libs/payments/` (parent-tuition Stripe, unrelated).

**Verify:** as a school_admin on a tenant with an expiring/expired license, confirm a real renewal request can be submitted and shows up for a super_admin to approve/reject; as a super_admin, confirm approving it extends the license and (once Part A is deployed) un-suspends the tenant. Create a fresh test school via the super-admin route, log in as its admin for the first time, confirm the onboarding-completeness redirect fires if the fields are empty and stops firing once they're filled in.

**When done:** run the build, report what you found already built vs. what you actually had to add, with file paths.
```

---

## PART C — Self-serve tenant signup

**Only dispatch this if you've decided you want open self-serve signup — see the priority note at the top of this file. Not currently recommended as the default path.**

**Copy everything below this line into your agent:**

```
# App Context — SchoolOS

[Use the identical "App Context" block from Part A above. Not repeated here — copy it verbatim if handing this to a fresh agent session.]

---

# Background

Today, tenant creation is 100% manual via `POST /api/super-admin/schools` (super_admin-only). This task builds a second, public, self-serve path alongside it — it must NOT replace or modify the existing manual route, which stays as the primary B2B provisioning path per this plan.

This was informed by auditing 5 open-source SaaS boilerplates (full detail in `insperations/saas-billing-references/*-AUDIT.md`). The most relevant lesson: `sudharsangs/nextjs-multitenant-saas-boilerplate`'s self-serve flow has a real bug — company creation and subscription creation are two separate client-side fetches with no shared DB transaction, so a failure between them leaves an orphaned company. Do not repeat that. Also check its `companies/route.ts` dedupe-check bug (`||` used between Drizzle SQL condition objects instead of `or(...)` — silently only checks the first field) as an example of what NOT to write when you do your own uniqueness checks.

# Your tasks

1. **Check Better Auth's organization plugin first**, before hand-rolling anything. Better Auth ships an official `organization` plugin with its own Drizzle schema (org/member/invitation tables) — if it can be adopted to treat our existing `tenants` table (or a thin wrapper around it) as the "organization," it will cover a meaningful chunk of what's below (invite-by-email, membership, roles) and should be preferred over custom tables. Report clearly which parts you used the plugin for vs. hand-built, and why, if you end up hand-building instead.

2. **Migration — check `migrations/` immediately before writing**, pick the next available sequential number (do not hardcode a number from this prompt; another agent or session may have already claimed one). Add, if not covered by the Better Auth plugin: a `tenant_invitations` table — `id uuid pk, tenantId fk tenants.id, email text, role text, token text unique, status text (pending/accepted/revoked/expired), invitedById fk user.id, expiresAt timestamp, createdAt timestamp`. Run `docker compose build migrate` after adding it (separate image/cache from `app` — see `MIGRATION-NOTES.md`).

3. **`POST /api/public/signup`** — public route, no `requireRequestContext` (no tenant/session exists yet). Zod `.strict()` body: `{ schoolName, slug, adminName, adminEmail, adminPassword }`. In one `db.transaction`: check slug uniqueness (use `or()` correctly, not `||`, if checking multiple fields), create the Better Auth user, create a `tenants` row (`planTier: 'trial'`, `subscriptionStatus: 'active'`, `isActive: true`), create the `user` row (`role: 'school_admin'`), create a `schoolLicenses` row with a real trial `expiresAt` (14-30 days out — pick one and note your choice) so Part A's enforcement/expiry-sweep has something real to act on later. `recordAudit()` at the end. `apiErrorResponse()` on failure — and make sure a failure partway through actually rolls back (this is the exact bug to avoid).

4. **Signup UI + invite-by-email UI.** A public signup form (school name, admin name/email/password) posting to the route above. A tenant-admin-facing "invite a teammate" screen (email + role) using the `tenant_invitations` table (or the Better Auth plugin's equivalent), plus an accept-invite landing page for the invited person.

5. **Onboarding-completeness redirect** — reuse/extend whatever Part B built (if Part B ran first) or build it fresh: a freshly self-signed-up tenant should land in the same "complete school setup" flow before the main dashboard.

**Do not touch:** `src/app/api/super-admin/schools/route.ts` (the manual path stays as-is, unmodified, as the primary provisioning route).

**Verify:** sign up a brand-new school end-to-end through the public form, confirm a partial failure (simulate one, e.g. a duplicate slug mid-flow) leaves no orphaned rows, confirm the new school_admin can immediately log in and reaches the onboarding-completeness flow, confirm inviting a teammate by email and accepting the invite correctly links them to the same tenant with the right role, confirm tenant isolation holds (the new tenant can't see any other tenant's data).

**When done:** run the build, report what you built with file paths and new migration number used.
```

---

## PART D — Platform Stripe billing (charging schools, not parents)

**Only dispatch this alongside or after Part C — see the priority note at the top of this file. Not currently recommended as the default path.**

**Copy everything below this line into your agent:**

```
# App Context — SchoolOS

[Use the identical "App Context" block from Part A above. Not repeated here — copy it verbatim if handing this to a fresh agent session.]

---

# Background

This is platform-side billing — SchoolOS charging a school a subscription fee — which is a completely different concern from `src/libs/payments/stripe-provider.ts`/`provider.ts`, which already exist and handle *parents paying school tuition*. **Do not modify those files or reuse the same Stripe webhook endpoint** — different product, different Stripe customer per concern, and conflating them risks one webhook misprocessing the other's events. Build a new, separate `src/libs/payments/platform-billing-provider.ts`.

This coexists with, and does not replace, the existing manual bank-transfer license ledger (`schoolLicenses`/`licensePayments`, `src/features/subscriptions/services/subscription-service.ts`) — most schools will likely keep paying by bank transfer per the existing super-admin-approval workflow; Stripe is an additional path for tenants that want to pay by card, most plausibly ones that signed up via Part C's self-serve flow. Whichever path last updates `tenants.subscriptionStatus` is authoritative — Part A's enforcement gate doesn't care which path wrote it.

This was informed by auditing 5 open-source SaaS boilerplates (full detail in `insperations/saas-billing-references/*-AUDIT.md`). Two concrete lessons to apply, not just read:
- **BoxyHQ's `saas-starter-kit` has a live RBAC bug**: its checkout-session, portal-link, and products routes check only "is this user a team member," never the `team_payments` permission its own permission model defines as OWNER-only — so any team member can hit billing endpoints. Every billing route you write below must independently check tenant-admin role, not just tenant membership. Write a test asserting a non-admin tenant role gets 403.
- **Every reference repo's webhook handler was thin** — `saasfly` only handles `checkout.session.completed`/`invoice.payment_succeeded` and stubs subscription-updated with a `console.log`; `nextacular` only handles `charge.succeeded`; `boxyhq` handles create/update/delete but stores only a boolean `active` instead of Stripe's real status string. Do not repeat any of these gaps.

# Your tasks

1. **Migration — check `migrations/` immediately before writing**, pick the next available sequential number (do not hardcode one; check fresh, and coordinate with Part C if it ran first/concurrently — don't collide on the same number). Add to `tenants`: `stripeCustomerId text unique`, `stripeSubscriptionId text unique`, `stripePriceId text`, `stripeCurrentPeriodEnd timestamp`. Run `docker compose build migrate` after.

2. **`src/libs/payments/platform-billing-provider.ts`** — new Stripe client/helpers scoped to platform billing only, separate from the tuition-payments provider.

3. **`POST /api/tenant/billing/checkout-session`** and **`POST /api/tenant/billing/portal-session`** — `requireRequestContext(['school_admin'])` PLUS an explicit tenant-admin-only permission check (this is the BoxyHQ lesson — do not skip it, and write the 403 test for a non-admin role). Lazily create/reuse a Stripe Customer tied to `tenants.stripeCustomerId`. Checkout session in `mode: 'subscription'` with `metadata: { tenantId }` (or `client_reference_id`) so the webhook can correlate back. Portal session for existing subscribers to manage/cancel.

4. **`POST /api/webhooks/stripe-platform`** — separate route, separate signing secret from the existing tuition webhook. No `requireRequestContext` (Stripe calls this without a user session — verify via `stripe.webhooks.constructEvent` with the raw body only). Handle, at minimum, all of: `checkout.session.completed` (link `stripeCustomerId`/`stripeSubscriptionId` to the tenant), `customer.subscription.updated` (sync **Stripe's actual status string** — `active`/`trialing`/`past_due`/`canceled`/`unpaid` — into `tenants.subscriptionStatus`, don't infer paid-ness from a period-end date like saasfly does), `customer.subscription.deleted` (`subscriptionStatus: 'cancelled'`), `invoice.payment_failed` (map to `suspended` or a distinct dunning state — your call, but don't silently drop this event like every reference repo did). `recordAudit()` with a system actor on each processed event.

**Do not touch:** `src/libs/payments/stripe-provider.ts`, `src/libs/payments/provider.ts`, or their existing webhook route (tuition payments — unrelated product).

**Verify:** using Stripe test mode, complete a checkout session for a test tenant, confirm the webhook correctly sets `stripeCustomerId`/`stripeSubscriptionId`/`subscriptionStatus: 'active'`; cancel the subscription in Stripe test mode, confirm the webhook flips `subscriptionStatus` to `'cancelled'` and (with Part A deployed) the tenant actually gets blocked; confirm a non-admin tenant role gets 403 on both billing routes; confirm the tuition-payments webhook and this new platform-billing webhook never process each other's events even when both are configured against the same Stripe test account (test with metadata disambiguation).

**When done:** run the build, report what you built with file paths, new migration number used, and confirm the tuition-payments flow is completely untouched and still works.
```
