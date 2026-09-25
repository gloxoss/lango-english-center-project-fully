# AUD-COMMS-01 — CHECKPOINT (resume point)

- task: AUD-COMMS-01 — Communication + Documents + Requests
- agent: codex-2 (Executor C)
- target branch: origin/student-directory-hardening
- target HEAD/base: f42c2bc41cb2386afed52244c5355c31c8a91f96 (fetched, unchanged)
- worktree: `C:/Users/OMEN/AppData/Local/Temp/schoolos/agentc-AUD-COMMS-01`
- branch: `audit/agent-c/AUD-COMMS-01-communication-documents` (from f42c2bc)
- hub claim held: `task:AUD-COMMS-01`
- claim files: features/{broadcast,communication,certificates,cards,crm},
  api/{communication,addons/broadcast,certificates,cards,crm,notifications}, this folder
- dev server: port 3456 (NOT claimed yet — claim `task:port-3456` before starting),
  `NEXT_DIST_DIR=.next-agentc`, DATABASE_URL -> `schoolos_audit`
- node_modules: real `npm install --ignore-scripts` DONE (a junction breaks Turbopack;
  better-sqlite3's node-gyp build fails, so --ignore-scripts is required)

## FROZEN TRUTH RULES (do not change; measure against these)
no provider -> queued, sentAt null | provider success -> sent, sentAt set |
delivered only on real delivery acknowledgement | failure -> failed

Canonical statement lives in TWO places and both are already correct:
- `src/features/broadcast/services/sms-delivery.ts:13-18` ("delivered only ever
  reflects provider evidence, never a fabricated status") and its `dispatch()`:
  `let status = 'queued'`, `let sentAt = null`, `delivery = 'simulated'` by
  default; becomes 'sent' only under `resolved?.isReal && result.ok`.
- `src/app/api/attendance/route.ts:373-377` NOTIFICATION TRUTH Phase 6: "never as
  a raw 'sent' row inside the transaction. No provider success means no 'sent'."

## Findings so far
F-01 **FROZEN MODULE CONTRADICTION (FIXED in scope)**
  `src/app/api/communication/announcements/route.ts` wrote `smsMessages` with
  `status: 'sent', sentAt: <now>` and NO provider call (raw insert, log-only
  comment). Also skipped consent/suppression checks and Moroccan phone
  normalization. => fabricated "sent".
  FIX: route through `sendSmsMessages()` (the authoritative dispatcher).
  Files: `src/app/api/communication/announcements/route.ts` (2 edits, DONE)

F-02 **FROZEN MODULE CONTRADICTION (out of claim — DOCUMENT, do not fix)**
  `src/app/api/settings/access-reset/route.ts:85-91` — same raw insert with
  `status: 'sent', sentAt: now`, no provider. File is under `api/settings`
  (held by codex-3 on task:AUD-SETTINGS-01).

F-03 **FROZEN MODULE CONTRADICTION (out of claim — DOCUMENT, do not fix)**
  `src/app/api/students/[id]/regenerate-access/route.ts:71-78` — same raw insert
  `status: 'sent', sentAt: now`, no provider. File is under `api/students`.

CORRECT examples (do not "fix"): `src/app/api/users/route.ts:132-138` writes
`status: 'queued'` with no sentAt — exactly right. `connections-service.ts:184`
writes sent/failed from a REAL `result.ok` — exactly right.

NOT a defect (grep was misleading): all `api/addons/broadcast/*` show 0/0/0 on a
`requireRequestContext|requireTenant|requireCapability` grep because they use the
module wrapper `broadcastGuard(request, 'capability')` in
`src/features/broadcast/api/guard.ts`, which does session -> tenant ->
requireAddon('broadcast-messaging') -> requireCapability. Verified complete.

## Guard pipeline census (ctx/tenant/capability/audit per route.ts)
- addons/broadcast (33 routes): via broadcastGuard — OK (verified)
- cards (14), certificates (18), crm (5), notifications (1): 2/2/2 or better — OK
- communication: MIXED, still to check:
    announcements          3/3/0/2   (GET is role-scoped list; POST is ['school_admin'])
    announcements/mark-read 2/2/0/0
    announcements/unread-count 2/2/0/0
    balance                2/2/0/0
    messages               3/3/0/2   <-- CHECK for missing capability
    reminder-audience      3/3/3/2
    send                   2/2/2/3
    templates              5/5/0/4   <-- CHECK for missing capability

## NEXT EXACT ACTION
1. Inspect `api/communication/messages/route.ts` and `api/communication/templates/route.ts`
   for a genuine missing capability guard (vs a deliberate self-scope). Also
   `api/notifications/route.ts` (3/3/0/0).
2. Deep-audit the delivery lifecycle surfaces named in the brief:
   retries/idempotency (`deliveries-service.retryDelivery` — verified correct:
   refuses queued/sent/delivered, so no duplicate send), duplicate sending,
   attachments, recipient targeting (`segments-service`), audit history.
3. Check documents/certificates/cards request lifecycle (issue -> jobs -> issued ->
   revoke/replace) and `certificates/requests` (document requests) for IDOR + status truth.
4. Focused tests: add a regression test that announcements NEVER writes
   status 'sent' without provider evidence (assert via sendSmsMessage contract).
5. Gates: `npm run check:types`, `check:isolation`, `check:i18n:keys`, `check:ui`.
6. Dev server on 3456 (claim the port first), then `scripts/visual-sweep.mjs`:
   - school_admin over every staff-facing route
   - parent over /dashboard/parent/communication and /dashboard/parent/requests
   Routes live under: dashboard/communication/* (8), dashboard/broadcast/* (8),
   dashboard/certificates/* (12), dashboard/cards/* (8), dashboard/documents/generator,
   dashboard/settings/notifications, dashboard/parent/{communication,requests},
   dashboard/students/alumni/requests, dashboard/super-admin/sms
   (exact list must come from portal-manifest.ts + page guards, not assumed)
7. report.md from shared/REPORT_TEMPLATE.md, then push, Hub done, release, stop.

## RECONCILIATION NOTE
`lango-app/src/features/transport`, `.../hostel` etc. are NOT mine here. Do not
touch AUD-OPS-01 files. That task is finished and must not be reopened.
