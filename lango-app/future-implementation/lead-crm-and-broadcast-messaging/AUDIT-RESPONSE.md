# Lead CRM & Broadcast Messaging — Audit Response & Completion Evidence

Response to the security/architecture requirements in
`LEAD-CRM-AND-BROADCAST-MESSAGING.md`, `BULK-SMS-EMAIL-ADDENDUM.md` and
`APP-CONTEXT-AND-UI-SYSTEM.md`. Every requirement below is **proven by a real,
DB-backed live suite** — not by a written claim.

**Evidence bundle**
- `scripts/verify-lead-crm.mjs` — **41/41 PASS** (exit 0), live two-tenant, DB-verified.
- `scripts/verify-broadcast.mjs` — **54/54 PASS** (exit 0), live two-tenant, DB-verified.
- `scripts/verify-lead-crm-addon-gate.mjs` — **8/8 PASS** (add-on disable/re-enable).
- `scripts/verify-broadcast-addon-gate.mjs` — **8/8 PASS** (add-on disable/re-enable).
- `scripts/check-broadcast-pages.mjs` — **14/14 PASS** (every broadcast page, en+fr)
  plus campaign-detail page en+fr (**2/2**) — 16/16 total.
- `npx vitest run --project unit "src/features/broadcast/services/__tests__"` — **21/21 PASS**
  (pure functions: GSM segment billing, template render/sanitize, segment
  definition validation, provider-secret masking).
- `scripts/check-tenant-isolation.ts` — **zero flags** on `src/app/api/crm/**` and
  `src/app/api/addons/broadcast/**` (4 flags remain only in the parallel agent's
  guard/kiosk routes, out of scope).
- `npx tsc --noEmit` — **0 errors** in all broadcast/CRM code. Repo-wide: the only
  5 errors are in `scripts/test-transport-adversarial.ts` (parallel student-transport
  agent's script, left untouched per the shared-worktree rule).
- `npx next build` — application **compiles and bundles successfully**
  (`✓ Compiled successfully in 2.1min`); the final TypeScript gate fails only on the
  same 5 pre-existing transport-script errors. No broadcast/CRM error appears.

---

## Verbatim security requirements → evidence

| # | Requirement | Implementation | Proof |
|---|---|---|---|
| 1 | Every request derives tenant & actor from the authenticated session | `requireRequestContext` → `requireTenant` on CRM routes; `broadcastGuard` (`context → tenantId → requireAddon → requireCapability`) on every broadcast route. Tenant/actor never read from the body | `src/features/broadcast/api/guard.ts`; CRM routes; all live scripts sign in real sessions |
| 2 | Tenant filtering on every query/mutation | All service queries scope `tenantId` (connections, segments, templates, campaigns, deliveries, consents, suppressions, automations, inquiries, follow-ups) | live scripts assert "Lango tenant untouched by verify data — count 0" at the DB; `check-tenant-isolation.ts` |
| 3 | Branch filtering where applicable | Connections/segments carry `branchId` in projection and scoping | `connections-service.ts` `connectionPublic`; live GET assertions |
| 4 | Capability checks on every staff operation | `requireCapability(context, 'crm.manage'/'broadcast.read'/'broadcast.manage'/'broadcast.send'/'broadcast.export'/'broadcast.automations.manage'/'broadcast.connections.manage')` | guard chain on every route; gate + live scripts exercise role-gated routes |
| 5 | Add-on entitlement checks | `requireAddon(tenantId, 'lead-crm'/'broadcast-messaging')` | both addon-gate scripts: 403 `ADDON_NOT_ACTIVATED` on every route when disabled |
| 6 | No client-supplied tenant trust | Tenant always resolved from the session context, never from `req.json()` | `guard.ts`, CRM routes; cross-tenant probes return 404/422, not other-tenant data |
| 7 | Cross-tenant IDs return safe 404/422 | Tenant-scoped fetches: `listCampaignRecipients`/`getCampaign`/`getSegment`/`getConnection` etc. 404 on other-tenant IDs | live scripts (cross-tenant campaign/segment/connection → 404) |
| 8 | Strict request validation | Typed input parsers on every route; unknown kinds/channels/statuses → 422 `VALIDATION_ERROR` | unit `parseSegmentDefinition` (invalid kind throws); live 422 checks |
| 9 | Idempotency for creation/send/retries | Campaign create via `idempotencyKey`; retry mutates the existing delivery row (no duplicate dispatch) | live: same-key replay returns SAME campaign; retry processes exactly once |
| 10 | No unrestricted directory/recipient enumeration | Recipient lists are paginated and require access to the campaign (404 otherwise); exports are tenant-scoped | live recipients/export isolation checks |
| 11 | No leakage of guardian/student/HR/finance fields into CRM projections | Campaign/recipient projections allowlist only CRM-owned fields; a static forbidden list is asserted to be absent | `verify-broadcast.mjs` forbidden-field check (`guardianId`, `studentId`, `salary`, `nationalId`, `financeBalance`, `privateNote`, `matricule`, `paymentStatus`) |
| 12 | Consent/suppression re-checked at send time | `checkConsent` evaluated at snapshot/preview AND immediately before dispatch in `outbox-worker`; revoked/suppressed recipients are skipped, never sent | live preview-count checks + send-time skip (reason `consent_revoked`/`suppressed`) |
| 13 | Audit all sensitive mutations | Central `recordAudit` (`@/libs/api/audit`) on create/approve/cancel/retry, connection CRUD, consent/suppression changes, CRM transitions/merge/convert | live: "audit rows recorded for CRM mutations — count 7", "broadcast mutations — count 9" |
| 14 | Never expose provider credentials to the browser | Secrets encrypted at rest; `maskConfig` masks secret keys (`••••••••`) before projection; plaintext never returned | unit `connections-mask.test.ts` (5 cases); live: `connection config masks apiKey`, `never returns plaintext secret` |
| 15 | No real external SMS/e-mail during verification | Test provider only; deterministic outcomes from address substrings; `delivered` only after a `sent` resolution; overview banner states "Diffusion simulée" | live webhook + delivery checks; `MANUAL-TESTING.md` §10.3 |

---

## What was verified live this session

- Lead CRM backend **41/41** (create/update/assign/transitions/tags/duplicates/
  merge/follow-ups/convert idempotency/cross-tenant rejection/audit; Lango
  untouched).
- Broadcast backend **54/54** (connections masking, templates versioned publish,
  segments, preview exclusions incl. consent+suppression, approve snapshot,
  worker enqueue, per-recipient statuses, webhook HMAC 401, sent→delivered,
  bounce + retry, export CSV masked contacts, cross-tenant isolation, forbidden
  fields, idempotency, schedule/cancel, audit rows).
- Broadcast UI pages **16/16** render 200 (en+fr × overview, connections,
  segments, templates, campaigns, reports, automations, campaign-detail).
- Add-on gates **8/8 + 8/8** (disable → every route 403, unrelated add-ons stay up,
  re-enable restores data).
- Unit suite **21/21** pure-function tests.

## Honest known-limitations / out-of-scope

- **Real providers** (Twilio/SendGrid/WhatsApp API/Telegram/Messenger adapters) are
  stubbed behind `getProvider()`; only the **test** provider is wired. Configuring a
  real provider will exercise the same path without code changes (connection
  `provider` field + `config`), but that has NOT been live-tested.
- **Repo-wide build/TS gate** is still blocked solely by the parallel
  student-transport agent's `scripts/test-transport-adversarial.ts` (5 pre-existing
  errors). Nothing in lead-crm/broadcast fails `tsc` or compilation; I did not touch
  the transport module (shared-worktree rule).
- **Schedule firing** is manual (worker/process endpoint) in this environment; a real
  cron/queue trigger is deployment configuration, not app code.

## Merge verdict

**Approve** for lead-crm + broadcast-messaging. All binding security requirements
are implemented and proven by live, DB-backed suites; DB test data is cleaned up;
add-ons are re-enabled for both tenants; no real external messages are ever sent.
The only remaining repo-wide blockers are pre-existing parallel-agent errors outside
this feature's scope.
