# Agent Execution Prompts — Security Fixes + Addon Test Coverage (3 agents)

Three standalone, copy-pasteable prompts covering everything in the "Open Gaps" list from the last session report. Split so each agent owns a distinct set of files with minimal overlap — safe to run all three in parallel.

**Source documents these pull from** (each agent should read its relevant one for full detail — this file gives the task list + priority, the source docs have the evidence/reasoning):
- `NEXT-TASKS-BUILD-AND-SECURITY.md` — Agent 1's scope.
- `NEXT-TASKS-ADDONS-AND-TEST-PLAN.md` — Agents 2 and 3's scope.

**Shared test convention — every new test file must follow this, no exceptions:**
```ts
async function checkDbReachable(): Promise<boolean> {
  try { await db.execute(sql`select 1`); return true; } catch { return false; }
}
let dbReachable = false;
beforeAll(async () => { dbReachable = await checkDbReachable(); });
describe.skipIf(() => !dbReachable)('...', () => { /* tests */ });
```
This is the exact pattern already used correctly in `subscription-enforcement.test.ts` and `license-expiry-worker.test.ts` — a real connectivity check, not `Boolean(process.env.DATABASE_URL)` (that was a real bug, already fixed once this session — don't reintroduce it).

**One coordination note:** Agent 1 fixes attachments-book's missing `requireAddon` gate. Agent 3's list includes writing that addon's guard test. If Agent 3 reaches attachments-book before Agent 1's fix has landed, either wait, or write the test against the *intended* fixed behavior and note in the report that it depends on Agent 1's PR landing first — don't write a test that only passes against the current, broken, ungated state.

---

## AGENT 1 — Security fixes (H-1, H-2, M-1 through M-5, attachments-book gating)

**Copy everything below this line into your agent:**

```
# App Context — SchoolOS

You are working in a real, partially-built production codebase: SchoolOS, an enterprise multi-tenant school-management SaaS (formerly branded "Lango" — the rename to SchoolOS is done across code/docs; one seed tenant is still legitimately named "Lango English Center," leave that alone, it's real demo-tenant data, not a branding leftover).

**Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Drizzle ORM + Postgres, Better Auth. Runs via Docker Compose.

**Standing API route convention:** requireRequestContext(req, [allowedRoles]) → requireTenant(context) → requireCapability(context, 'module.action') → Zod .strict() schema → tenant-scoped Drizzle query → recordAudit() on mutations → apiErrorResponse() catch-all.

**Build verification:** `docker compose build app` is authoritative, not `tsc --noEmit` alone. Run `docker compose build migrate` too if you add a migration (separate image, separate cache) — check `migrations/` for the next available number immediately before writing one, don't hardcode.

**Command discipline:** Never `cd`. Touch only what's listed below.

---

# Background

Full evidence for every item below is in `NEXT-TASKS-BUILD-AND-SECURITY.md` — read it first, this prompt is the task list, that file is the reasoning/evidence. Every finding was independently verified against live code before being written down; none of this is speculative.

# Your tasks, in priority order

1. **attachments-book: add the missing entitlement gate.** All 10 routes under `src/app/api/content/**/route.ts` (assets, assets/[id]/archive, assets/[id]/download, assets/[id]/publish, assets/[id]/route, assets/[id]/targets, assets/[id]/usage-links, assets/[id]/versions, attachment-types, attachment-types/[id]) currently only call `requireCapability(context, 'content.manage')` — never `requireAddon(tenantId, 'attachments-book')`. Add the addon check to all 10, following the same pattern used correctly elsewhere (e.g. `api/addons/hostel/**`). Revoking the entitlement must actually block access.

2. **H-1 — CMI sandbox payment callback trusts the request body.** `src/libs/payments/cmi-naps-provider.ts`, `verifyCallback()`: in sandbox mode it returns `status: 'paid'` straight from the caller-supplied body with zero verification. `src/app/api/finance/payments/online/callback/route.ts` calls this unauthenticated. Fix: refuse sandbox-mode callbacks unless a dev/staging environment flag is set (check how this codebase already distinguishes environments — likely `NODE_ENV` or a dedicated env var), or require a shared sandbox secret passed alongside the callback. Your call on which, but don't leave it wide open in any environment where real tenant data exists.

3. **H-2 — Hardcoded fallback encryption key.** `src/libs/api/secrets.ts:9-11`: `process.env.ENCRYPTION_KEY || process.env.BETTER_AUTH_SECRET || 'schoolos-broadcast-secret-sentinel'`. The `BETTER_AUTH_SECRET` fallback is fine (already required elsewhere). Remove the third, hardcoded fallback — throw a clear startup error instead if neither env var is set. Check `docker-compose.yml` to confirm `BETTER_AUTH_SECRET` really is enforced as required there (it should already be, per `${BETTER_AUTH_SECRET:?...}` syntax) so this change doesn't newly break local dev.

4. **M-1 — Plaintext 2FA OTP codes.** `src/libs/auth.ts:89-101`: `console.log`s the raw OTP and stores it plaintext in `twoFactorOtps`. Stop logging the raw code. For storage: since this is a short-lived (3-minute expiry), single-use verification code, storing a hash (not the plaintext) and comparing hashes on verify is the right fix — find wherever the OTP is currently compared/verified and switch both write and read sides together.

5. **M-2 — Public signup: no rate limit, enumerable via distinct EMAIL_EXISTS.** `src/app/api/public/signup/route.ts`. Add rate-limiting (per-IP at minimum; check if this codebase already has a rate-limiting utility used elsewhere — e.g. sign-in lockout — before building a new one). Leave the `EMAIL_EXISTS` distinct error code as-is unless you have a strong reason to change it (that's a deliberate UX-vs-enumeration tradeoff, not obviously wrong) — rate-limiting alone meaningfully raises the cost of enumeration.

6. **M-3 — Upload path-traversal gap.** `src/libs/api/uploads.ts`: `readUploadedFile()` already validates the resolved path stays inside the tenant directory; `saveUploadedFile()` and `copyUploadedFile()` don't. Add the same guard to both — ideally factor it into one shared internal helper all three call, so this can't drift apart again.

7. **M-4 — Write routes skipping Zod validation.** Confirmed pattern at `src/app/api/addons/broadcast/templates/route.ts:22` (`request.json()` used directly). Grep the whole `src/app/api/` tree for `request.json()` calls not immediately followed by a Zod `.parse()`/`.strict()` call via `parseJson()`. Fix each with a proper schema following this codebase's established `parseJson(request, schema.strict())` convention. Report the real count you find and fixed — the "~22" figure was a spot-check estimate, not a verified count.

8. **M-5 — Edge tenant resolver: no rate limit, dead bypass-header check.** `src/app/api/platform/edge-tenant-resolve/route.ts` has no auth/rate-limit. `src/middleware.ts:25` sends an `x-middleware-bypass` header the route never checks. Either make the header check real (reject requests missing it) and add rate-limiting, or remove the dead header entirely if network-level restriction is the intended control — your call, but don't leave a header that looks like a security control while doing nothing.

9. **Two trivial cleanup items, do these last:** (a) `src/addons/registry.ts:1-8`'s header comment still says "only multi-branch is wired today" — false, update it to reflect that most addons now have real `requireAddon` gates. (b) `src/features/subscriptions/services/subscription-service.ts`, `decidePayment()`: the audit log's `action` field always resolves to `'extend'` even on a tenant's first license issue, because `result.license.issuedAt` is always truthy on both code paths. Fix the condition so it correctly logs `'issue'` vs `'extend'`.

**Do not touch:** anything under `src/features/subscriptions/services/platform-billing-service.ts` or `src/app/api/webhooks/stripe-platform/` (a different agent may be relying on that surface being stable), test files for other addons (that's Agents 2/3's scope).

**Verify:** for each numbered fix, write or extend a test proving the specific gap is closed (attachments-book: entitlement-revoked → 403; sandbox callback: forged body → rejected; encryption key: missing env vars → startup throws, not a silent fallback; OTP: plaintext never appears in logs or DB; uploads: `../` in subpath → rejected on save/copy same as read; M-4: pick 2-3 of the fixed routes, confirm malformed bodies now 400 instead of being accepted). Run `npm run check:types` and report the result.

**When done:** report file paths changed, confirm no regression in existing tests, list the real M-4 count found vs. fixed.
```

---

## AGENT 2 — Guard tests + adversarial tests for the highest-risk addons

**Copy everything below this line into your agent:**

```
# App Context — SchoolOS

[Use the identical "App Context" block from Agent 1 above. Not repeated here — copy it verbatim if handing this to a fresh agent session.]

---

# Background

Full detail and per-addon reasoning: `NEXT-TASKS-ADDONS-AND-TEST-PLAN.md`, sections for the 5 addons listed below. Read that file first. The headline finding driving this work: four addons carry an "excellent"/"best-audited" reputation in prior review passes, but have **zero automated test files anywhere in the codebase** — that reputation comes from a one-time manual pass, not regression protection. This is the highest-leverage test-writing work in the whole plan.

**Test convention — mandatory, no exceptions:** use the real-connectivity `checkDbReachable()` + `describe.skipIf` pattern (given in full in the top-level note of this prompt file, or copy it directly from `src/features/subscriptions/services/__tests__/subscription-enforcement.test.ts`). Do NOT use `Boolean(process.env.DATABASE_URL)` as a DB-availability check — that was a real, already-fixed bug this session, don't reintroduce the pattern.

# Your addons, in priority order

## 1. transport (zero tests today)
- Guard test: entitlement + tenant isolation across all of `api/transport/**`.
- Capacity-aware allocation test: a route/bus can't be over-assigned beyond capacity.
- **Adversarial test (this is the important one):** rider-scan integrity — can a scan be replayed? Forged for a student who isn't assigned to that route? Recorded against a different tenant's student?
- GPS/ETA test: stale or missing location data must degrade honestly (a clear "unavailable" state), never show a fabricated ETA.

## 2. card-management (zero tests today)
- Guard test across `api/cards/**`.
- **Adversarial test:** QR-verification — forged QR payload, expired card, revoked card, cross-tenant card reuse — all must fail verification.
- One integration test: admission-approval → card issuance actually completes end-to-end (this addon has high fan-in — admissions convert, report-card generator, student-detail UI all depend on it).

## 3. lead-crm (zero tests today)
- Guard test — note the public lead-capture endpoint is *intentionally* ungated; assert that's still true by design, don't treat it as a bug to fix.
- Duplicate-detection/merge test: two leads with matching phone/email get flagged; merging preserves history, doesn't drop it.
- Admissions-convert integration test: a converted lead creates exactly one real admission record, even under a retried request.

## 4. school-website-cms (zero tests today)
- Guard test on the `settings/website` gate.
- **Most important test for this addon:** public-route tenant isolation — the public slug-resolved site for tenant A must never leak tenant B's content. This is the one addon with a genuinely public, unauthenticated surface.
- Page-type completeness test: Home/About/Gallery/FAQ/Contact/Services all render without error on a fresh tenant with zero content — confirms honest empty states, not crashes.

## 5. certificate-management (1 test today, needs the adversarial gap closed)
- **Adversarial test:** QR-verification forgery/expiry/revocation, same risk class as cards. This is explicitly called out as untested in the plan.
- Correction/replacement/revocation workflow test: confirm a revoked certificate's QR actually stops verifying (not just a status flag nobody reads).

**Do not touch:** any files under `src/app/api/content/**` (Agent 1 is fixing that addon's gating — if you need to reference it for pattern-matching, read-only), any Part A-D billing/subscription files, any addon outside the 5 listed above (that's Agent 3's scope).

**Verify:** run every new test file, report pass/fail (and honestly report skip counts if Postgres isn't reachable in your environment — don't claim "100% passing" without noting how many actually executed vs. skipped, that distinction mattered a lot in a recent audit this session). Run `npm run check:types`.

**When done:** report file paths added, test counts (written / passed / skipped), and flag clearly if any adversarial test actually caught a real bug rather than just passing cleanly — that would be a genuine new finding, not just coverage.
```

---

## AGENT 3 — Test coverage for the remaining addons

**Copy everything below this line into your agent:**

```
# App Context — SchoolOS

[Use the identical "App Context" block from Agent 1 above. Not repeated here — copy it verbatim if handing this to a fresh agent session.]

---

# Background

Full detail and per-addon reasoning: `NEXT-TASKS-ADDONS-AND-TEST-PLAN.md`, sections for the 10 addons listed below. Read that file first. Unlike Agent 2's addons, these already have *some* test coverage (1-8 files each) — your job is targeted gap-filling per the plan's own per-addon notes, not building from zero.

**Test convention — mandatory, no exceptions:** same real-connectivity `checkDbReachable()` + `describe.skipIf` pattern as Agent 2's prompt describes. Copy it from `src/features/subscriptions/services/__tests__/subscription-enforcement.test.ts` if you need a working example.

**Coordination note:** attachments-book (item 7 below) depends on Agent 1 adding its missing `requireAddon` gate first. If that fix hasn't landed when you reach this addon, write the guard test against the *intended* fixed behavior and note in your report that it's blocked on Agent 1's change landing — don't write a test that only passes against the current, ungated state.

# Your addons

## 1. hostel (1 test today)
- Guard test across allocations/roll-call/visitors/incidents/charges.
- Allocation state-machine test (reserved → checked_in → checked_out).
- Regression test locking in the `state=all` filter fix (§19.11) so it can't silently regress.
- Charges-to-accounting posting test: correct and idempotent (charge posts exactly once).

## 2. library (8 tests today — the best-covered addon, use as your reference pattern for everyone else)
- One gap only: confirm the library-to-student-accounting charge coupling (a lost-book fine) has a dedicated integration test proving it posts correctly and exactly once. If `library-accounting-adapter.test.ts` already covers this, say so and move on — don't duplicate.

## 3. event-management (2 tests today)
- Guard test across all 28 routes under `api/addons/events/**` — script this as a loop over routes, don't hand-write 28 near-identical tests.
- Recurrence-boundary test: bounded recurrence actually bounds, doesn't generate unbounded occurrences.
- RSVP/waitlist race test: two people claiming the last seat simultaneously — exactly one should win.
- iCal export test: the `PRODID`/`UID` fields (recently renamed to SchoolOS branding) round-trip through a real calendar parser without error.

## 4. inventory (1 test today)
- Guard test.
- Purchase/sale-to-accounting integration test (idempotency + correctness, same pattern as hostel/library).
- Stock-level test: a sale can't oversell below zero; a loan can't exceed available equipment.

## 5. human-resources (3 tests today)
- Guard test covering both `api/hr/**` and the 13 `api/employee/me/**` self-service routes.
- Self-service isolation test: an employee must never reach another employee's `me/*` data, even within the same tenant.
- Employment-lifecycle state-machine test: hire → active → leave → terminated, no illegal transitions.

## 6. payroll-workforce (2 tests today, plus an existing `calculate.test.ts`)
- Guard test via `requireWorkforceAddon`.
- Maker-checker test: a single user can't both create and approve the same payroll run.
- Do NOT write tests against DAMANCOM/bank-export adapters (disabled pending external certification — wasted effort). Instead, one test confirming the disabled adapters fail closed (never silently no-op as if they succeeded).

## 7. attachments-book (1 test today — see coordination note above)
- Guard test proving entitlement revocation actually blocks access (depends on Agent 1's fix).

## 8. live-classrooms (7 tests today, including a real adversarial.test.ts — already the best security-test example in the codebase)
- One gap: a BBB-adapter contract test that runs against the dev provider's deterministic behavior (can't test the uncertified real BBB adapter live, but the contract it implements to can be tested without real credentials).

## 9. broadcast-messaging (4 tests today, most-depended-on addon)
- Guard test across the full addon surface — and critically, one test per dependent feature (finance reminders, attendance flags, `communication/send`) confirming each degrades honestly, not silently, if broadcast is ever disabled for a tenant.
- Consent/suppression test: a suppressed/opted-out recipient must never receive a campaign — treat this as high priority, it's compliance-relevant.

## 10. advanced-reporting (2 tests today, best code isolation of any addon)
- Guard test.
- Rate-limit test: confirm background report runs are actually rate-limited, not just configured to look like they are.
- Snapshot-immutability test: a delivered report snapshot must not change even if the underlying data changes afterward.

**Do not touch:** the 5 addons in Agent 2's list, anything under `src/app/api/content/**` beyond reading Agent 1's fix once it lands, any Part A-D billing/subscription files.

**Verify:** run every new test file per addon, report pass/fail/skip counts honestly (see the note in Agent 2's prompt about not overstating "passing" when tests were actually skipped). Run `npm run check:types`.

**When done:** report file paths added per addon, test counts, and explicitly flag the attachments-book item's dependency status (landed / blocked / worked around).
```

---

## AGENT 4 — Infra verification, Bucket 4 recount, dependency audit, external-blocker readiness

**Scope note before you dispatch this one:** unlike Agents 1-3, not everything here is a "fix." Two of the four task clusters below are things no agent can actually resolve (starting infrastructure that may need a human's interactive action; business decisions only you can make) — this prompt is written to have the agent do everything genuinely actionable and clearly report, not guess or fabricate, on the rest. Folder/repo rename is explicitly out of scope — skip it.

**Copy everything below this line into your agent:**

```
# App Context — SchoolOS

[Use the identical "App Context" block from Agent 1 above. Not repeated here — copy it verbatim if handing this to a fresh agent session.]

---

# Background

Four unrelated cleanup/verification clusters, bundled into one agent because none of them individually is large enough to warrant its own dispatch, and none overlaps Agents 1-3's files. Do them in the order listed — cluster 1 unblocks the most value (real, not skipped, test results).

# Cluster 1 — Start infrastructure, re-run everything that's been skipping

Postgres has been down for most of this session. 35 of 43 new SaaS-billing tests (`describe.skipIf`) have never actually executed — they're presumed correct from code review, not confirmed by running. The production build (`npx next build`) has also failed in this environment specifically due to `ECONNREFUSED` to Postgres plus an out-of-memory crash in the build worker — separate from any code defect.

1. **Attempt to start Docker Desktop and the Postgres container.** Try the obvious things first (`docker compose up -d db` if the Docker daemon is already reachable; if not, attempt to launch Docker Desktop itself and wait for the daemon). **If this genuinely requires an interactive GUI action only a human can perform on this machine, stop and report that clearly — do not spend excessive time retrying, and do not fabricate or guess at a result.**
2. **If Postgres comes up:** re-run the full test suite (`npx vitest run`), paying particular attention to the 5 previously-DB-skipped files from the SaaS-billing fixup (`license-expiry-worker.test.ts`, `subscription-enforcement.test.ts`, `onboarding-flow.test.ts`, `signup-and-invitations.test.ts`, `stripe-webhook-transitions.test.ts`). Report real pass/fail counts, not just "passing."
3. **Run the authoritative build check**: `docker compose build app`, and `docker compose build migrate` if any migrations exist that haven't been applied. This is the project's own documented standard — more reliable in this environment than `npx next build` directly on the host.
4. **If Postgres/Docker cannot be started at all**, report that explicitly as the outcome for this cluster and move on to the others — don't block the rest of your work on this one blocker.

# Cluster 2 — Bucket 4: get a real, current count

`AGENT-EXECUTION-PROMPTS-ROUND2.md` and various status docs cite "~40 unbuilt features across 13 module groups" — this figure predates several remediation waves this session and has already been shown, repeatedly, to be stale (several "still open" items turned out to already be fixed when independently re-checked). Do not trust it.

1. Re-derive the actual current state by cross-referencing `PRODUCT-REVIEW-AND-FIXES.md` (the original 135-item review) and `future-implementation/_tracker/PLANS-AUDIT-AND-PROGRESS.md` (the 36-module tracker) against **current code**, not against either document's own claims — the standing rule all session: verify against live files, not descriptions.
2. Produce a new, dated doc: `BUCKET-4-CURRENT-STATE.md` at the repo root, listing what's genuinely still unbuilt, grouped by module, with file-path evidence for each "not built" claim (the same evidentiary standard as `EXECUTION-AUDIT-VERIFIED.md`).
3. Do not attempt to build any of it — this cluster is audit-only, so future execution prompts can be written accurately instead of off a stale number.

# Cluster 3 — Dependency vulnerability audit

Flagged in the security review as never run.

1. Run `npm audit` in `lango-app/` (or wherever `package.json` actually lives after the SchoolOS rename — check first).
2. For anything fixable with `npm audit fix` (non-breaking, patch/minor version bumps), apply it, then re-run `npm run check:types` and a quick smoke check that nothing broke.
3. For anything requiring a breaking/major version bump, do NOT auto-upgrade — list it in your report with the current severity, and let a human decide.

# Cluster 4 — External-blocker readiness check (NOT resolution — these need real credentials/certification, no agent can close them)

For each of: live payment-gateway/ERP certification (CMI NAPS live mode), payroll DAMANCOM/bank export adapters, live-classrooms BBB certification — confirm the code's current behavior when the feature is invoked without certification is an honest, clear "pending certification" error (already the pattern for CMI NAPS live mode per `cmi-naps-provider.ts`'s `GATEWAY_LIVE_PENDING` error) — not a silent no-op, not a fake success. If any of the three silently does nothing instead of failing clearly, fix that specific honesty gap (small, scoped fix) — but do not attempt to build the actual certified integrations themselves, that's not something you have the credentials to do or verify.

Additionally, write one short paragraph per decision for **D1-D4 (hosting provider, SMS gateway provider, pricing model, final brand name)** — not a recommendation, not an attempt to decide, just a clear brief: what the decision actually is, what it blocks downstream (e.g. SMS gateway choice blocks broadcast-messaging going from "works when configured" to "actually configured"), and what's already true regardless of which way it goes. Add this as a new section in `NEXT-TASKS-BUILD-AND-SECURITY.md` under the existing D1-D4 row, so the decision-maker has a fast, complete brief instead of needing to re-derive context.

**Do not touch:** anything Agents 1-3 are working on (security fixes, addon test files), and do not attempt the folder/repo rename (`lango-app`→`schoolos-app`, GitHub) — that's explicitly excluded from this round, it needs to happen as its own isolated step when nothing else has a file lock in the directory.

**Verify:** for cluster 1, real test/build output, not a summary. For cluster 2, spot-check at least 3 of your "still unbuilt" claims by showing the actual missing-file/missing-route evidence. For cluster 3, confirm `npm run check:types` still passes after any `audit fix`. For cluster 4, confirm the certification-pending errors actually surface as errors, not swallowed exceptions.

**When done:** report per-cluster outcomes clearly and separately — don't blend them into one summary, since a reader may only care about one cluster's result.
```

