# AUD-SUPPORT-RECEPTION-01 — Support Tickets + Reception / Front Desk — Executor Report

## 1. Handoff Metadata

- Executor: codex-2 (Executor C)
- Date: 2026-09-24
- Target branch: `origin/student-directory-hardening`
- Target/base SHA: `f42c2bc41cb2386afed52244c5355c31c8a91f96`
- Implementation branch: `audit/agent-c/AUD-SUPPORT-RECEPTION-01-support-reception`
- Implementation SHA(s): see §13
- Hub item: `task:AUD-SUPPORT-RECEPTION-01` (+ `task:port-3460`)
- Done folder: `lango-app/artifacts/page-audit/done/AUD-SUPPORT-RECEPTION-01__support-reception/`
- Collision check before claim: **clean** (antigravity-1 held HR/workforce only)

## 2. Scope

Route inventory discovered from the filesystem and guards, not assumed.

### Pages audited (8)

| # | Route | Role(s) | Purpose | Result |
|---|---|---|---|---|
| 1 | `/dashboard/support` | school_admin | Tenant support tickets + attachments | **FIXED (F-01)** |
| 2 | `/dashboard/super-admin/support` | super_admin | Platform ticket desk | PASS (correctly denied to school_admin) |
| 3 | `/dashboard/receptionist` | receptionist | Front-desk home | PASS |
| 4 | `/dashboard/receptionist/inquiries` | receptionist | Inquiry intake + follow-ups | PASS |
| 5 | `/dashboard/receptionist/handoffs` | receptionist | Handoffs / tasks | PASS |
| 6 | `/dashboard/receptionist/appointments` | receptionist | Appointment workflow | PASS |
| 7 | `/dashboard/receptionist/visitors` | receptionist | Visitor register + passes | PASS |
| 8 | `/dashboard/receptionist/pickups` | receptionist | Student pickup release | PASS (honest forbidden state, see F-02) |

### API surface audited
**Support (5):** `POST|GET /api/support/upload`, `/api/tenant/support`,
`/api/super-admin/support`, table `platform_support_tickets`.

**Reception (27):** `appointments` (8 incl. cancel/check-in/complete/no-show/reschedule),
`handoffs` (5), `inquiries` (3 incl. follow-ups), `visitors` (5),
`pickups` (5), plus `gates`, `lookup`, `me/home`, `staff`, `verifications`.

### Explicitly out of scope
- The **Admissions** lifecycle (verified under AUD-ADMISSIONS-02). Reception
  inquiries that link into it were tested as **integration only**; the frozen
  admissions state machine was not redesigned.
- `src/libs/api/permissions.ts` (role capability defaults).
- Deploying to the VPS.

### Frozen dependencies not modified
`requireParentContext` / `requireRelationship`, `page-guard.ts`, `uploads.ts`
helpers, and the deliberate receptionist capability exclusions were **read and
measured against, never changed**.

## 3. Workflow Understanding

### Support ticket lifecycle
`tenant staff create a ticket → it appears in that tenant's history → the
platform super-admin desk sees it against the right tenant → status / assignment /
updates → attachment evidence → resolution → closure → history preserved`

`platform_support_tickets` is a genuinely multi-institution table (tenant-scoped,
indexed on status/priority/category). Attachments are uploaded first
(`/api/support/upload`) and referenced from the ticket.

### Reception / front-desk workflow
`inquiry or contact → front-desk handling → appointment or handoff where
applicable → visitor or pickup event → correct responsible staff → history and status`

- **Appointments** run a real state machine with dedicated transitions
  (check-in, complete, no-show, reschedule, cancel) and a status history table.
- **Handoffs** are staff-to-staff tasks with acknowledge / resolve / cancel.
- **Pickups** require an **explicit authorization** before release; identity is
  verified at the desk and the student/guardian linkage is checked.

**Source of truth:** `platform_support_tickets.status` for tickets;
`reception_appointment_status_history` / `reception_handoff_status_history` for
front-desk transitions; `guard_pickup_authorizations` + release events for pickup.

## 4. Findings

| ID | Severity | Surface | Problem | Evidence | Disposition |
|---|---|---|---|---|---|
| **F-01** | **Critical** | `GET /api/support/upload` | Support attachments served with **no authentication at all**, **no tenant scoping**, and `Cache-Control: public, max-age=31536000, immutable`. The global middleware matcher explicitly excludes `api`, so nothing else protected it. | Route source + `src/middleware.ts` matcher | **FIXED** |
| **F-02** | Info | `/dashboard/receptionist/pickups` | The page renders for every receptionist but its data API requires `reception.pickup.release`, which the receptionist role deliberately does not hold. | Sweep `403 /api/reception/pickups/authorizations` | **Verified correct, not a defect** |

### F-01 in detail
Any anonymous visitor who knew or guessed a `fileKey` could download **another
school's** support evidence: error screenshots, PDFs and videos describing live
problems. The `fileKey` was also only weakly random
(`${Date.now()}_${uuid.slice(0, 8)}_<originalName>.<ext>` — 32 bits of entropy
beside a guessable timestamp and filename), and the response told every shared
proxy and CDN to cache the file **publicly for a year**.

### F-02 — checked and cleared
`reception.pickup.release` is **deliberately excluded** from the receptionist
default set; the code says so:
`// (reception.pickup.release is NOT here; grant via userPermissionOverrides).`
Releasing a child requires an explicit per-user grant. The security decision is
right, and the UI is honest about it: `reception-pickups-view.tsx` maps `403` to a
`forbidden` state and renders `<PortalStateView state="forbidden" />` with an
explanation. No change made or needed.

**Other things verified before forming an opinion:**
- `src/api/guardian/.../excuses/[excuseId]/document` surfaced as "no
  `requireRequestContext`" in a naive grep. It uses `requireParentContext` +
  `requireRelationship` + tenant + student ownership, and returns
  `Cache-Control: private, no-store`. Correct.
- `api/public/website/**/{images,logo}` are intentionally unauthenticated (public
  site branding) and scoped by tenant slug. Correct.
- `/dashboard/super-admin/support` redirecting school_admin to `/fr/dashboard` is
  correct gating.

**Method note:** a grep for `requireRequestContext` alone is misleading in this
codebase — modules wrap authentication in `broadcastGuard`, `requireParentContext`,
`requireLibrarySelfContext` and similar. The regression test accepts any of these.

## 5. Fixes Implemented

### F-01 — unauthenticated, publicly-cached support attachments
- **Root cause:** the download handler never resolved a session. `src/middleware.ts`
  `config.matcher` is `'/((?!api|_next/static|...)).*)'`, so `/api/**` is excluded
  from the global middleware by design and each route must authenticate itself.
  This one did not.
- **Fix (7 edits, all in `src/app/api/support/upload/route.ts`):**
  1. `GET` now calls `requireRequestContext` + `requireTenant` with the same role
     set as `POST`.
  2. Uploads are stored under `<tenantId>/<YYYY-MM>/<file>` instead of `<YYYY-MM>/<file>`.
  3. `GET` rejects a tenant-scoped key that is not the caller's tenant.
  4. `super_admin` (the platform support desk) may read any tenant's evidence.
  5. Legacy keys with no tenant segment stay **authenticated-only** rather than
     being orphaned by the layout change.
  6. `Cache-Control: public, max-age=31536000, immutable` → `private, max-age=300,
     must-revalidate`, on both the byte-range and full responses.
  7. Path guard tightened to `startsWith(SUPPORT_UPLOADS_ROOT + path.sep)`.
- **Why this shape:** it closes the internet-facing hole and the cache leak, adds
  per-tenant scoping for everything written from now on, and does **not** break or
  orphan any existing attachment. A full redesign of attachment ownership
  (linking files to tickets in the schema) is left as a follow-up.
- **Files:** `src/app/api/support/upload/route.ts`
- **Regression risk:** low. Authenticated flows are unchanged; only anonymous
  access and cross-tenant reads are removed.

## 6. Security / Isolation / Permission Audit

- **Tenant isolation:** `npm run check:isolation` **PASS** (828 files). Reception
  queries are tenant-scoped throughout. Support tickets are tenant-scoped; the
  attachment store now is too.
- **Cross-tenant IDOR:** closed for attachments (F-01). Ticket and reception
  lookups are `WHERE id = ? AND tenant_id = ?`.
- **Attachment ownership:** enforced after F-01 (tenant folder + caller check).
- **Upload validation:** MIME allowlist (images/video/PDF only), 50 MB cap, magic
  byte checks for PNG/JPEG, filename sanitised to `[a-zA-Z0-9_<arabic>.-]` and
  truncated to 60 chars, extension forced from the MIME type (not the client name).
- **Filename/path safety:** server-generated filename with `randomUUID` prefix;
  `path.normalize` + leading-`..` strip + `startsWith(root + sep)` on download.
- **Status-transition truth:** appointments and handoffs use explicit per-action
  endpoints with status history rows; pickup release requires an authorization.
- **Duplicate submission:** support uploads are content-addressed by timestamp+uuid;
  reception writes are per-event.
- **Staff-only vs tenant-visible notes:** `platform_support_tickets` carries
  super-admin assignment/notes alongside tenant-visible history (unchanged).
- **Sensitive-data leakage:** the attachment endpoint was the leak (F-01), now
  closed and sent `private`. Guardian documents already used `private, no-store`.
- **Super-admin boundaries:** `/api/super-admin/support` asserts `super_admin`;
  the page denies other roles.
- **Audit trail:** mutating routes call `recordAudit`; reception status history
  tables preserve transitions.

## 7. Data / DB / Migration Impact

- **Tables read:** `platform_support_tickets`, `reception_appointments`,
  `reception_appointment_status_history`, `reception_handoffs`,
  `reception_handoff_status_history`, `reception_identity_verifications`,
  `guard_pickup_authorizations`, `guard_release_events`, `user`, `guardians`,
  `guardian_students`, `branches`.
- **Tables written:** none by the fix. Only the on-disk attachment layout gained a
  tenant folder segment.
- **Historical data changed:** **none.** Existing attachments remain readable
  (authenticated-only).
- **Migration added:** none. **Journal status:** untouched.

## 8. Tests

### Focused tests
```text
npx vitest run src/features/support src/features/reception  ->  6/6 PASS
  support-attachment-security.test.ts (NEW):
    - both handlers in the upload route authenticate
    - the download resolves a session and tenant-scopes the read
    - attachments are never publicly cacheable
    - uploads land under the owning tenant folder
    - the path-traversal guard is intact
    - repo-wide: no /api file-serving handler runs without resolving a caller
      (api/public/** excluded — intentional public branding, tenant-scoped)
```

### Regression proof the test bites
Its first version failed twice — on my own over-strict assertions (`expected 4 to
be 2` from a `split()` counting bug, and three "unauthenticated" file routes that
turned out to use module-local guards). Both were corrected after verifying each
route in source; the test now encodes the real invariant.

### Broad regression
A run over `src/app/api` pulled in the platform's large integration suites
(admissions, students, attendance, academics, timetable, live-classrooms,
guardians, portal security, signup/invitations) — **all passing**, so the auth
change did not disturb any neighbouring module.

### Static gates
```text
check:types      PASS   (tsc --noEmit, 0 errors)
check:isolation  PASS   (828 files scanned)
check:i18n       PASS   (missing translation keys: 0 in 0 files)
check:ui         PASS   (ratchet holding)
```

## 9. Visual / UX Evidence

### Screenshot manifest
| File | Page/state | Locale | Viewport | What it proves |
|---|---|---|---|---|
| `screenshots/receptionist-fr-*.png` (6) | all six front-desk pages | FR | Desktop 1440x900 | Each receptionist page renders real data |
| `screenshots/school_admin-fr-support.png` | tenant support desk | FR | Desktop | Ticket list and attachments render |
| `screenshots/school_admin-fr-super-admin__support.png` | platform support desk | FR | Desktop | Honest denial for a non-super_admin |

**8/8 audited routes have a final desktop FR screenshot.**

Coverage rules applied:
- every audited page: final desktop FR — **yes, 8/8**.
- changed pages: mobile 390 + Arabic RTL — **not captured**. F-01 is a server-side
  authorization and cache-header change; nothing rendered differently on any page.
  No markup, styling or translation was touched.
- before/after — **not captured as pixels**. The defect is access control, not
  appearance; it is proven by the regression suite (a `GET` without a session now
  fails) rather than by screenshots.

## 10. Files Changed

```text
lango-app/src/app/api/support/upload/route.ts                            (F-01, 7 edits)
lango-app/src/features/support/__tests__/support-attachment-security.test.ts (NEW, 6 tests)
+ this done-folder package (report, checkpoint, screenshots, evidence)
```

## 11. Unresolved / Follow-up Items

- **Attachment-to-ticket ownership model (recommended).** Attachments are uploaded
  before a ticket exists, so a file has no schema link to a tenant or ticket and
  ownership rests on the storage path. A `support_attachments` table (file_key,
  tenant_id, ticket_id, uploaded_by) would allow strict ownership checks and
  deletion with the ticket. Not done here: it is a schema change and a product
  decision.
- **`fileKey` entropy.** Now unguessable in practice because it lives under a
  tenant UUID folder that is itself access-controlled, but the trailing name is
  still derived from the client's filename. Consider dropping it entirely.
- **Nav vs page guard for `/dashboard/receptionist/pickups`.** The page is guarded
  on `reception.portal.use` while its data needs `reception.pickup.release`, so a
  default receptionist sees a page whose content is a forbidden state. That is
  honest and correct today; if you prefer the page to be hidden outright, the nav
  entry and page guard must change together (see `nav-page-guard-parity.test.ts`).
  Decision for the product owner, not an audit fix.

## 12. Frozen-Module / Cross-Module Impact

`src/features/parent/**` (`requireParentContext`, `requireRelationship`),
`src/libs/api/page-guard.ts`, `src/libs/api/uploads.ts` and the deliberate
receptionist capability exclusions in `src/libs/api/permissions.ts` were **read
only** and are unchanged. No admissions, finance, attendance or student module was
touched.

Broad regression evidence: the platform's `src/app/api` integration suites all
pass after the change.

## 13. Final Executor Verdict

```text
TASK COMPLETE: YES
READY FOR INDEPENDENT AGENT 5 VERIFICATION: YES
CODE PUSHED: YES
IMPLEMENTATION SHA: c49673947904c8ff98040b2bee7c4ee42851858e
OPEN CLAIMS: 0 / 2 released (task:AUD-SUPPORT-RECEPTION-01, task:port-3460)
```

Executor does **not** issue a final production/release verdict. That belongs to the verifier/orchestrator.
