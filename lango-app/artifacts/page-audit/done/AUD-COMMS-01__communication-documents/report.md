# AUD-COMMS-01 — Communication + Documents + Requests — Executor Report

## 1. Handoff Metadata

- Executor: codex-2 (Executor C)
- Date: 2026-09-24
- Target branch: `origin/student-directory-hardening`
- Target/base SHA: `f42c2bc41cb2386afed52244c5355c31c8a91f96`
- Implementation branch: `audit/agent-c/AUD-COMMS-01-communication-documents`
- Implementation SHA(s): see §13 (filled at commit time)
- Hub item: `task:AUD-COMMS-01` (+ `task:port-3456`)
- Done folder: `lango-app/artifacts/page-audit/done/AUD-COMMS-01__communication-documents/`

## 2. Scope

Route inventory was **discovered**, not assumed: `src/libs/api/portal-manifest.ts`
(server-owned navigation), the portal manifest API, and each page's
`requireServerPage` guard. 42 routes.

### Pages audited

| # | Route | Role | Purpose | Result |
|---|---|---|---|---|
| 1 | `/dashboard/communication` | school_admin | Comms hub | PASS (intentional redirect → campaign-composer) |
| 2 | `/dashboard/communication/broadcast` | school_admin | Broadcast send | PASS |
| 3 | `/dashboard/communication/campaign-composer` | school_admin | Campaign composer | PASS |
| 4 | `/dashboard/communication/crm` | school_admin | Inquiries/CRM | PASS |
| 5 | `/dashboard/communication/delivery-reports` | school_admin | Delivery/status history | PASS |
| 6 | `/dashboard/communication/events` | school_admin | Legacy alias | PASS (intentional redirect → `/dashboard/events`) |
| 7 | `/dashboard/communication/reminders` | school_admin | SMS/reminder runs | PASS |
| 8 | `/dashboard/communication/templates` | school_admin | Message templates | PASS |
| 9 | `/dashboard/broadcast` | school_admin | Broadcast addon overview | PASS |
| 10 | `/dashboard/broadcast/automations` | school_admin | Automated sends | PASS |
| 11 | `/dashboard/broadcast/campaigns` | school_admin | Campaigns | **FIXED (F-01)** |
| 12 | `/dashboard/broadcast/campaigns/[id]` | school_admin | Campaign detail/report | PASS |
| 13 | `/dashboard/broadcast/connections` | school_admin | Provider connections | PASS |
| 14 | `/dashboard/broadcast/reports` | school_admin | Broadcast reporting | PASS |
| 15 | `/dashboard/broadcast/segments` | school_admin | Recipient targeting | PASS |
| 16 | `/dashboard/broadcast/templates` | school_admin | Broadcast templates | PASS |
| 17 | `/dashboard/certificates` | school_admin | Certificates hub | PASS |
| 18 | `/dashboard/certificates/definitions` | school_admin | Certificate definitions | PASS |
| 19 | `/dashboard/certificates/definitions/[id]` | school_admin | Definition detail | PASS |
| 20 | `/dashboard/certificates/issue/students` | school_admin | Issue to students | PASS |
| 21 | `/dashboard/certificates/issue/employees` | school_admin | Issue to employees | PASS |
| 22 | `/dashboard/certificates/issued` | school_admin | Issued document register | PASS |
| 23 | `/dashboard/certificates/issued/[id]` | school_admin | Issued document detail | PASS (404 state honest; see F-05) |
| 24 | `/dashboard/certificates/jobs` | school_admin | Generation jobs | PASS |
| 25 | `/dashboard/certificates/requests` | school_admin | **Document requests** | PASS |
| 26 | `/dashboard/certificates/settings` | school_admin | Certificate settings | PASS |
| 27 | `/dashboard/certificates/templates` | school_admin | Document templates | PASS |
| 28 | `/dashboard/certificates/templates/[id]/edit` | school_admin | Template editor | PASS |
| 29 | `/dashboard/cards` | school_admin | ID cards hub | PASS |
| 30 | `/dashboard/cards/admit-cards` | school_admin | Admit cards | PASS |
| 31 | `/dashboard/cards/employees` | school_admin | Employee cards | PASS |
| 32 | `/dashboard/cards/issued` | school_admin | Issued cards | PASS |
| 33 | `/dashboard/cards/jobs` | school_admin | Card generation jobs | PASS |
| 34 | `/dashboard/cards/students` | school_admin | Student cards | PASS |
| 35 | `/dashboard/cards/templates` | school_admin | Card templates | PASS |
| 36 | `/dashboard/cards/templates/[id]/edit` | school_admin | Card template editor | PASS |
| 37 | `/dashboard/documents/generator` | school_admin | Document Studio | PASS |
| 38 | `/dashboard/settings/notifications` | school_admin | Comms settings | PASS |
| 39 | `/dashboard/students/alumni/requests` | school_admin | Admin requests | **DEFECT (F-04, logged)** |
| 40 | `/dashboard/super-admin/sms` | school_admin | Platform SMS | PASS (correctly denied to school_admin) |
| 41 | `/dashboard/parent/communication` | parent | Parent comms | PASS |
| 42 | `/dashboard/parent/requests` | parent | Parent requests | PASS |

### Explicitly out of scope
- `/dashboard/finance/reminders` — finance module, owned by another agent's claim.
- `src/features/alumni`, `src/app/api/settings`, `src/app/api/students` — outside this
  task's file claim (see F-02, F-03, F-04).
- Deploying to the VPS.

### Frozen dependencies not modified
The communication core's delivery-truth semantics (below) were **measured against,
never changed**. `src/features/broadcast/services/sms-delivery.ts` and
`src/features/broadcast/services/outbox-worker.ts` were read only.

## 3. Workflow Understanding

**Communication:** an admin composes a message or campaign, targets recipients
(manual, a `segment`, or a reminder audience), optionally schedules it, and the
outbox worker dispatches per recipient through a configured provider connection.
Each recipient produces a `communication_deliveries` row plus an append-only
`communication_delivery_events` history. Consent and suppression are re-checked
immediately before dispatch. Retries use exponential backoff with jitter and a
`lockedUntil` claim so two workers cannot double-send.

**Documents:** a `definition`/`template` (+ version) drives generation. Issuing runs
through a `job` (batch) or a single `issue`, producing `issued_documents` that can
be replaced, revoked, or rendered to PDF. **Document requests** (`certificates/requests`)
are a review queue: submitted → decided → issued.

**Source of truth:** delivery state lives in `communication_deliveries.status` with
`communication_delivery_events` as the immutable history. Document truth lives in
`issued_documents` lifecycle columns; jobs track batch progress.

## 4. Findings

| ID | Severity | Page/Workflow | Problem | Evidence | Disposition |
|---|---|---|---|---|---|
| **F-01** | **High** | Announcements → alumni SMS | **FROZEN MODULE CONTRADICTION.** Wrote `smsMessages` with `status:'sent'` + `sentAt:<now>` and **no provider call**. Also skipped consent/suppression checks and Moroccan phone normalization. | `evidence/frozen-semantics.md` | **FIXED** |
| **F-02** | **High** | Access-reset SMS | **FROZEN MODULE CONTRADICTION.** Same fabricated `sent` + `sentAt` with no provider. Also stores `guardian?.phone ?? '—'` as a placeholder phone. | `api/settings/access-reset/route.ts:85-91` | **DOCUMENTED** (out of claim) |
| **F-03** | **High** | Regenerate student access SMS | **FROZEN MODULE CONTRADICTION.** Same fabricated `sent` + `sentAt` with no provider. | `api/students/[id]/regenerate-access/route.ts:71-78` | **DOCUMENTED** (out of claim) |
| **F-04** | Med | `/dashboard/students/alumni/requests` | ICU error at runtime: `IntlError: FORMATTING_ERROR: The intl string context variable "count" was not provided to the string "{count} demandes"` — the requests counter renders broken in FR. | Sweep console capture | **DOCUMENTED** (out of claim) |
| **F-05** | Low | `/dashboard/certificates/issued/[id]` | The detail API 404s for an id from the generic `issued_documents` table. Page shows the 404 honestly; the id I probed is not a certificate-scoped document. | `GET /api/certificates/issued/… 404` | **Logged** (test-data artifact, not a product defect) |

**Verified NOT defects** (checked in source before reporting):
- `/dashboard/communication` → `campaign-composer` is a deliberate `redirect()`.
- `/dashboard/communication/events` → `/dashboard/events` is a deliberate legacy
  alias (`OldEventsCalendarPage`).
- All 33 `api/addons/broadcast/*` routes showing no `requireCapability` on a grep
  use `broadcastGuard(request, permission)` = session → tenant →
  `requireAddon('broadcast-messaging')` → `requireCapability`. Complete.
- `api/communication/{messages,templates}` gate on role `['school_admin']` instead
  of a capability key — accepted pattern in this codebase, not a gap.
- `api/notifications` has no role/capability but self-scopes strictly by
  `context.userId` + `tenantId`. No IDOR.
- `retryDelivery` refuses `queued`/`sent`/`delivered` and only requeues
  `failed`/`bounced`, so **no duplicate sending**.

## 5. Fixes Implemented

### F-01 — fabricated `sent` on announcement SMS
- **Root cause:** the alumni fan-out did a raw `db.insert(smsMessages)` with
  `status:'sent'` and `sentAt: new Date().toISOString()`, never calling a provider.
  This is exactly the pattern `api/attendance/route.ts` calls out as forbidden
  ("never as a raw 'sent' row … No provider success means no 'sent'").
- **Fix:** route the fan-out through `sendSmsMessages()` — the authoritative
  dispatcher, which already encodes the frozen rules — and drop the raw insert.
- **Why domain-correct:** restores the frozen semantics rather than changing them.
  Un-configured tenants now record `queued` + `sentAt: null`; real providers record
  `sent` + `sentAt`; provider acknowledgements record `delivered`; failures record
  `failed`. Consent/suppression and `normalizeMoroccanPhone` now apply, matching
  every other send path.
- **Files changed:** `src/app/api/communication/announcements/route.ts`
- **Regression risk:** low — one fan-out path; the announcement row itself and its
  audit entry are unchanged. `src/app/api/communication/messages` already used the
  dispatcher and is unaffected.

## 6. Security / Isolation / Permission Audit

- **Tenant isolation:** `npm run check:isolation` **PASS** — "774 tenant-scoped
  routes, 26 super-admin (all assert super_admin), 7 self-scoped (all establish a
  context), 21 sessionless/public (exempt)". No route binds `tenantId` from client
  input. Every audited route scopes its queries by `eq(tenantId, ctx.tenantId)`.
- **Branch isolation:** broadcast/certificate/card services take tenant scope; no
  cross-branch leak found in the audited read/write paths.
- **Page guard:** all 42 pages call `requireServerPage` with a capability. Direct
  URL as a wrong role is truthfully denied (`/dashboard/super-admin/sms` →
  `/fr/dashboard` for school_admin).
- **API guard:** `api/addons/broadcast/*` via `broadcastGuard` (verified complete);
  `api/cards|certificates|crm` run the full `requireRequestContext → requireTenant →
  requireCapability` pipeline; `api/communication/*` mixes capability keys and
  `['school_admin']` role gating.
- **Add-on/entitlement:** broadcast routes require `broadcast-messaging`.
- **IDOR/object ownership:** every lookup is `WHERE id = ? AND tenantId = ?`
  (`listDeliveryEvents`, `retryDelivery`, certificate/card `[id]` routes).
  `api/notifications` self-scopes by `userId`.
- **Request validation:** Zod `.strict()` on bodies (campaign channel enum, UUID
  ids, length bounds).
- **Recipient targeting / consent:** `checkConsent` is re-evaluated in
  `processDelivery` immediately before dispatch, and `communication_suppressions`
  are honoured. F-01's path previously **bypassed** both; it now honours them.
- **Duplicate sending:** outbox claims rows with `lockedUntil`; `retryDelivery`
  leaves `queued` alone and refuses `sent`/`delivered`. Verified no double-send.
- **Sensitive-data exposure:** provider secrets come from
  `getConnectionWithSecrets` and are never returned to the client.
- **Audit logging:** all mutating routes call `recordAudit(...)`.

## 7. Data / DB / Migration Impact

- **Tables read:** `communication_*` (13), `announcements`, `smsMessages`,
  `certificate_*`, `document_*`, `issued_documents`, `document_generation_*`,
  `user`, `tenants`, `notifications`.
- **Tables written:** `smsMessages` (via the dispatcher instead of a raw insert),
  `announcements`.
- **Historical data changed:** **none.**
- **Migration added:** none. **Journal status:** untouched.

One inert probe row (`AUD-COMMS-01 delivery-truth probe (inert)`) is written to
`schoolos_audit` by the test suite — no student, no creator, no provider traffic.

## 8. Tests

### Focused tests
```text
npx vitest run src/features/broadcast/__tests__/  ->  3/3 PASS
  delivery-truth.test.ts — frozen truth values; sent⇒sentAt; simulated⇒not sent;
  failed⇒failed; delivered⇒provider evidence only; static scan of every
  api/**/route.ts for the insert(smsMessages)+'sent' pattern
```

### Regression proof the test bites
```text
pre-fix announcements code restored:
  × rejects the fabricated-sent pattern in every API route
  AssertionError: expected [ Array(1) ] to deeply equal []
  + [ "src/app/api/communication/announcements/route.ts" ]
  Tests  1 failed | 2 skipped
fix restored -> 3/3 PASS
```

### Runtime reconciliation
```text
role / route / check                                              -> result
school_admin / 40 staff routes / render real data                 -> 40 captured ok
school_admin / /dashboard/super-admin/sms / direct URL            -> denied  PASS
school_admin / /dashboard/students/alumni/requests / render       -> ICU error (F-04)
parent / /dashboard/parent/{communication,requests} / render      -> 2 captured ok
any / /dashboard/communication, /communication/events / load      -> intentional redirect
```

### Static gates
```text
check:types      PASS   (tsc --noEmit, 0 errors)
check:isolation  PASS   (828 files scanned)
check:i18n       PASS   (missing translation keys: 0 in 0 files)
check:ui         PASS   (ratchet holding: dead controls 38/39, mock 0/0,
                         unlinked 28/28, orphaned 7/7)
```
`check:i18n` passes on **key presence**; F-04 is an **ICU variable** mismatch it
does not detect. The shared `scripts/ui-reality-baseline.json` was not edited (the
"1 category improved" drift predates this task and belongs to its owner).

### Broader suite
- Run? PARTIAL — the new focused suite plus all four static gates. Full repo suite not run.
- Result: 3/3 in-domain, all gates green.
- Reproduced on target branch? N/A (new test file).

## 9. Visual / UX Evidence

### Screenshot manifest
| File | Page/state | Locale | Viewport | What it proves |
|---|---|---|---|---|
| `screenshots/school_admin-fr-*.png` (40) | every staff-facing route, final state | FR | Desktop 1440x900 | Each audited staff page renders real data |
| `screenshots/parent-fr-parent__{communication,requests}.png` (2) | parent self-service under the real role | FR | Desktop | Parent comms + requests render their own data |

**42/42 audited routes have a final desktop FR screenshot.** All 42 PNGs verified
non-error (no `chrome-error://` capture survived; the first pass lost 17 shots to a
dev-server crash and all 17 were re-captured cleanly).

Coverage rules applied:
- every audited page: final desktop FR — **yes, 42/42**.
- changed visual/i18n pages: mobile 390 + Arabic RTL — **N/A**. F-01 is a
  service-layer/behaviour change with no markup, styling or translation change;
  nothing rendered differently except message status honesty, which is a data
  state, not a layout. Mobile/RTL would not exercise it.
- before/after for visible defects — **N/A**. F-01 is not visually reproducible on
  a read-only sweep (it needs an alumni-targeted announcement send). Its before/after
  is captured at the test level with an exact failure message instead.

## 10. Files Changed

```text
lango-app/src/app/api/communication/announcements/route.ts       (F-01 fix)
lango-app/src/features/broadcast/__tests__/delivery-truth.test.ts (NEW, 3 tests)
+ this done-folder package (report, checkpoint, screenshots, evidence)
```

## 11. Unresolved / Follow-up Items

- **F-02 / F-03 — FROZEN MODULE CONTRADICTION (needs a claim + fix).** Both write
  `status:'sent'` + `sentAt` with no provider. Files sit in `api/settings`
  (held by codex-3 / AUD-SETTINGS-01) and `api/students`. The fix is identical to
  F-01: call `sendSmsMessage` instead of a raw insert. The delivery-truth test pins
  both as `KNOWN_CONTRADICTIONS`, so removing each from that set when fixed keeps
  the suite green and tightens it.
- **F-04 — ICU variable missing (needs a claim + fix).**
  `/dashboard/students/alumni/requests` renders `{count} demandes` without a `count`
  variable. One-line fix in `src/features/alumni` (pass `count`) or correct the
  locale string. Runtime error, visible to school_admin.

## 12. Frozen-Module / Cross-Module Impact

The frozen delivery-truth semantics were **not modified**. The fix moves one call
site *onto* the frozen dispatcher, so the semantics are now honoured in one more
place. `sms-delivery.ts` and `outbox-worker.ts` are byte-identical to the target
base. No finance, payroll, attendance, grading or transport module was touched.

Full analysis with before/after code: `evidence/frozen-semantics.md`.

## 13. Final Executor Verdict

```text
TASK COMPLETE: YES
READY FOR INDEPENDENT AGENT 5 VERIFICATION: YES
CODE PUSHED: YES
IMPLEMENTATION SHA: a838056c2765f6cc33f2b987c1b025da012ff7db
OPEN CLAIMS: 0 / 2 released (task:AUD-COMMS-01, task:port-3456)
```

Executor does **not** issue a final production/release verdict. That belongs to the verifier/orchestrator.
