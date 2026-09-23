# SchoolOS full-app audit — security, business logic, behaviour

Date: 2026-09-22 · Baseline: commit `f010a54` plus the uncommitted working tree as of this audit (another agent was editing concurrently; re-verify line numbers) · Method: automated sweeps over all 813 API routes and 321 pages, then manual reading of every high-risk hit. No runtime or browser testing.

Companion: `2026-09-22-visual-product-audit.md` (page-level P0s on dashboard, exams, grading policy). Those are not repeated here.

## 1. Executive diagnosis

Tenant isolation is in good shape: the isolation checker passes on 814 files, every super-admin route asserts the role, and nearly every page has a server-side guard. Payments use advisory locks and strict overpay rules.

The real risks are in **newer and edge code paths**:

1. **A new WhatsApp QR endpoint lets any logged-in user (a parent, a student) hijack a school's WhatsApp, reach internal servers (SSRF), and read other schools' sessions.** File is untracked (`?? src/app/api/addons/broadcast/waha/`), so it may already be in the deployed image.
2. **Students and parents can download the full answer key of any online exam** in their school, including before it opens.
3. **Online card payments (Stripe live) never get recorded**: the webhook looks for the reference in the wrong place and returns 404. Families get charged; invoices stay unpaid.
4. **Payroll computes income tax (IR) on the 2024 scale.** The code itself says it is not certified. In September 2026 every payslip is likely wrong.

## 2. What works (verified)

- `check:isolation` passes: 761 tenant-scoped, 25 super-admin (all assert role), 7 self-scoped, 21 public. 74 soft warnings are child tables scoped through a tenant-checked parent.
- Super-admin API routes all call `requireSuperAdmin`.
- 300 of 321 pages call `requireServerPage` or a feature page guard; the rest are portal pages with their own guards.
- `createPayment`: transaction + advisory lock + idempotency key + strict overpay check.
- Auth: sign-up disabled in better-auth, per-account lockout, 2FA plugin, HSTS / X-Frame-Options / Referrer-Policy headers.
- Uploads: path confined to tenant root, magic-byte validation.
- Invitations: role restricted to a safe enum (no `super_admin`), capability `users.manage` required.
- Mock client files for class-subjects, class-section-teachers, homework submissions are **not routed** (dead code, not live).

## 3. Findings

### P0 — fix before anything else

**P0-A · WhatsApp QR route: account hijack, SSRF, cross-tenant** — `src/app/api/addons/broadcast/waha/qr/route.ts`
- Only `requireRequestContext(request)`: no role, no capability, no add-on check. Any parent or student can call it.
- `endpointUrl` and `apiKey` come from the query string. The server then `fetch`es that URL with the `X-Api-Key` header and, with `format=raw`, **returns the response body**. That is full-read SSRF to `127.0.0.1`, the Docker network (`db:5432` is not HTTP but `schoolos-waha:3000`, internal admin APIs are), and it **sends the WAHA key to any attacker-chosen host**.
- `session` comes from the query string, so `session=tenant_<otherSchoolId>` returns **another school's pairing QR**. Scanning it links the attacker's phone to that school's WhatsApp.
- The route also creates and starts WAHA sessions on demand (resource use on a 1.9 GB host).
- Hardcoded fallback key `schoolos_waha_2026` in this file, in `sms-delivery.ts:49`, and in `docker-compose.yml` (`WAHA_API_KEY:-schoolos_waha_2026`, dashboard password default `Admin123!`).
- Fix: guard with `broadcastGuard(request, 'broadcast.manage')`. Never read `endpointUrl`, `apiKey`, or `session` from the request; derive session strictly from `tenantId`, endpoint/key only from the tenant's stored connection or server env. Remove all hardcoded defaults and make compose fail if unset (`:?`). Rotate the WAHA key on the VPS.

**P0-B · Online exam answer key exposed to students and parents** — `src/app/api/academics/online-exams/[examId]/questions/route.ts:29-78`
- GET requires only `grading.read`, which `student` and `parent` hold (`src/libs/api/permissions.ts:339-351`). The response includes every option with `isCorrect`.
- No check that the exam has started, that the student is enrolled in the class, or that the caller is staff.
- Same pattern likely in `online-exams/[examId]/variants/route.ts` (reads options). Verify.
- Fix: staff-only for the authoring view. A separate student view returns questions without `isCorrect`, only between `startsAt` and `endsAt`, only for students placed in the exam's class.

**P0-C · Stripe live payments are never recorded** — `src/app/api/finance/payments/online/callback/route.ts`
- The route looks up the session with `body.externalReference ?? body.oid`. A Stripe event carries it at `data.object.metadata.external_reference` (`stripe-provider.ts:84-88`), so the top-level lookup is `''` → **404 "Session introuvable"** for every real Stripe webhook. The family is charged; the invoice is never credited.
- CMI live is not implemented (`cmi-naps-provider.ts:83-94` throws 501). So **no live online payment path works in production today**. The UI should say so instead of offering it.
- Race: two concurrent deliveries both see `status = 'pending'` and both call `createPayment` with no idempotency key. Partial-payment invoices can be credited twice.
- A forged unsigned callback that fails verification throws (good), but a validly signed non-`checkout.session.completed` event marks the session `failed`, after which the real success returns "Déjà traité".
- Fix: resolve reference from the verified provider result, not the raw body. Claim the session atomically (`UPDATE … SET status='processing' WHERE id=? AND status='pending' RETURNING`). Pass `idempotencyKey: externalReference` to `createPayment`. Ignore irrelevant event types without changing session state. Add a test with a real Stripe-shaped signed payload.

**P0-D · Payroll IR on the 2024 scale** — `src/features/workforce/services/ma-regulation-adapter.ts:94-122`
- Brackets: 0% to 30,000 MAD, top rate 38%, `effectiveFrom: '2024-01-01'`, and a 40% professional-expense abatement. The 2025 Finance Law changed the salary IR scale (my understanding: exemption raised to 40,000 MAD and top rate to 37%, plus changes to family deductions). **Confirm the exact 2025/2026 figures with a Moroccan accountant before changing code.**
- Also verify: employer CNSS modelled as one capped 8.98% rate, while family allowances and vocational-training contributions are separate and uncapped; AMO employer rate 3.26%.
- The file says "NOT yet signed off by an accountant". Payslips should show a visible "barème non certifié" warning until it is.
- Fix: add a versioned 2025 regulation pack with `effectiveFrom: '2025-01-01'`, keep 2024 for back-pay recalculation, and add golden-value tests signed off by an accountant.

### P1 — operational correctness / compliance

**P1-A · Branch isolation is partial.** Students API honours `context.branchId` (`api/students/route.ts:374`), the dashboard does, but invoices, payments, attendance (0/17 routes), reception (1/27), and most academics routes do not. A branch-scoped accountant or director sees every campus. Matters only for multi-branch tenants, but the dashboard header says "Campus X" while the finance pages show all campuses.

**P1-B · No audit trail on accounting and HR changes.** `features/accounting` and `features/hr` services never call `recordAudit`, and their routes don't either: journal entries, transaction reversal, expense approve/post/reject, periods, accounts, employee create/update, offboard, reactivate, link-account, employee documents. Also workforce payroll actions (6 routes). Financial controls and Law 09-08 both expect who-did-what.

**P1-C · Super-admin tenant entry is unaudited** (from the visual audit, confirmed here). 1-year client-set cookie, no reason, no audit row, and super_admin then passes every `school_admin` API.

**P1-D · Online exam submission integrity** — `api/academics/online-exams/submit/route.ts`
- No role check, no `startsAt` check, no enrollment check.
- Per-attempt timer starts at the **first submit**, not when the student opens the exam, so the time limit can be sidestepped (read questions freely, then submit).

**P1-E · Add-on page gating never fires** (from the visual audit): locale-prefixed paths never match.

**P1-F · Payment lock covers only the first invoice** — `payment-create.ts:44`. A multi-invoice payment and a concurrent payment on invoice #2 are not serialized; overpay is possible on invoice #2. Lock every invoice id in sorted order. Also, draft and credited invoices can be paid (only `cancelled` is refused).

### P2 — hardening

- **Production builds ignore type errors**: `Dockerfile:56` sets `NEXT_IGNORE_TYPES=1`. Current tree has 6 TS errors, including `cards/services/issue-service.ts:72,97,125` reading a non-existent `avatarUrl`. Run `check:types` in CI as a gate before image build.
- **Hardcoded secret fallbacks**: `REPORTING_SIGNING_SECRET` (`secure-download.ts:4`), `WEBHOOK_SIGNING_KEY` fallback chain ending in a literal (`webhooks/communication/[provider]/route.ts:17`), QR badge HMAC fallback literal (`badge-crypto.ts:7`, `workforce/punches/route.ts:13`). All should throw at boot if unset, like `BETTER_AUTH_SECRET` does.
- **Caddy on-demand TLS allows any `*.schoolos.epioso.com`** (`platform/caddy-ask/route.ts`). Random subdomains trigger Let's Encrypt issuance and can exhaust rate limits (50 certs/week per domain). Allow only registered subdomains.
- **Rate limits key on the first `X-Forwarded-For` value** (signup, caddy-ask, edge-resolve). Confirm Caddy overwrites XFF; otherwise clients choose their own key.
- **`edge-tenant-resolve` "secret" is the header `x-middleware-bypass: 1`** (public knowledge from source). Low impact (maps domain → tenant UUID) but it is not a secret.
- **Homework upload has no role check** and accepts any `application/zip` as `.docx`, 15 MB each. Any user can fill the disk on a small VPS.
- **Invitation tokens stored and listed in plaintext** (`settings/invitations/route.ts:39,88`); setup tokens are hashed, invitations should be too.
- **`setup-account` token use is not atomic**: double submit can create two credential rows.
- **WAHA image `devlikeapro/waha:latest`** unpinned, plus ClamAV, on a 1,935 MB host. Measure RAM after the WAHA fix.
- Dead mock files (`MOCK_TEACHERS`, `MOCK_ASSIGNMENTS`, `MOCK_SUBMISSIONS`, `MOCK_HOUSEHOLDS`, `MOCK_STUDENTS`, `MOCK_CHAPTERS`) should be deleted so they can't be re-wired.

### P3

- Grading page renders `MOCK_SCALES` live (`assessment-policies-client.tsx:620`).
- `public/signup` has no password max length (hashing cost on huge input).

## 4. Claims vs evidence

| Claim | Evidence | Verdict |
|---|---|---|
| Broadcast routes "must pass through broadcastGuard" (`broadcast/api/guard.ts` header) | `waha/qr` does not | Contradiction |
| Online payments live (STATE.md "deployed and verified") | Stripe webhook can't find sessions; CMI live throws 501 | Contradiction |
| Payroll "Moroccan CNSS/AMO/IR engine" (AGENTS.md) | 2024 scale, uncertified by the file's own note | Overstated |
| "Tenant isolation enforced" | Checker passes; WAHA session param bypasses it outside the DB | Mostly true, one hole |

## 5. Coding-agent prompt (copy-paste)

```
Security + correctness pass. Do NOT redesign UI. Do NOT touch pages from the visual audit unless listed. Fix only these, in this order, each with a test.

P0-A  src/app/api/addons/broadcast/waha/qr/route.ts
  - Guard with broadcastGuard(request, 'broadcast.manage').
  - Remove endpointUrl, apiKey, session query params. Session = `tenant_${tenantId}`. Endpoint/key from the tenant's stored connection or server env only.
  - Delete every 'schoolos_waha_2026' / 'Admin123!' fallback (route, sms-delivery.ts, docker-compose.yml -> use ${VAR:?required}).
  - Tests: parent -> 403; endpointUrl param ignored; session param ignored; other tenant's session unreachable.
  - Tell me the key must be rotated on the VPS (do not deploy yourself).

P0-B  online exam answer key
  - [examId]/questions GET and [examId]/variants: staff only (school_admin, teacher with class assignment).
  - New student view: no isCorrect, only between startsAt and endsAt, only for students placed in the exam's class.
  - Tests: student GET authoring route -> 403; student view never contains isCorrect.

P0-C  src/app/api/finance/payments/online/callback/route.ts
  - Verify first, then look up the session by the provider-verified externalReference.
  - Atomic claim: UPDATE ... SET status='processing' WHERE id=? AND status='pending' RETURNING.
  - createPayment({... idempotencyKey: externalReference }).
  - Irrelevant Stripe event types -> 200 no-op, session unchanged.
  - Tests: real Stripe-shaped signed payload credits the invoice; two concurrent callbacks credit once.
  - UI: hide online payment for providers with no working live path (CMI live is 501).

P0-D  payroll IR
  - Do NOT change rates yourself. Add a clearly marked 2025 regulation pack structure with TODO values, keep 2024 for history, and show "barème non certifié" on payslips until validationStatus = certified.

P1  (each with a test)
  - Branch filter from context.branchId on finance invoices/payments, attendance, reception lists.
  - recordAudit on every mutation in features/accounting, features/hr, workforce payroll routes.
  - Super-admin tenant switch via server route + httpOnly 8h cookie + audit row.
  - online-exams/submit: student role, enrollment, startsAt check, timer starts when the student opens the exam.
  - payment-create: advisory-lock every invoice id (sorted); refuse draft and credited invoices.
  - page-guard locale strip (see visual audit).

Return with evidence, not "fixed":
WAHA: response for parent session + response with endpointUrl=http://127.0.0.1:3000
ANSWER KEY: student response body for questions route
STRIPE: test output for signed payload + concurrency test
TENANT ISOLATION: npm run check:isolation output
TYPES: npm run check:types output (must be 0 errors)
TESTS: vitest output for the new tests
```

## 6. Not covered

- Runtime/browser testing, load testing, dependency CVE scan (`npm audit`), and the production VPS itself (env values, Caddy config, firewall). The WAHA and secret findings mean the VPS env should be checked by hand.
- The 74 soft tenant-isolation warnings were sampled, not individually proven.

---

## 7. Cross-check of correction pass 2 (code evidence, no screenshots)

Confirmed in code: super_admin tenant from audited cookie only (`context.ts`); WAHA route behind `broadcastGuard`, no request-supplied endpoint/key/session, no hardcoded key in `src/` or compose (`:?required`); online-exam authoring and variants routes staff-only, new `take` route student-only with no `isCorrect`, submit checks role, `startsAt`, placement; Stripe callback reads `data.object.metadata.external_reference`, atomic `pending→processing` claim, `idempotencyKey`, ignored events no-op; payment-create locks every invoice (sorted) and refuses draft/credited; branch filter on invoices/payments/attendance GET; payroll certification warning; `NEXT_IGNORE_TYPES` removed from Dockerfile.

Correction to this audit: the three mock clients (class-subjects, class-section-teachers, homework submissions) **were** routed via view → page → client chains. §2 was wrong; the agent archived them.

Open items:
- **Typecheck: 5 errors** now (`admission-requests-client.tsx` ×1, `seed-admissions-fixture.ts` ×4), from the concurrent agent. With types now gating the Docker build, **the next image build will fail** until they are fixed.
- **Two migrations numbered 0147** (`0147_applicants_branch_session_and_lifecycle.sql`, `0147_matricule_tenant_scope.sql`). Journal idx 148/149 keeps order, but rename the second to 0148 before commit. Migrations 0142–0147 are all **untracked**, while STATE.md says 0144 is already applied in production.
- **Whole tree uncommitted** (hundreds of files, two agents editing). Commit in reviewed slices before anything else lands.
- Stripe: hardening only, assert verified amount equals the session amount (P3).
- Teachers can read the answer key of any exam in the school, not only their own (P3).
- Product decision pending: concurrent placement = reassign (current) or 409.

Operator actions (VPS): rotate WAHA key and dashboard password, set both in compose env, run `db:migrate` for 0146–0148, confirm `REPORTING_SIGNING_SECRET` / `WEBHOOK_SIGNING_KEY` are set.

Gate: all code P0s **ACCEPTED on code**. Payroll IR stays **BLOCKED on accountant figures**. Page acceptance still needs screenshots.
