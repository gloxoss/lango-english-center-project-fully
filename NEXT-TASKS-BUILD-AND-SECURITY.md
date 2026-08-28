                                 # Next Tasks — Build Fix + Security Audit (queued, not yet actioned)

> **STATUS UPDATE (2026-08-25, later same day): items 1, H-1, H-2, and M-1 through M-5 are all done.** Dispatched via `AGENT-EXECUTION-PROMPTS-SECURITY-AND-TESTS.md` (Agent 1), then independently re-verified line-by-line against live code (not trusted from the agent's own report): the 4-file `db.execute` typo is gone (0 TypeScript errors, fresh run); H-1's sandbox callback now requires `ALLOW_PAYMENT_SANDBOX=true` outside dev and validates the body; H-2's hardcoded fallback key is gone, `getEncryptionKey()` throws if neither env var is set; M-1's OTP is SHA-256 hashed before storage and the raw code is never logged, even outside production; M-2's signup route is rate-limited (`checkRateLimit`); M-3's path-traversal guard is now a single shared `resolveTenantPath()` helper used by all three upload functions; M-4 was fixed across 24 write routes (the original "~22" was an estimate, not a count — 24 is the agent's real count, not independently re-verified in full by me); M-5's edge resolver now rate-limits and actually checks the `x-middleware-bypass` header instead of ignoring it. Attachments-book's missing `requireAddon` gate (cross-referenced from `NEXT-TASKS-ADDONS-AND-TEST-PLAN.md`) is also fixed, all 10 routes. Full test suite for the affected areas: 38/38 passing live against a real, reachable Postgres.
>
> **Still genuinely open from this file:** the four 🟡 Low items (no CSP header, no rate limit on `/api/auth/setup-account`, `contentTypeFor()`'s `image/jpeg` fallback, the ~220-routes coarse-role-gate count) — none of these were in Agent 1's scope. `npm audit` was also never run by Agent 1 — that's separately assigned to Agent 4 (currently in progress as of this note).

**Purpose of this file:** a holding area for verified, real problems found so far, so they can be batched into a proper fix plan (execution prompts, like `AGENT-EXECUTION-PROMPTS-SAAS-BILLING-FIXUP.md`) and run later — not now, per instruction. Every item below has been independently checked against live code, not taken on trust from whatever tool reported it. Where a claim turned out to be wrong, that's noted too, so nobody wastes time "fixing" something that isn't broken.

---

## 1. Build fix — 4-file typo (carried over from the SaaS-billing fixup work)

`npm run check:types` currently fails with 3 reported errors (a 4th identical instance exists but wasn't flagged by `tsc`). All four are the exact same mistake, in brand-new test files from the in-progress SaaS-billing fixup work:

- `src/app/api/public/__tests__/signup-and-invitations.test.ts:31`
- `src/features/subscriptions/services/__tests__/license-expiry-worker.test.ts:22`
- `src/features/subscriptions/services/__tests__/subscription-enforcement.test.ts:35`
- `src/app/api/webhooks/stripe-platform/stripe-webhook-transitions.test.ts:43`

All four call `db.execute({ sql: 'select 1', params: [] })` — not Drizzle's real API. Correct pattern, already used elsewhere in this codebase (`super-admin/health/route.ts:24`, `outbox-worker.ts:55`): `db.execute(sql\`select 1\`)`, using the `sql` template tag imported from `drizzle-orm`.

**Fix approach:** one-line change × 4 files. No design decision needed.

---

## 2. Security audit — verified findings (2026-08-25)

A full-codebase security review (788 API routes, RBAC, OWASP Top-10) was independently re-checked, finding-by-finding, against live code. Overall: this app's baseline security posture is genuinely strong (real tenant isolation with an AST checker, a real capability-based RBAC engine, real webhook signature verification on Stripe/live-classrooms, real magic-byte upload validation, zero `dangerouslySetInnerHTML`, an eval-free payroll formula parser) — the findings below are real gaps *on top of* that strong baseline, not a sign the baseline is weak.

### 🔴 High

**H-1 — CMI sandbox payment callback trusts the request body with zero verification**
`src/app/api/finance/payments/online/callback/route.ts` is an intentionally unauthenticated webhook (tenant resolved via `externalReference` lookup, provider verifies its own signature). Confirmed in `src/libs/payments/cmi-naps-provider.ts:40-49`: when `session.mode === 'sandbox'`, `verifyCallback` returns `status: 'paid'` straight from the caller-supplied `rawBody.status`/`amount` — no signature, no secret, no IP restriction. The code comment says so explicitly: *"the sandbox simulator is authoritative; signature verification is not a real security boundary here."* Live mode (line 51-63) is fine — it's genuinely not implemented yet (`GATEWAY_LIVE_PENDING`, correctly blocked). The risk is specifically: if a `paymentGatewaySessions` row can ever be in `mode: 'sandbox'` against real tenant/production data, anyone who can reach this endpoint with a matching `externalReference` can mark a real invoice paid.
**Fix direction:** refuse sandbox-mode callbacks unless a dev/staging environment flag is set, or require a shared sandbox secret even though it's "not a real boundary" today. Needs a decision on whether sandbox mode should even be reachable from a production deployment at all.

**H-2 — Hardcoded fallback encryption key**
`src/libs/api/secrets.ts:9-11` — confirmed: `process.env.ENCRYPTION_KEY || process.env.BETTER_AUTH_SECRET || 'schoolos-broadcast-secret-sentinel'`. The `BETTER_AUTH_SECRET` fallback is reasonable (already a required, ≥32-char secret per `docker-compose.yml:50`). The third fallback — a public, git-committed literal string — is the real problem: if both env vars are ever unset, tenant provider credentials (SMTP/broadcast connections) get encrypted with a key anyone can read from this file, making the "encryption" cosmetic.
**Fix direction:** throw at boot if neither `ENCRYPTION_KEY` nor `BETTER_AUTH_SECRET` is set, instead of silently falling back. Since `BETTER_AUTH_SECRET` is already enforced as required by `docker-compose.yml`, the realistic exposure window is narrower than "always exploitable" — but the fallback string should not exist regardless.

### 🟠 Medium

**M-1 — Two-factor OTP codes logged and stored in plaintext**
`src/libs/auth.ts:89-101` — confirmed: `console.log(`[2FA OTP] user=${user.id} email=${user.email} code=${otp}`)` plus a plaintext `otp` column insert into `twoFactorOtps`. The code's own comment admits this must not ship: *"Replace with a real email provider in production; do NOT keep writing plaintext OTPs to disk there."* This is a known, documented placeholder (log-only email delivery, same convention used for SMS elsewhere), not a hidden bug — but it's real and currently live.
**Fix direction:** wire a real email provider for OTP delivery (same shape as the honest SMS fallback design in `sms-delivery.ts`) and stop persisting the raw code — store a hash if a persisted record is needed for verification at all.

**M-2 — Public signup has no rate limit, no captcha, no email verification, and leaks account existence**
`src/app/api/public/signup/route.ts` — confirmed: no rate-limiting or captcha anywhere in the file, and `409 EMAIL_EXISTS` (lines 45, 87) is returned as a distinct response, meaning anyone can enumerate whether an email is already registered (across all tenants) just by attempting signup with it. Also confirmed: no email-verification step before a tenant/account is fully provisioned.
**Fix direction:** add rate-limiting (per-IP and/or per-email) to `/api/public/signup`, consider a generic response instead of a distinct `EMAIL_EXISTS` code (or accept the tradeoff explicitly — UX vs. enumeration risk is a real decision, not a pure bug), and decide whether email verification blocks first login or just gates certain actions.

**M-3 — Upload path-traversal gap on write/copy (read path is already protected)**
`src/libs/api/uploads.ts` — confirmed and precisely scoped: `readUploadedFile` (line 54-60) already validates the resolved path stays inside the tenant's directory (`.startsWith()` guard). `saveUploadedFile` (line 16-52) and `copyUploadedFile` (line 65-70) do **not** — `path.join(UPLOADS_ROOT, tenantId, subpath)` is used directly with no check that the caller-supplied `subpath` can't contain `../` segments that escape the tenant directory. Actual exploitability depends on whether any call site ever passes a caller-controlled `subpath` rather than a fixed, code-generated one — worth auditing call sites before treating this as maximum severity, but the shared helper itself has zero defense.
**Fix direction:** add the same `.startsWith()`-style guard (or a proper `path.resolve` + prefix check) to `saveUploadedFile` and `copyUploadedFile` that `readUploadedFile` already has — one shared internal helper used by all three would prevent this from drifting apart again.

**M-4 — Write routes that skip Zod validation (mass-assignment risk)**
Spot-checked one cited example, `src/app/api/addons/broadcast/templates/route.ts:22` — confirmed: `const body = await request.json();` with no schema validation before use. The audit claims ~22 such routes exist, concentrated in the broadcast addon, cards templates, and branches. Not independently re-counted in full this pass — the one spot-check confirmed the pattern is real, not that the exact count of 22 is accurate.
**Fix direction:** needs a fresh full-codebase grep for `request.json()` not immediately followed by a Zod `.parse()`/`.strict()` call, then add proper schemas following this codebase's own established `parseJson(request, schema.strict())` convention (used correctly everywhere else per this session's repeated verification).

**M-5 — Edge tenant resolver has no rate limit and a dead bypass-header check**
`src/app/api/platform/edge-tenant-resolve/route.ts` — confirmed: no auth, no rate-limit, resolves any `?domain=` to a tenant slug/ID (tenant/domain enumeration). Also confirmed: `src/middleware.ts:25` sends an `x-middleware-bypass: '1'` header when calling this route, but the route itself never reads or checks that header — grep for `x-middleware-bypass` across `src/` finds exactly one occurrence (the sender), zero on the receiving side. The header provides no actual protection; it's dead code giving a false impression of a gate.
**Fix direction:** either add rate-limiting to this route (it's meant to be called by edge middleware only, not the public internet) and actually check the bypass header as a lightweight gate, or remove the header entirely if it's not meant to be a real control and rely on network-level restriction instead. Needs a decision on which.

### 🟡 Low

- **No CSP header** — confirmed: `next.config.ts:47,50` sets `X-Frame-Options` and `Strict-Transport-Security` only; no `Content-Security-Policy` anywhere in the file.
- **No rate limit on `/api/auth/setup-account`** — not independently re-checked this pass; the audit itself notes this is mitigated by 256-bit hashed single-use tokens, so treat as genuinely low priority.
- **`contentTypeFor()` defaults unknown extensions to `image/jpeg`** — confirmed, `src/libs/api/uploads.ts:10-14` (`return 'image/jpeg';` as the unconditional fallback). Minor correctness issue, not obviously a security hole on its own given the magic-byte validation that happens separately.
- **~220 routes rely on coarse role gates without capability checks** — not independently re-counted this pass; matches the previously-known "79/133 capability wiring" tracker item referenced elsewhere in this repo's own docs (`next-steps-plan.md`), so treat the shape of this finding as consistent with known, already-tracked work rather than a new discovery.
- **❌ FALSE — "Committed dev secrets in `docker-compose.yml`"**: checked directly, this does not hold up. `docker-compose.yml` has no `redis` service at all, and no `schoolos_secret_password` string anywhere in the file (searched the full repo for that literal — zero matches). `POSTGRES_PASSWORD` and `BETTER_AUTH_SECRET` are both required env-var references (`${VAR:?required}` syntax — compose refuses to start without them set), not committed defaults. Whatever this claim was based on, it isn't this file as it exists today — don't action it.

### Not independently re-verified this pass (carried as-reported)

The "defense inventory" positive claims (✅ rows: auth coverage 771/788, RBAC 549 routes, tenant-isolation AST checker passing, brute-force protection, webhook signature verification, IDOR spot-checks) were not re-derived from scratch — they're plausible and consistent with everything else verified across this whole session about this codebase's RBAC/tenant-isolation discipline, but "consistent with priors" isn't the same as "independently confirmed today." Also not run: `npm audit` (dependency vulnerabilities — explicitly flagged by the source audit as not scanned).

---

## What happens next

This file is intentionally just the verified problem list, not a fix plan. When ready to act on it: write self-contained agent-execution prompts the same way `AGENT-EXECUTION-PROMPTS-SAAS-BILLING-FIXUP.md` was built — likely grouped as (a) the build fix alone, quick; (b) H-1/H-2, the two most urgent; (c) M-1 through M-5 as one batch or split by area (auth/OTP, uploads, signup, edge-resolver); (d) the LOW items as cleanup. Get a decision on H-1's sandbox-reachability question and M-2's enumeration-vs-UX tradeoff before writing those two prompts, since both need a product call, not just a code fix.

---

## 3. D1–D4 decision briefs (context-only — what each decision is, what it blocks, what's already true regardless)

*Written 2026-08-25 by Agent 4 per dispatch. No recommendation, no decision — just the fast brief.*

### D1 — Hosting provider (Morocco / CNDP-adequate)
**The decision:** pick the production host for the shared SaaS (Moroccan data-residency option vs. an international cloud with contractual safeguards) and the dedicated-install target spec.
**Blocks:** loading any real school's data (CNDP Law 09-08 compliance posture); every deployment runbook, backup policy and pricing line that includes hosting cost. Also gates the custom-domain feature's production DNS story.
**Already true regardless:** the app is containerized (`docker-compose.yml` with db/app/migrate/clamav services, verified building cleanly today), Postgres-version-agnostic in practice (dev runs pg17), and `requireRequestContext` already centralizes subscription/tenant gating — so a host swap is ops work, not code work. Nothing in the codebase assumes a specific provider.

### D2 — SMS gateway provider
**The decision:** which Moroccan SMS aggregator to sign with for v1 (the product truth mandates SMS-only launch), plus its sender-ID/quotas contract.
**Blocks:** broadcast-messaging going from "works when configured" to "actually configured" — the module ships a **test provider only** today; `moroccan-sms-adapter.ts` exists but cannot send until credentials exist. Also blocks attendance-flag SMS compose (§8.6 flow), finance reminders (`libs/services/finance-reminders.ts` → Broadcast), and any client demo involving real parent messages.
**Already true regardless:** the entire message pipeline (templates, segments, consent/suppression, scheduling, deliveries/receipts, automations incl. birthday wishes) is built and entitlement-gated; switching providers later means implementing one adapter behind `broadcastGuard`, not touching call sites. WhatsApp stays phase-2 behind the same channel abstraction.

### D3 — Price points per tier / per module
**The decision:** actual MAD numbers for the student-count tiers of the core, for each paid add-on, and for the SaaS-vs-dedicated-install boundary.
**Blocks:** Step-13 sales collateral, the public signup trial→paid conversion path (`/api/public/signup` creates 30-day trial licenses with `planTier:'trial'`), super-admin subscription/licensing workflows having real plans to enforce, and `requirePlanTier()` enforcement becoming meaningful.
**Already true regardless:** the enforcement plumbing is done — entitlements, plan limits (`assertStudentCapacity`), license expiry worker (tests now passing 35/35), Stripe platform-billing webhook transitions (idempotent via `processed_stripe_events`) — so entering numbers is configuration + copy, not engineering.

### D4 — Final brand name ("SchoolOS" is provisional)
**The decision:** keep or replace "SchoolOS"/"Lango" as the product name, domain strategy (`app.schoolos.ma` hardcoded in middleware + trusted-origins today), and logo/UI chrome.
**Blocks:** final UI chrome and marketing site, content campaign (30 posts/videos reference SchoolOS), the deferred folder/repo rename (`lango-app`→`schoolos-app` explicitly excluded from this round), and client-facing contracts.
**Already true regardless:** renaming is cheap in code — "schoolos" appears mainly in middleware host checks, env var names, Docker project/container names, and seed data; there is no deep coupling. The DB-driven addon catalog means product naming doesn't touch module code at all.
