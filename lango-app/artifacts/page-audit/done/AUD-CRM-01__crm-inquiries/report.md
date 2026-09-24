# AUD-CRM-01 — CRM & Diffusion — Executor Report

## 1. Handoff Metadata

- Executor: codex-2 (Executor C)
- Date: 2026-09-24
- Target branch: `origin/student-directory-hardening`
- Target/base SHA: `f42c2bc41cb2386afed52244c5355c31c8a91f96`
- Implementation branch: `audit/agent-c/AUD-CRM-01-crm-inquiries`
- Implementation SHA(s): see §13
- Hub item: `task:AUD-CRM-01` (+ `task:port-3464`)
- Done folder: `lango-app/artifacts/page-audit/done/AUD-CRM-01__crm-inquiries/`
- Collision check before claim: **clean**
- **AUD-PLATFORM-01 is not abandoned** — branch
  `audit/agent-c/AUD-PLATFORM-01-platform-entitlements` is pushed with its
  checkpoint preserved, state BLOCKED — MISSING SUPER_ADMIN TOTP ACCESS.

## 2. Claim decision (the brief asked for this explicitly)

**CRM is substantial and unclaimed, so it was claimed** rather than reported as a shell:

- `src/features/crm` — **2,997 lines**: `inquiries-service.ts` (428),
  `inquiries-kanban-view.tsx` (872), plus the two Diffusion UIs and two test suites.
- `src/app/api/crm` — **5 routes** (inquiries root, `[id]`, `[id]/duplicates`,
  `[id]/follow-ups`, `merge`).
- Data model: `inquiries` (contactName, phone, email, assignedToId, notes, tags[],
  source, status, interestLevel, convertedApplicantId) + `inquiry_follow_ups`
  (notes, scheduledFor, completedAt, createdById).

**What "Diffusion" actually is:** the campaign composer and delivery reports UIs
live in `src/features/crm`, but they render over the **frozen Communication**
backend. Captured and checked for integration only; delivery internals untouched.

**What does not exist:** there is no `contacts`, `leads`, `segments` or
`campaign_audiences` table. Segments live in `broadcast-schema`
(`communication_segments`) and audiences in `event_audience_rules` (calendar).
"Consent boundaries" are `communication_consents` / `communication_suppressions` —
the frozen Communication domain (audited in AUD-COMMS-01).

## 3. Scope

### Pages audited

| # | Route | Role(s) | Purpose | Result |
|---|---|---|---|---|
| 1 | `/dashboard/communication/crm` | school_admin, teacher | Lead pipeline kanban | **FIXED (F-01)** |
| 2 | `/dashboard/communication/campaign-composer` | school_admin | Diffusion composer | PASS (delivery internals frozen) |
| 3 | `/dashboard/communication/delivery-reports` | school_admin | Diffusion reports | PASS (delivery internals frozen) |

### API surface audited (5)
`GET|POST /api/crm/inquiries`, `GET|PUT|DELETE /api/crm/inquiries/[id]`,
`GET /api/crm/inquiries/[id]/duplicates`,
`GET|POST /api/crm/inquiries/[id]/follow-ups`,
`POST /api/crm/inquiries/merge`.

### Explicitly out of scope
- Frozen Communication/SMS delivery internals (`outbox-worker`, `sms-delivery`,
  `consent-service`, `segments-service`, `deliveries-service`).
- The verified Admissions lifecycle (AUD-ADMISSIONS-02). `convertInquiryToApplicant`
  is the **hand-off into** it; the admissions state machine was not redesigned.
- Reception workflows.

## 4. Workflow Understanding

`inquiry / lead → duplicate detection → merge → follow-up pipeline → convert to
admissions applicant → historical record`

Leads arrive from the public inquiry form (`api/public/inquiries/[tenantSlug]`,
audited in AUD-PUBLIC-01) or are entered by staff. A lead moves through `status`
and `interestLevel`, gains `inquiry_follow_ups`, and can be merged into a primary
record or converted into an `applicants` row.

**Source of truth:** `inquiries.convertedApplicantId` marks a completed conversion
(and is what protects the lead from deletion); `inquiry_follow_ups` is the
follow-up history; `applicants` is the admissions-side record.

## 5. Findings

| ID | Severity | Surface | Problem | Evidence | Disposition |
|---|---|---|---|---|---|
| **F-01** | **High** | `convertInquiryToApplicant` | Not concurrency-safe: the insert and update ran **outside** a transaction with no row lock, and the guard required `status === 'converted' && convertedApplicantId`. A double-click or retry passed the read twice and created **two applicants from one lead**; a half-written row slipped past the guard entirely. | Read-then-write with no `for('update')` | **FIXED** |
| **F-02** | Med | same | Conversion **fabricates contact data**: `phone: … || '0600000000'` and `email: … || 'prospect-…@schoolos.local'`. `applicants.email`/`phone` are **NOT NULL**, so a placeholder is unavoidable — but `0600000000` is a syntactically valid Moroccan mobile that could one day belong to a real person, and SMS could be sent to it. | `applicants` schema | **CLASSIFIED** (see §11) |

**Verified NOT defects (checked in source first):**

- **`deleteInquiry`** is tenant-scoped and **refuses** to delete a converted lead
  (`CONVERTED_CANNOT_DELETE`), so the applicant link is never orphaned.
- **`mergeInquiries`** runs in one transaction, verifies every secondary exists,
  refuses converted rows (`CONVERTED_CANNOT_MERGE`), re-points follow-ups to the
  primary, unions tags, concatenates notes with a separator, then deletes the
  secondaries — no follow-up history is lost.
- **`findDuplicateCandidates`** is tenant-scoped, honours `excludeId`, capped at 10.
- **Role boundary:** a teacher hitting the CRM is honestly bounced to
  `access-denied` (captured). CRM is staff-only.
- **Tenant isolation:** `npm run check:isolation` PASS; every query scopes by tenant.

## 6. Fixes Implemented

### F-01 — double conversion under concurrency
- **Root cause:** read-then-write with no lock, and a guard that required two
  conditions to both be true.
- **Fix:** wrap insert + link update in `db.transaction` with `.for('update')` on
  the inquiry row (the same pattern `issueCopy` and `cancelEvent` already use),
  and treat **either** `convertedApplicantId` or `status === 'converted'` as done.
  The audit entry is written after the transaction commits.
- **Files:** `src/features/crm/services/inquiries-service.ts`
- **Regression risk:** low. Same behaviour on the happy path; concurrent submits now
  get one applicant and one `422 ALREADY_CONVERTED`.

## 7. Security / Isolation / Permission Audit

- **Tenant isolation:** `check:isolation` **PASS** (828 files). Merge, convert,
  delete and duplicate lookups are all tenant-scoped, and merge re-checks every
  secondary under the same tenant.
- **IDOR / object ownership:** `assertInquiryExists` guards the follow-up routes;
  merge refuses ids belonging to another tenant (404).
- **Request validation:** Zod `.strict()` bodies.
- **Destructive actions:** delete refuses converted leads; merge preserves
  follow-ups, tags and notes before deleting; both are audited.
- **Consent boundaries:** `communication_consents` / `communication_suppressions`
  are enforced inside the frozen Communication delivery path (verified in
  AUD-COMMS-01, unchanged here).
- **Audit logging:** `recordAudit` on create, update, merge and conversion.

## 8. Data / DB / Migration Impact

- **Tables read:** `inquiries`, `inquiry_follow_ups`, `applicants`.
- **Tables written:** `applicants` (on conversion), `inquiries` (status/link).
- **Historical data changed:** **none.**
- **Migration added:** none. **Journal status:** untouched.

## 9. Tests

```text
npx vitest run src/features/crm src/app/api/crm  ->  17/17 PASS (3 files)

new: conversion-integrity.test.ts (5)
  - the inquiry row is locked so two concurrent converts cannot both win
  - applicant + link are written in one transaction (no bare insert/update left)
  - either signal counts as already converted
  - a converted lead can never be deleted or merged away
  - merge keeps follow-ups, tags and notes
pre-existing (all green):
  inquiries-guard.test.ts, inquiries-duplicate-merge-convert.test.ts
```

**The tests caught a real mistake in my own fix:** a heredoc ate the backslash in
`split(/\s+/)`, turning it into `split(/s+/)` and splitting names on the letter
"s" (`Yassine` → `Ya`). Two existing conversion tests failed immediately and the
regex was rebuilt without escapes.

### Static gates

```text
check:types      PASS   (tsc --noEmit, 0 errors)
check:isolation  PASS   (828 files)
check:i18n       PASS
check:i18n:keys  PASS   (0 missing)
check:ui         PASS   (ratchet holding)
eslint touched   PASS   (0 problems)
```

## 10. Visual / UX Evidence

| File | Page/state | Locale | Viewport | What it proves |
|---|---|---|---|---|
| `screenshots/school_admin-fr-communication__crm.png` | lead pipeline kanban | FR | Desktop 1440x900 | Real leads render |
| `screenshots/school_admin-fr-communication__campaign-composer.png` | Diffusion composer | FR | Desktop | Composer over frozen delivery |
| `screenshots/school_admin-fr-communication__delivery-reports.png` | Diffusion reports | FR | Desktop | Reports render |
| `screenshots/teacher-fr-communication__crm.png` | CRM as teacher | FR | Desktop | Honest `access-denied` |
| `screenshots/mobile/school_admin-phone-communication__crm.png` | kanban | FR | 390x844 | Mobile usable |
| `screenshots/arabic/school_admin-ar-communication__crm.png` | kanban | AR | Desktop | RTL renders |

**6 screenshots.** Every audited page has desktop FR; the main screen also has
mobile 390 and Arabic RTL.

## 11. Unresolved / Follow-up Items

- **F-02 — fabricated contact data on conversion (product/schema decision).**
  `applicants.email` and `applicants.phone` are `NOT NULL`, so a lead without
  contact details is written with `0600000000` and
  `prospect-<id>@schoolos.local`. The email is obviously synthetic; the phone is
  not, and it is dialable. Recommend making those columns **nullable** with a
  contact-incomplete flag, or substituting an RFC-reserved non-dialable marker.
  Not changed here: it is a schema change affecting the admissions module.
- **Duplicate detection is exact-match only** on phone/email. A differently
  formatted phone (`+2126…` vs `06…`) will not match. Normalising before compare
  would raise recall; it is a product choice on false-positive tolerance.
- **Consent boundaries** belong to the frozen Communication delivery path and were
  verified only at the integration level.

## 12. Frozen-Module / Cross-Module Impact

Frozen Communication delivery internals and the Admissions lifecycle were **not**
modified. `convertInquiryToApplicant` is the hand-off into admissions and only its
own transactional safety changed; the applicant row shape and the admissions state
machine are untouched.

Regression evidence: the two pre-existing CRM suites (guard, duplicate/merge/convert)
still pass, and `check:isolation` is green.

## 13. Final Executor Verdict

```text
TASK COMPLETE: YES
READY FOR INDEPENDENT AGENT 5 VERIFICATION: YES
CODE PUSHED: YES
IMPLEMENTATION SHA: b8c7742a63e2bd071366dbbcf6316e4da084fe42
OPEN CLAIMS: 0 / 2 released (task:AUD-CRM-01, task:port-3464)
READY FOR AGENT 5: YES
```

Executor does **not** issue a final production/release verdict. That belongs to the verifier/orchestrator.
