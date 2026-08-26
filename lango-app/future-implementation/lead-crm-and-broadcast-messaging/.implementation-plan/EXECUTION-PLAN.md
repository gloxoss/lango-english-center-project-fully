# Lead CRM & Broadcast Messaging — EXECUTION-PLAN

> Companion to `PLAN.md` (strategy) and the two authoritative specs
> (`LEAD-CRM-AND-BROADCAST-MESSAGING.md`, `BULK-SMS-EMAIL-ADDENDUM.md`).
> This file is the atomic, gate-per-phase working plan. Verified live on the
> :3002 dev server; DB = Postgres via Docker; tenants Atlas
> (`ca40c88e-339c-4fea-b5c4-51d5c9cc0239`) and SchoolOS (`f62f31eb-...`).

## 0. Discovery outcome (what already exists)

- `inquiries` + `inquiryFollowUps` tables, enums `inquiry_source`
  (`walk_in/phone/web/referral`), `inquiry_interest_level`, `inquiry_status`
  (`new/contacted/qualified/converted/lost`), `inquiry_follow_up_type` — in
  `src/models/Schema.ts:2538-2596`. **Authoritative — no competing lead tables.**
- Real routes: `/api/admissions/inquiries` (GET/POST/PUT),
  `/api/admissions/inquiries/convert` (idempotent), `/api/crm/inquiries`
  (GET/POST paginated), `/api/crm/inquiries/[id]` (PATCH),
  `/api/public/inquiries/[tenantSlug]` (public, rate-limited + honeypot).
- `inquiryFollowUps` has **no API route** — follow-ups/activity unbuilt.
- No tags column, no `facebook_ads`/`google_ads` sources, no pipeline indexes.
- **Broadcast = 0% built.** No campaign/segment/delivery/consent/suppression/
  connection tables or routes. `smsMessages`/`smsTemplates`/`announcements`/
  `notifications` exist (SMS is explicitly simulation-only). Existing
  `src/features/crm/ui/*` campaign/segment/report/automation views are static
  mock configs; `inquiries-kanban-view` is the only real-API CRM view.
- Addons `lead-crm` + `broadcast-messaging` already registered
  (`enabled:false`); no entitlement rows yet. Permissions: `crm.manage`,
  `communication.read/send` exist; no `broadcast.*` keys.
- No encryption helper exists anywhere (first secret store = net-new).
- No queue infra; a worker must be request/outbox-driven.

## 1. Scope decision (in / deferred)

**In scope (fully implemented + live verified):**
- Lead CRM: pipeline kanban, lead list/detail/profile, tags, sources
  (extended), assignment, search/filter/pagination, follow-ups/notes/log-call,
  activity feed, duplicate detection + safe merge, conversion (reused),
  delete. Real UI (FR), sidebar nav.
- Broadcast: encrypted connections, live segments, versioned templates,
  campaign composer, recipient preview/snapshot, consent + suppression,
  lifecycle states (draft/pending_approval/scheduled/queued/sending/completed/
  failed/cancelled), outbox worker, per-recipient deliveries + immutable
  events, deterministic test/log provider, retry, reports + masked export,
  webhook route with signature/replay protection, audit, birthday automations.
- Addon gating for both addons; permissions; UI (FR); docs + verification.

**Deferred (explicitly, with reasoning):**
- Real WhatsApp/Telegram/Messenger/SMTP/SMS-gateway provider integrations.
  The provider abstraction + log/test provider are real; live carriers need
  paid credentials, template-approval flows and policy review. Sending is
  simulated/log-only per the app's established honesty convention (same as
  existing `smsMessages`). No external bytes are sent during verification.
- Meta (Facebook/Instagram) & Google Ads signed webhook ingestion. Requires
  per-tenant Meta/Google credentials + signature verification + webhook
  subscription; an external integration project. The public endpoint remains
  the intake; `facebook_ads`/`google_ads` sources are wired so attribution is
  correct when a signed adapter is added.
- Provider credentials live in browser bundles / actual cross-channel
  deliveries — refused by design.
- Replacing every pre-existing static mock view under `communication/*`
  (segments/campaign-composer/delivery-reports/templates-automation/milestones/
  forms/leads). Those pages are not in the sidebar and are superseded by the
  new real `/dashboard/broadcast/*` surfaces. Left untouched to respect the
  "do not overwrite unrelated files" rule.

## 2. Architecture

- **Two addons**, independently gated: `lead-crm`, `broadcast-messaging`.
  Routes under `/api/crm/*` (pipeline) and `/api/addons/broadcast/*`.
- Feature schemas: `src/features/broadcast/models/broadcast-schema.ts`
  (12 tables). `inquiries` stays authoritative in core `Schema.ts` (edit in
  place: add `tags`, extend `inquiry_source`).
- **Secrets**: new `src/libs/api/secrets.ts` — AES-256-GCM authenticated
  encryption keyed from `ENCRYPTION_KEY` env (fallback `BETTER_AUTH_SECRET`),
  version-tagged. Secrets never returned to browser.
- **Segments**: saved JSON filter definitions computed live at snapshot.
- **Campaigns**: recipient snapshot + template version frozen at approval;
  transactional outbox claim (`FOR UPDATE SKIP LOCKED` leases), idempotency
  keys (`tenant,idempotency_key` unique), bounded batch `process` worker.
- **Providers**: `BroadcastProvider` interface + `test`/log providers.
  Deterministic `simulate` mode drives per-recipient verification
  (sent/delivered/bounced/failed-retryable) without external calls.
- **Consent/suppression** checked at snapshot AND immediately before dispatch.
- **Audit**: `recordAudit` on all sensitive mutations; activity feed reuses
  `audit_logs` for stage changes.

## 3. Shared-file collision list (edit carefully)

| File | Change | Risk |
|---|---|---|
| `src/models/Schema.ts` | +`tags text[]` on inquiries; extend `inquiry_source`; +1 barrel line for broadcast-schema | high |
| `src/libs/api/permissions.ts` | +`broadcast.*` keys; receptionist += broadcast.read | high |
| `src/addons/registry.ts` | `lead-crm`/`broadcast-messaging` `enabled:true` | medium |
| `src/components/shared/sidebar.tsx` | +"CRM & Diffusion" nav group | medium |
| `migrations/meta/_journal.json` | append idx 80 (`0079_lead_crm_broadcast`) | high |
| `migrations/0079_lead_crm_broadcast.sql` | new file (all tables + alters) | high |
| `src/app/api/admissions/inquiries/convert/route.ts` | delegate to shared `inquiries-service.convertInquiryToApplicant` (behavior-preserving) | medium |

Non-shared new code (mine): all `src/features/broadcast/**`,
`src/features/crm/services/**`, `src/features/crm/ui/*` (rewrites/new),
`src/libs/api/secrets.ts`, `/api/addons/broadcast/**`, extra `/api/crm/**`,
`/api/webhooks/communication/**`, `/dashboard/broadcast/**`, scripts, docs.
No `package.json` dependency changes (AES via `node:crypto`).

## 4. Phases and gates

- **P1 — Schema, migration, registry, permissions.** Gate: migration runs
  idempotently against live DB; `npx tsc --noEmit` exit 0; `next build` exit 0.
- **P2 — Lead CRM backend** (service + routes). Gate: live two-tenant verify
  script (create/update/assign/transitions/tags/duplicates/merge/follow-ups/
  convert idempotency/cross-tenant rejection) green; tsc 0.
- **P3 — Lead CRM UI** (pipeline kanban + profile). Gate: pages render 200
  en+fr; tsc 0; build 0.
- **P4 — Broadcast backend** (schema+services+providers+worker+webhooks).
  Gate: live broadcast verify script green (segments/preview/enqueue/consent/
  suppression/per-recipient statuses/retry/provider failure/export isolation/
  idempotency); tsc 0.
- **P5 — Broadcast UI** (segments/templates/composer/reports/automations/
  connections). Gate: pages render 200 en+fr; tsc 0; build 0.
- **P6 — Gates + docs.** `tsc`, `next build`, isolation static check,
  addon-disable gate scripts, DB cleanup, `MANUAL-TESTING.md`,
  `AUDIT-RESPONSE.md`, final report.

## 5. Verification suite

- `scripts/verify-lead-crm.mjs` — CRM two-tenant sweep.
- `scripts/verify-broadcast.mjs` — broadcast two-tenant sweep.
- `scripts/verify-lead-crm-addon-gate.mjs` + `scripts/verify-broadcast-addon-gate.mjs`.
- `npx tsc --noEmit`; `next build`; `npx tsx scripts/check-tenant-isolation.ts`
  (no NEW flags on my files); vitest for pure functions (duplicate scoring,
  segment matching, consent/suppression, GSM segment count, template render).
- Provider-secret absence: assert no `apiKey`/`token`/`secret` in any broadcast
  API response; grep-built bundle for known secret env names.

## 6. Phase status

- **P1 ✅** (migration 0079 idempotent live; schema verified; addons enabled;
  entitlements granted; tsc 0; build 0).
- **P2 ✅** Lead CRM backend live-verified **41/41 PASS** (exit 0) twice.
- **P3 ✅** Lead CRM UI: `inquiries-kanban-view` rewritten to the real API
  pipeline; renders **200 en+fr** on :3002; **tsc 0** for CRM code.
  **Repo-wide `next build` is CURRENTLY BLOCKED by the parallel
  student-transport agent's in-progress refactor** (28+ TS errors across
  `src/app/api/transport/**`, `src/features/transport/**` — renamed
  `users`/`students`/`studentGuardians` imports whose Schema exports do not
  exist yet, plus "possibly undefined" + signature errors). None of the
  errors touch lead-crm/broadcast code. I am NOT touching the transport
  module (shared-worktree rule). The `next build` gate is re-checked at P6
  once the tree is green.
- **P4 ✅** Broadcast backend live-verified **54/54 PASS** (exit 0) on :3002.
  Fixes shipped during verification: `approveCampaign` now persists
  `enqueuedCount`; `listCampaignRecipients` 404s on cross-tenant campaigns;
  webhook counter-refresh casts `'completed'/'failed'` to
  `communication_campaign_status` (Postgres enum-CASE coercion); automation
  `monthDay()` now slices `YYYY-MM-DD` correctly (was producing `'20-6-'` →
  0 birthday matches); verifier sched/cancel now uses a dedicated segment so
  F1/F2 retries can't keep the promoted campaign in `sending`; schedule check
  tolerates the app-wide naive-timestamp round-trip (UTC+1 server TZ).
  **tsc 0 for broadcast code**; repo-wide tsc still reports pre-existing
  parallel-agent errors in `scripts/test-transport-live-acceptance.ts` and
  `src/app/api/portal/portal-security.test.ts` (left untouched).
- **P5 ✅** Broadcast UI complete: `broadcast-ui.ts` shared helper (api client,
  label maps), 8 view components (`overview`, `connections`, `segments`,
  `templates`, `campaigns`, `campaign-detail`, `reports`, `automations`), 7
  pages + `campaigns/[id]` + `reports`; "CRM & Diffusion" nav group added to
  the sidebar (`broadcast.read`). Live page render **16/16 PASS** (en+fr ×
  overview/connections/segments/templates/campaigns/reports/automations +
  campaign detail) on :3002. **tsc 0 for broadcast + sidebar code** (fixed 6
  `noUncheckedIndexedAccess` errors in `connections-view`/`templates-view`/
  `automations-view`). Repo-wide tsc still reports the same pre-existing
  parallel-agent errors (left untouched).
- **P6 ✅** Gates + docs. Live re-verify: **CRM 41/41**, **broadcast 54/54**
  (exit 0 both). Add-on gate scripts **8/8 + 8/8** (`verify-lead-crm-addon-gate.mjs`,
  `verify-broadcast-addon-gate.mjs`). Page render **16/16** (`check-broadcast-pages.mjs`
  14 + campaign-detail 2). Unit suite **21/21** (`npx vitest run --project unit
  src/features/broadcast/services/__tests__`): GSM segment billing, template
  render/sanitize, segment-definition validation, provider-secret masking.
  `check-tenant-isolation.ts`: **zero flags** on crm/broadcast routes (4 remain in
  the parallel guard agent's kiosk routes). `npx tsc --noEmit`: **0 broadcast/crm
  errors**; the only 5 repo-wide errors are in `scripts/test-transport-adversarial.ts`
  (parallel student-transport agent). `next build`: app **compiles + bundles
  successfully**; final TS gate fails only on those 5 pre-existing transport-script
  errors (left untouched). Provider-secret absence proven by unit mask tests +
  live masked-config checks + forbidden-field projection. DB test data cleaned up;
  both add-ons re-enabled for both tenants; migration 0079 registered in the journal
  with all 15 broadcast/CRM tables live. Docs: `MANUAL-TESTING.md`, `AUDIT-RESPONSE.md`.
