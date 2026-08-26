> **STATUS (2026-08-25): All four parts confirmed done — independently verified against live code, not taken on the executing agent's word.** Every claimed file was read and checked line-by-line: `subscription-gate-logic.ts` is real and correctly wired into both `context.ts` and the dashboard layout; both new Part A tests exist and are well-constructed (subscription-enforcement covers all 5 blocked statuses + super_admin bypass + `allowSuspended`; license-expiry-worker covers suspend + audit + idempotent re-run); `decidePayment()` is now genuinely wrapped in one `db.transaction`; the onboarding gate covers every dashboard route via the shared layout; the accept-invitation rollback bug is fixed correctly (the expiry-status update now happens before the transaction opens, not inside it); all three test-contract fixes are in place; the Better-Auth-org-plugin decision is documented in `Schema.ts`; the Stripe-customer race is fixed with a real atomic `WHERE stripe_customer_id IS NULL` claim + cleanup-on-loss; webhook idempotency is real (`processed_stripe_events` table, check-before-process/record-after-success ordering); the state-transition test covers all 4 events plus a genuine replay-is-a-no-op assertion. Fresh `npm run check:types`: 0 errors. Tuition-payments isolation confirmed (zero cross-imports either direction, `stripe-provider.ts` untouched since before this work started).
>
> **One real caveat the completion report understated:** of the 43 tests across the 5 new/DB-dependent test files, only 8 (the 2 files that don't need a live DB) actually *ran* in this environment — the other 35 correctly `describe.skipIf`-skip because Postgres is still down here, they didn't fail. "100% passing" is accurate for what executed, but most of the new coverage is verified by careful code reading in this audit, not by actual test execution yet — re-run the full suite once Postgres is up to get real green checkmarks on all 43, not just 8.
>
> Minor, non-blocking nit found: `decidePayment()`'s audit-log `action` field always logs `'extend'` even on a tenant's very first license issue (`result.license.issuedAt` is always truthy on both the insert and update paths, so the ternary never resolves to `'issue'`). Cosmetic — doesn't affect the transaction correctness or any financial state, just the audit-log wording. Fix whenever convenient.

# Agent Execution Prompts — SaaS Billing Fixup (close the audit findings)

Four standalone, copy-pasteable prompts closing every finding from the verified audit of
`AGENT-EXECUTION-PROMPTS-SAAS-BILLING.md`'s Parts A-D. Every item below was independently
re-confirmed against live code (and, where testable, by actually running the test suite) —
this isn't a re-audit, it's the fix list for real, confirmed gaps. See the conversation
history / the audit report for the full evidence trail per item.

**Before dispatching:** none of the code fixes below require Postgres/Docker to be running,
but several of the *verify* steps do (the license-expiry worker cycle, live signup/invite
flow, Stripe test-mode checkout). If Docker Desktop is still down, the agent should make
the code changes and the fixable tests pass, then clearly flag which verify steps it
could not run and why — don't let a DB outage block finishing the code itself.

**Run order:** Part A should go first — it introduces the shared `isSubscriptionBlocked()`
helper that Part D's fix also depends on. B and C are independent of A and of each other.
Part D's one shared-gate item is a no-op once Part A lands (noted in D's prompt).

---

## PART A — Close the enforcement-gate gaps

**Copy everything below this line into your agent:**

```
# App Context — SchoolOS

You are working in a real, partially-built production codebase: SchoolOS, an enterprise multi-tenant school-management SaaS.

**Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Drizzle ORM + Postgres, Better Auth. Runs via Docker Compose.

**Standing API route convention:** requireRequestContext(req, [allowedRoles]) → requireTenant(context) → requireCapability(context, 'module.action') → Zod .strict() schema → tenant-scoped Drizzle query → recordAudit() on mutations → apiErrorResponse() catch-all.

**Build verification:** `docker compose build app` is authoritative, not `tsc --noEmit` alone. Never `cd`. Touch only what's listed below.

---

# Background — confirmed findings to fix

A prior pass built subscription/license enforcement into `src/libs/api/context.ts::requireRequestContext` (line ~70), which correctly blocks on `['past_due', 'unpaid', 'canceled', 'suspended', 'cancelled']` for every non-super_admin role. This was independently verified as correct.

**The bug**: `src/app/[locale]/(dashboard)/layout.tsx` (line ~58) has its own, separate, narrower check — it only recognizes `'suspended'` and `'cancelled'`. A tenant whose Stripe subscription is `past_due`, `unpaid`, or `canceled` (American spelling, what Stripe actually sends) sails past the dashboard's visual gate and then gets a raw `402 SUBSCRIPTION_SUSPENDED` on the first API call the page makes — broken screens instead of the intended renewal-prompt UX. Verified by reading both files directly; this is real, not a false positive.

Also missing: no automated test proves (a) the license-expiry sweep (`src/features/subscriptions/services/license-expiry-worker.ts`) actually flips a tenant to suspended, (b) every non-super_admin role gets 402 when suspended and super_admin doesn't.

# Your tasks

1. **Extract one shared source of truth.** Create `src/libs/subscriptions/subscription-gate-logic.ts` (or a similarly obvious location — your call, but it must be importable from both a server API context file and a Next.js layout) exporting a single function, e.g. `isSubscriptionBlocked(status: string | null): boolean`, that returns true for exactly `['past_due', 'unpaid', 'canceled', 'suspended', 'cancelled']`. Import and use this function in BOTH:
   - `src/libs/api/context.ts`'s existing check (replace the inline array with a call to the shared function — behavior must not change).
   - `src/app/[locale]/(dashboard)/layout.tsx`'s `subscriptionSuspended` computation (replace `=== 'suspended' || === 'cancelled'` with a call to the same shared function).
   This is the actual fix — one array, two call sites, impossible to drift apart again.

2. **Test the license-expiry worker.** Add a test for `src/features/subscriptions/services/license-expiry-worker.ts`'s core sweep function — given a `schoolLicenses` row with `status: 'active'` and `expiresAt` in the past and no qualifying paid renewal, confirm the tenant's `subscriptionStatus` gets set to `'suspended'` and an audit row is written. Follow this codebase's existing test conventions (check `src/features/settings/__tests__/scheduled-jobs.test.ts` for the pattern used for other worker/job logic).

3. **Test the enforcement gate itself.** Add a test (or extend an existing `tenant-isolation.test.ts`-style test) that, for a tenant with `subscriptionStatus: 'suspended'`, confirms every non-super_admin role gets `402 SUBSCRIPTION_SUSPENDED` from `requireRequestContext`, and confirms `super_admin` is unaffected. Reuse whatever test-DB/fixture setup pattern the rest of the test suite already uses.

**Do not touch:** `src/libs/payments/` (tuition Stripe, unrelated), the actual list of blocked statuses (only extract it, don't change which statuses are blocked).

**Verify:** run the new tests. If Postgres is reachable, also manually set a tenant's `subscriptionStatus` to `'past_due'`, confirm the dashboard now redirects/shows the suspended screen (not a broken partial page) AND the API still returns 402 — both paths agreeing. If Postgres is not reachable, say so explicitly and report which verify steps you could complete vs. not.

**When done:** run the build, report file paths changed/added, and confirm no existing route/page regressed.
```

---

## PART B — Close the manual-provisioning gaps

**Copy everything below this line into your agent:**

```
# App Context — SchoolOS

[Use the identical "App Context" block from Part A above. Not repeated here — copy it verbatim if handing this to a fresh agent session.]

---

# Background — confirmed findings to fix

Two real gaps were independently verified in `src/features/subscriptions/services/subscription-service.ts`:

1. **`decidePayment()` (line ~370) is not transactional.** On approval, it calls `extendLicense()` (line ~286, itself two separate un-transactioned `db.update()` calls — `schoolLicenses` then `tenants`), then does a *third* separate `db.update(licensePayments)` to mark the payment `'paid'`. If the process fails between the license being extended and the payment row being marked paid, the tenant ends up with an active/extended license while the payment request is stuck showing `'pending'` forever — a real financial-consistency risk (a school could look unpaid while actually having full access, or vice versa depending on where the failure lands).

2. **The onboarding-completeness redirect only protects the dashboard landing page, not every dashboard route.** It currently lives in `src/app/[locale]/(dashboard)/dashboard/page.tsx` (imports `isSchoolOnboardingComplete` from `src/features/settings/services/onboarding-completeness.ts`, redirects to `/dashboard/settings/onboarding` if incomplete). But `src/app/[locale]/(dashboard)/layout.tsx` — which wraps every single route under `(dashboard)`, and already contains the `SubscriptionGate`/redirect logic for the billing gate — does NOT run this check. A freshly-provisioned school_admin who deep-links or bookmarks any other dashboard URL (e.g. `/dashboard/students`) skips the onboarding wizard entirely.

# Your tasks

1. **Wrap `decidePayment()`'s approval path in a single `db.transaction`.** Move the `extendLicense`/`issueLicense` call and the final `licensePayments` status update inside one transaction so they succeed or fail together. Since `extendLicense`/`issueLicense` are exported functions also called elsewhere (check call sites before changing their signatures), the cleanest fix is likely: either (a) add a transaction-aware variant of `extendLicense`/`issueLicense` that accepts a `tx` client instead of `db`, and have `decidePayment` construct one `db.transaction` that calls the tx-aware versions plus the final payment update, or (b) inline the license-extension logic directly inside `decidePayment`'s transaction if extracting a tx-aware helper is awkward given the existing call sites. Pick whichever keeps the diff smaller — don't refactor `extendLicense`/`issueLicense`'s other callers unnecessarily.

2. **Move the onboarding-completeness check into `(dashboard)/layout.tsx`**, alongside (not replacing) the existing subscription-status gate, so it applies to every dashboard route, not just the index page. Keep the existing check in `dashboard/page.tsx` too if removing it would change other logic there — but the layout-level check is the one that actually closes the gap; make sure `/dashboard/settings/onboarding` itself is exempted from its own redirect (same pattern the subscription gate already uses to keep the renewal page reachable while suspended — check how `layout.tsx` currently keeps its own settings page exempt, and mirror it).

3. **Add a test for the redirect flow**: incomplete school → any dashboard route redirects to onboarding → complete the required fields → the same route no longer redirects.

**Do not touch:** `src/app/api/super-admin/schools/route.ts` (already correct/transactional — no changes needed there), anything in `src/libs/payments/` (tuition Stripe, unrelated).

**Verify:** if Postgres is reachable, manually trigger a `decidePayment` approval and confirm license + payment update together (can't test the failure-injection scenario easily by hand — the transaction wrapping itself is the fix, trust the DB's atomicity guarantee once it's actually in a `db.transaction`). Create a fresh incomplete-onboarding tenant, confirm a deep-linked dashboard route (not just the landing page) redirects to onboarding, confirm it stops redirecting once the required fields are filled. If Postgres is not reachable, say so explicitly and report what you verified vs. couldn't.

**When done:** run the build, report file paths changed, confirm no existing route/page regressed.
```

---

## PART C — Close the self-serve signup gaps

**Copy everything below this line into your agent:**

```
# App Context — SchoolOS

[Use the identical "App Context" block from Part A above. Not repeated here — copy it verbatim if handing this to a fresh agent session.]

---

# Background — confirmed findings to fix

All of the following were independently re-verified — either by reading the exact lines cited, or by actually running the test suite (`npx vitest run src/app/api/public/__tests__/signup-and-invitations.test.ts`), which really does fail 9/9 for the reasons below.

1. **The invitation route doesn't send email.** `src/app/api/settings/invitations/route.ts` generates a token and returns `inviteUrl` in the response; the UI (`users-roles-client.tsx`) copies that link to the clipboard for the admin to send manually. There is no actual email-delivery call anywhere in the flow, despite the feature being described as "invite-by-email."

2. **The test suite's DB-availability guard is fake.** `src/app/api/public/__tests__/signup-and-invitations.test.ts:26-27` does `const hasDb = Boolean(process.env.DATABASE_URL); describe.skipIf(!hasDb)(...)` — this checks whether the env var is *set*, not whether Postgres is actually *reachable*. When `DATABASE_URL` is set but Postgres is down (the exact situation during this audit), the suite runs anyway and every test fails with a connection error, not a clean skip.

3. **The test suite's response-contract assertions don't match the real routes**, independent of the DB issue — these would still fail once Postgres is up:
   - Tests assert `json.code` — the real shape (from `apiErrorResponse()`, `src/libs/api/errors.ts`) is `json.error.code`.
   - Tests assert `response.status` is `201` for invitation creation — the route returns the default `200` (no explicit status set), consistent with how every other creation route in this codebase behaves (e.g. `super-admin/schools` POST also returns default 200) — this is this codebase's real, established convention, not a bug in the route.
   - Tests assert `json.data.inviteUrl` — the route returns `inviteUrl` at the top level of the response, not nested under `data`.

4. **A real logic bug in the accept-invitation route**: `src/app/api/public/invitations/[token]/accept/route.ts` (around line 50-56) — when an invitation has expired, it updates the row's `status` to `'expired'` *inside* the same `db.transaction` it then throws out of. Drizzle rolls back the entire transaction on a thrown error, including that status update. Net effect: the invitation row silently stays `'pending'` in the database forever, even though every acceptance attempt correctly reports "expired" to the caller.

5. **No documented decision on Better Auth's `organization` plugin.** The custom `tenant_invitations` table/routes work structurally (aside from bug #4), but there's no record of whether Better Auth's built-in organization plugin (which ships its own org/member/invitation Drizzle schema) was evaluated and deliberately not used, or just not considered.

# Your tasks

1. **Fix the accept-invitation rollback bug first — this is the highest-value fix here.** The expiry-status update must survive even when the accept attempt fails. Do the `status: 'expired'` update as its own separate statement *before* opening the main transaction (or in its own tiny transaction), and only throw the `INVITATION_EXPIRED` error after that update has actually committed — not inside the transaction you're about to roll back.

2. **Fix the test suite's DB guard.** Replace the `Boolean(process.env.DATABASE_URL)` check with something that actually verifies connectivity — e.g. attempt a lightweight query (`db.execute(sql`select 1`)` or equivalent) in a `beforeAll`/module-level async check wrapped in try/catch, and skip based on whether that succeeds, not just whether the variable is set. Check if any other test file in this codebase already has a real DB-reachability check you can reuse instead of inventing a new one.

3. **Fix the three response-contract mismatches in the test file** (`json.code` → `json.error.code`, `toBe(201)` → `toBe(200)`, `json.data.inviteUrl` → `json.inviteUrl`) — align the tests to the real, working route behavior. Do not change the routes themselves to chase a stricter REST convention; the routes are consistent with the rest of this codebase as they are.

4. **Add real email delivery, or be honest that it isn't there.** Check `src/libs/` for an existing email-sending helper (used for password reset / verification emails, if any exist) and reuse it to actually send the invite link to `email` on creation. If no email provider is wired up anywhere in this codebase yet, do NOT invent a new email service dependency for this alone — instead, rename the UI/response language from "invitation sent" to accurately say "invitation link generated" (check `users-roles-client.tsx` and the route's `message` string) so the product doesn't claim to do something it doesn't. Report clearly which path you took and why.

5. **Add a tenant-isolation test** for the self-serve signup flow: create a tenant via `POST /api/public/signup`, confirm it cannot read/see any other tenant's data through any authenticated route as that new tenant's admin.

6. **Document the Better Auth organization-plugin decision.** Spend a bounded amount of time (don't rabbit-hole) checking whether Better Auth's `organization` plugin could cleanly replace the custom `tenant_invitations` table/routes given this codebase's `tenants`-as-organization model. If it's a large migration, don't do it — just write a short comment/note (in `Schema.ts` near `tenantInvitations`, or a short doc file next to `PLATFORM-SAAS-READINESS-PLAN.md`) explaining the decision to keep the custom implementation, so it's a documented choice instead of an unexplained gap. If it turns out to be a trivial swap, you may do it — your judgment call, but justify it either way in the report.

**Do not touch:** `src/app/api/super-admin/schools/route.ts` (manual path, unrelated), the `slug` field being optional in the signup schema (this is an intentional, accepted UX improvement over the original spec — leave it as-is).

**Verify:** run the full test file — it should now pass (fully, if Postgres is reachable; report clearly if it still can't run due to DB unavailability, but the contract/logic fixes themselves should be confirmable via the corrected assertions once DB access exists). Manually test: create an invitation, let it expire (or manipulate `expiresAt` directly), attempt to accept it twice, confirm the row now actually shows `'expired'` in the database on the first failed attempt (not still `'pending'`).

**When done:** run the build, report file paths changed, and the new test results.
```

---

## PART D — Close the platform-billing gaps

**Copy everything below this line into your agent:**

```
# App Context — SchoolOS

[Use the identical "App Context" block from Part A above. Not repeated here — copy it verbatim if handing this to a fresh agent session.]

---

# Background — confirmed findings to fix

The RBAC guard on billing routes (`requirePlatformBillingAdmin` in `src/features/subscriptions/services/platform-billing-service.ts:14`) was independently verified as correctly implemented and tested (`billing-routes-authz.test.ts`, 2/2 passing) — this is NOT one of the gaps, it's confirmed done right. The dashboard-gate status-list mismatch that affects this part is fixed by Part A's `isSubscriptionBlocked()` extraction — if Part A has already landed, there is nothing further to do for that specific item here; if it hasn't, do Part A's task 1 first or coordinate with whoever is running it, since duplicating that fix in two places is exactly the bug being closed.

Two real, independently-verified gaps remain, both in `src/features/subscriptions/services/platform-billing-service.ts`:

1. **No lock/guard around lazy Stripe-customer creation.** `getOrCreateCustomer()` (line ~38-54) reads `tenant.stripeCustomerId`, and if null, creates a new Stripe Customer and writes it back — with no protection against two concurrent requests (e.g. a double-click, or two tabs) both observing `null` and both creating separate Stripe customers for the same tenant.

2. **No webhook idempotency.** `src/app/api/webhooks/stripe-platform/route.ts` records `stripeEventId: event.id` into the audit log on each processed event, but nothing checks whether that `event.id` was already processed before re-applying the update. Stripe explicitly guarantees at-least-once delivery and recommends deduplicating by event ID — a retried webhook delivery (which Stripe does routinely) will currently reprocess the same subscription-status update and write a duplicate audit entry every time.

Also missing (lower priority, largely environment-blocked rather than code-blocked — do what you can, flag what you can't): no webhook state-transition tests (checkout completed → subscription updated → subscription deleted → payment failed, asserting the DB ends up in the right state after each); migration 0134 hasn't actually been applied to a running database; no live Stripe test-mode checkout/cancellation has been exercised.

# Your tasks

1. **Fix the concurrent-customer-creation race.** Add a unique constraint if one doesn't already exist on `tenants.stripeCustomerId` (check the migration that added it, `0134_add_platform_stripe_billing.sql`) is not sufficient alone since the race is in the create-then-write sequence, not the column itself. The simplest correct fix: wrap the check-then-create-then-update sequence so a second concurrent caller re-checks `tenant.stripeCustomerId` again immediately before creating (or use a DB-level advisory lock keyed on `tenantId`, or an `UPDATE ... WHERE stripe_customer_id IS NULL RETURNING id` pattern to claim the "creator" role atomically, then have the loser re-read and use whatever the winner wrote). Pick the smallest change that actually closes the race — this doesn't need to be elaborate, just correct.

2. **Add webhook idempotency.** Add a small table (e.g. `processed_stripe_events`: `eventId text primary key, processedAt timestamp`) or reuse an existing suitable mechanism if one already exists elsewhere in this codebase for a similar purpose (check first). At the top of the webhook handler, after signature verification, check whether `event.id` has already been recorded; if so, return success immediately without reprocessing. Record it only after successfully applying the event's effect (so a genuine failure can still be retried by Stripe, but a successfully-processed event is never reapplied). This will need its own migration — check `migrations/` for the next available number immediately before writing, don't hardcode one.

3. **Add webhook state-transition tests.** For `src/app/api/webhooks/stripe-platform/route.ts`, add tests (mocking/constructing Stripe event payloads, not hitting real Stripe) asserting: `checkout.session.completed` correctly links `stripeCustomerId`/`stripeSubscriptionId` to the tenant; `customer.subscription.updated` correctly syncs `tenants.subscriptionStatus` to each of Stripe's status strings; `customer.subscription.deleted` sets `'cancelled'`; `invoice.payment_failed` results in the mapping this codebase already chose (check what it currently maps to); and that replaying the same `event.id` twice only applies the effect once (proves task 2's fix).

**Do not touch:** `src/libs/payments/stripe-provider.ts`, `src/libs/payments/provider.ts`, or their existing webhook route (tuition payments — a completely separate product/concern, unrelated to this task).

**Verify:** run the new webhook tests. If Postgres is reachable, apply the new idempotency migration and confirm `docker compose build migrate` succeeds. Actual Stripe test-mode checkout/cancellation and the 0134 migration's live application both require Stripe test credentials and a running Postgres respectively — if either isn't available in your environment, say so explicitly rather than skipping silently, and list exactly what still needs a human to run once those are available.

**When done:** run the build, report file paths changed, new migration number used (if any), and confirm the tuition-payments flow is completely untouched.
```
