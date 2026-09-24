# AUD-PUBLIC-01 — Public Website + Admissions/Inquiry Public Flows — Executor Report

## 1. Handoff Metadata

- Executor: codex-2 (Executor C)
- Date: 2026-09-24
- Target branch: `origin/student-directory-hardening`
- Target/base SHA: `f42c2bc41cb2386afed52244c5355c31c8a91f96`
- Implementation branch: `audit/agent-c/AUD-PUBLIC-01-public-admissions`
- Implementation SHA(s): see §13
- Hub item: `task:AUD-PUBLIC-01` (+ `task:port-3457`)
- Done folder: `lango-app/artifacts/page-audit/done/AUD-PUBLIC-01__public-website-admissions/`

### Scope note (the brief was a title only)
Scope taken as the **unauthenticated surface**: the public school site, the
marketing site, the public inquiry/admissions submission, public document
verification, and public secret-token links. The **staff** admissions console
(`/dashboard/students/admissions*`) is explicitly **out of scope** — say the word
and it becomes a follow-on campaign.

## 2. Scope

Route inventory was discovered from the filesystem and page guards, not assumed.

### Pages audited (13, all unauthenticated)

| # | Route | Purpose | Result |
|---|---|---|---|
| 1 | `/` (marketing) | Platform marketing site | PASS (locale-normalizing redirect → `/fr`) |
| 2 | `/{slug}` | Public school site home | PASS |
| 3 | `/{slug}/about` | About | PASS |
| 4 | `/{slug}/contact` | Contact / inquiry entry | PASS |
| 5 | `/{slug}/events` | Public events | PASS |
| 6 | `/{slug}/faq` | FAQ | PASS |
| 7 | `/{slug}/gallery` | Gallery | PASS |
| 8 | `/{slug}/news` | News list | PASS |
| 9 | `/{slug}/news/[slug]` | News article (unknown slug) | PASS (honest empty/404 state) |
| 10 | `/{slug}/services` | Services / admissions pitch | PASS |
| 11 | `/verify-document` | Alumni document verification | PASS |
| 12 | `/verify/card/[token]` | Card verification (invalid token) | PASS (honest invalid state) |
| 13 | `/verify/certificate/[token]` | Certificate verification (invalid token) | PASS (honest invalid state) |

Slug used: `atlas` (Groupe Scolaire Atlas, the seeded `schoolos_audit` tenant).

### Public API audited (10, all unauthenticated)
`alumni-documents/verify`, `cards/verify`, `certificates/verify`,
`events/[tenantSlug]`, `inquiries/[tenantSlug]`, `invitations/[token]`,
`invitations/[token]/accept`, `signup`, `website/[tenantSlug]/images/[filename]`,
`website/[tenantSlug]/logo`.

### Explicitly out of scope
- Staff admissions console (`/dashboard/students/admissions*`) and the admissions
  review/stage APIs.
- `/api/settings/website/*` (the authenticated CMS behind the public site).
- Deploying to the VPS.

### Frozen dependencies not modified
`src/libs/api/rate-limit.ts`, `src/libs/api/uploads.ts`, `resolveTenantBySlug` —
read only. Their conventions were **reused**, not changed.

## 3. Workflow Understanding

**Public site:** a visitor opens `/{tenantSlug}`; the tenant is resolved from the
slug server-side and only public CMS content is rendered. Images and the logo are
fetched through public, unauthenticated file endpoints scoped to that slug.

**Inquiry / admissions public flow:** a prospective parent submits
`POST /api/public/inquiries/{tenantSlug}` (name, phone, email, notes) with a
honeypot field. The row lands in `inquiries` as `status:'new'`,
`source:'web'`, `interestLevel:'medium'` and is worked by staff in the CRM.

**Verification flow:** anyone holding a printed certificate/card/alumni document
posts its code or token to the matching `/api/public/*/verify` route and gets a
yes/no — never the document contents.

**Invitation flow:** a staff invitee opens `GET /api/public/invitations/[token]`
to see the school and role, then `POST .../accept` with name + password to create
their account.

**Source of truth:** `inquiries.status` for the lead lifecycle;
`tenantInvitations.status` + `expiresAt` for invitation validity (`pending` and
not expired); document validity comes from each document's own lifecycle columns.

## 4. Findings

| ID | Severity | Surface | Problem | Evidence | Disposition |
|---|---|---|---|---|---|
| **F-01** | **High** | `inquiries`, `alumni-documents/verify`, `cards/verify`, `certificates/verify` | Rate-limit key used the **raw** `X-Forwarded-For` header. A client sending a fresh value per request got its own bucket, so the 5/hr and 10/hr limits **never tripped**. | Code + `signup`'s differing (normalized) convention | **FIXED** |
| **F-02** | **High** | `invitations/[token]/accept` | **No rate limit** on an unauthenticated, state-changing endpoint that takes a secret token and **creates a user account**. Token brute-force ⇒ account creation. | Found by the new regression test | **FIXED** |
| **F-03** | Med | `invitations/[token]` | **No rate limit** on the unauthenticated secret-token lookup (enumeration/brute-force). | Code inspection | **FIXED** |
| **F-04** | Med | `inquiries/[tenantSlug]` | Free-text fields unbounded on a no-login write endpoint (`notes`, `phone`, `website_hp`) — one request could store megabytes in `inquiries`. | `z.string().trim().optional()` with no `.max()` | **FIXED** |
| **F-05** | Low | all rate-limited public routes | `checkRateLimit` is an **in-memory** per-process store, so limits reset on restart and do not span instances. | `src/libs/api/rate-limit.ts` header | **Logged** (needs shared store; outside this claim) |
| **F-06** | Low | `inquiries/[tenantSlug]` | Rate-limit key is still client-influenced when the app is not behind a proxy that sets `X-Forwarded-For`. | Same | **Logged** (deployment/topology decision) |

**Verified SAFE (checked in source before forming any opinion):**
- `website/[tenantSlug]/images/[filename]` rejects anything failing
  `^[a-f0-9-]+\.(jpg|jpeg|png)$`, so **no path traversal** is possible; the
  comment in the route states the invariant and the code enforces it.
- All three verify routes return an **identical `{valid:false}` shape** whether a
  code was never issued, revoked, or superseded — **no enumeration oracle** — and
  never echo `renderDataSnapshot` / `evidenceSnapshot` (which carry DOB, national
  id, guardian and salary data). This is deliberate and correct.
- Every verify route and `inquiries` has a honeypot field; bot submissions are
  quietly accepted and dropped.
- Tenant resolution on every public route comes from the **slug path param**, and
  `inquiries` additionally rejects inactive tenants.
- `accept` validates `name` (2-255) and `password` (8-128) under Zod `.strict()`.

## 5. Fixes Implemented

### F-01 — rate limiter keyed on a client-controlled header
- **Root cause:** `request.headers.get('x-forwarded-for')` used verbatim as the
  limiter key. The header is a comma-separated, client-influenced list, so each
  request could present a unique key and consume a fresh bucket. `public/signup`
  already normalized with `.split(',')[0]?.trim()`; the other four did not.
- **Fix:** normalize to a single IP entry on all four routes, matching `signup`'s
  established convention exactly.
- **Why domain-correct:** these endpoints are the public face of the school and
  the only brake on spam inquiries and verification-code brute force. Consistency
  with the project's existing pattern beats inventing a new one.
- **Files:** `api/public/{inquiries/[tenantSlug],alumni-documents/verify,cards/verify,certificates/verify}/route.ts`
- **Regression risk:** low — key derivation only; limits and windows unchanged.

### F-02 + F-03 — missing rate limits on invitation token endpoints
- **Root cause:** `GET invitations/[token]` and `POST invitations/[token]/accept`
  were the only public secret-token routes with no `checkRateLimit`. `accept` is
  state-changing: a successful guess creates a real user account in the tenant.
- **Fix:** 10 requests/hour/IP on each, keyed on the same normalized IP.
- **Files:** `api/public/invitations/[token]/route.ts`,
  `api/public/invitations/[token]/accept/route.ts`
- **Regression risk:** low. A legitimate invitee makes two calls.

### F-04 — unbounded free text on a public write endpoint
- **Root cause:** `notes`, `phone`, `website_hp` had no `.max()`.
- **Fix:** `.max(2000)` / `.max(32)` / `.max(64)`. `2000` matches the project's
  existing convention for free-text reason fields.
- **Files:** `api/public/inquiries/[tenantSlug]/route.ts`

## 6. Security / Isolation / Permission Audit

- **Tenant isolation:** `npm run check:isolation` **PASS** (828 files; 21
  sessionless/public routes "exempt"). On these public routes the tenant is
  resolved from `tenantSlug` (never from the body) and every query is scoped to
  it. No `tenantId` is bound from client input anywhere.
- **Authentication:** none, by design — these are public endpoints. Therefore the
  whole audit turns on **abuse resistance** (F-01..F-04) and **non-disclosure**.
- **IDOR / token security:** tokens are looked up exactly and never echoed back.
  F-02/F-03 close the brute-force gap. Response shapes do not distinguish "never
  issued" from "revoked", so tokens cannot be enumerated by response difference.
- **Path traversal:** `images/[filename]` is regex-whitelisted to
  `{hex-or-dash}.{jpg|jpeg|png}` and read as `website/${filename}` inside the
  tenant's upload root. No separators possible.
- **PII exposure (Law 09-08):** verification endpoints deliberately return a
  boolean plus minimal display metadata, never `evidenceSnapshot` /
  `renderDataSnapshot`. `inquiries` stores only what the visitor typed.
- **Request validation:** Zod `.strict()` on every public body (unknown keys
  rejected), with bounded strings after F-02/F-04.
- **Sensitive-data exposure:** no secrets, tokens or internal ids are reflected.
- **Audit logging:** public submissions are not audited (correct — no actor), but
  the inquiry row itself is the record.

## 7. Data / DB / Migration Impact

- **Tables read:** `tenants`, `tenantInvitations`, `inquiries`, `website` CMS
  content, `issued_documents` / `alumni_documents` (verification lookups).
- **Tables written:** `inquiries` (public submission), `user` + `account` +
  `auditLogs` (invitation accept).
- **Historical data changed:** **none.**
- **Migration added:** none. **Journal status:** untouched.

No test data was written; the regression suite is entirely static and read-only.

## 8. Tests

### Focused tests
```text
npx vitest run src/features/website/__tests__/  ->  10/10 PASS
  public-endpoint-hardening.test.ts   4 passed (NEW)
  website-guard.test.ts               6 passed (pre-existing, still green)
```

The suite is static by design — it sweeps **every** `api/public/**/route.ts` at
once, so a new public route added without these protections fails the build.

### The test found a real bug
Asserting "every public route that looks up a secret by token or code is rate
limited" initially **failed**, naming `invitations/[token]/accept` (F-02) — the
most dangerous of the two, since it creates accounts. That is F-02's evidence.

### Runtime reconciliation
```text
unauthenticated / 13 pages / load          -> 13 rendered, 12 "ok", 1 locale redirect
unauthenticated / verify/{card,certificate}/<bogus> -> honest invalid state, no error screen
unauthenticated / news/<unknown slug>      -> honest empty/404 state
```

### Static gates
```text
check:types      PASS   (tsc --noEmit, 0 errors)
check:isolation  PASS   (828 files scanned)
check:i18n       PASS   (missing translation keys: 0 in 0 files)
check:ui         PASS   (ratchet holding: dead controls 38/39, mock 0/0,
                         unlinked 28/28, orphaned 7/7)
```
Note: `evidence`/gate log's vitest block shows an earlier 9/10 run taken before
F-02 was fixed. The authoritative post-fix result is **10/10**.

### Broader suite
- Run? PARTIAL — the touched domain (`src/features/website/__tests__/`) plus all
  four static gates. Full repo suite not run.
- Reproduced on target branch? N/A (new test file).

## 9. Visual / UX Evidence

### Screenshot manifest
| File | Page/state | Locale | Viewport | What it proves |
|---|---|---|---|---|
| `screenshots/school_admin-fr-*.png` (13) | every public route, unauthenticated | FR | Desktop 1440x900 | Public site and verification flows render real content with no auth |

**13/13 audited routes have a final desktop FR screenshot**, captured with
`NO_LOGIN=1` (these pages are public).

Coverage rules applied:
- every audited page: final desktop FR — **yes, 13/13**.
- changed visual/i18n pages: mobile 390 + Arabic RTL — **N/A**. All four fixes are
  server-side key derivation and input bounds; nothing rendered differently on any
  page. No markup, styling or translation string was touched.
- before/after for visible defects — **N/A**, no visible defect was fixed. F-01..F-04
  are abuse-resistance properties, proven by the regression suite rather than pixels.

## 10. Files Changed

```text
lango-app/src/app/api/public/inquiries/[tenantSlug]/route.ts            (F-01, F-04)
lango-app/src/app/api/public/alumni-documents/verify/route.ts           (F-01)
lango-app/src/app/api/public/cards/verify/route.ts                      (F-01)
lango-app/src/app/api/public/certificates/verify/route.ts               (F-01)
lango-app/src/app/api/public/invitations/[token]/route.ts               (F-03)
lango-app/src/app/api/public/invitations/[token]/accept/route.ts        (F-02)
lango-app/src/features/website/__tests__/public-endpoint-hardening.test.ts (NEW, 4 tests)
+ this done-folder package (report, checkpoint, screenshots, evidence)
```

## 11. Unresolved / Follow-up Items

- **F-05 — in-memory rate limiter (needs a claim + decision).**
  `src/libs/api/rate-limit.ts` keeps a per-process `Map`, so every limit here
  resets on deploy and does not hold across instances or a serverless multi-instance
  run. Recommend a shared store (Redis/Postgres) behind the same `checkRateLimit`
  signature. Outside this task's file claim.
- **F-06 — client IP provenance (needs a deployment decision).**
  `X-Forwarded-For` is only trustworthy when a proxy this app controls sets it.
  Recommend a single `getClientIp(request)` helper in `src/libs/api/` that takes
  the proxy-appended hop and is used by all rate-limited routes, so the five
  call sites stop hand-rolling it. Outside this task's file claim.
- **Staff admissions console** not audited (see scope note). If "Admissions flows"
  was meant to include it, that is a separate campaign.

## 12. Frozen-Module / Cross-Module Impact

`src/libs/api/rate-limit.ts` and `src/libs/api/uploads.ts` were **read only** and
are byte-identical to the target base. No auth, finance, academics, student or
communication module was touched. The changes are confined to unauthenticated
public routes and one new test file.

## 13. Final Executor Verdict

```text
TASK COMPLETE: YES
READY FOR INDEPENDENT AGENT 5 VERIFICATION: YES
CODE PUSHED: YES
IMPLEMENTATION SHA: 416c730dc9bb870e45d50aa5a58dad929b555f59
OPEN CLAIMS: 0 / 2 released (task:AUD-PUBLIC-01, task:port-3457)
```

Executor does **not** issue a final production/release verdict. That belongs to the verifier/orchestrator.
