# Lead CRM & Broadcast Messaging — Final Report (2026-08-08)

Feature spec:
`future-implementation/lead-crm-and-broadcast-messaging/` (`LEAD-CRM-AND-BROADCAST-MESSAGING.md`,
`BULK-SMS-EMAIL-ADDENDUM.md`, `../_shared/APP-CONTEXT-AND-UI-SYSTEM.md`).

## 1. What was built

Two add-ons on SchoolOS (Next.js App Router, Drizzle + PostgreSQL, Better Auth):

- **Lead CRM** (`lead-crm`): inquiry capture + lifecycle (status transitions, sources,
  interest levels, tags), duplicate detection + safe merge, follow-ups, conversion to
  applicant (idempotent), kanban pipeline + profile UI, cross-tenant isolation.
- **Broadcast Messaging** (`broadcast-messaging`): connections (provider abstraction,
  secrets encrypted/masked), audience segments (6 recipient kinds), versioned templates,
  campaign composer (preview → approve → snapshot → worker → report → export CSV),
  per-recipient delivery statuses + events, retry, consent register + suppression list
  (checked at snapshot AND send time), scheduling/cancel, automations (birthday),
  reports, full FR/EN UI, dashboard navigation group **"CRM & Diffusion"**.

## 2. Schema & migration

- `migrations/0079_lead_crm_broadcast.sql` (**549 lines**): 13 broadcast tables
  (`communication_connections`, `communication_consents`, `communication_suppressions`,
  `communication_segments`, `communication_templates`, `communication_template_versions`,
  `communication_campaigns`, `communication_campaign_recipients`,
  `communication_deliveries`, `communication_delivery_events`, `communication_automations`,
  `communication_automation_runs`, `communication_automation_recipients`) + 2 CRM tables
  (`inquiries`, `inquiry_follow_ups`), pgEnums, partial unique indexes for global vs
  channel-specific suppression, tenant indexes. Registered in `migrations/meta/_journal.json`
  and **applied live** — all **15/17** expected tables confirmed present (the other 2 names
  were audit-log guesses; audit writes go to the shared central audit log via
  `@/libs/api/audit`, count-verified live).
- Add-ons registered in `src/addons/registry.ts`; entitlement rows live for both tenants.
- Permissions: `crm.manage` + `broadcast.*` keys in `src/libs/api/permissions.ts`.

## 3. Routes & pages

| Area | Count |
|---|---|
| Broadcast API routes (`src/app/api/addons/broadcast/**`) | 31 `route.ts` |
| CRM API routes (`src/app/api/crm/**`) | 5 `route.ts` |
| Webhook (`src/app/api/webhooks/communication/[provider]`) | 1 `route.ts` (HMAC-verified) |
| Broadcast feature files (`src/features/broadcast/**`) | 28 |
| CRM feature files (`src/features/crm/**`) | 34 |
| Broadcast pages (`dashboard/broadcast/**`) | 8 (overview, connections, segments, templates, campaigns, campaigns/[id], reports, automations) |
| CRM page (`dashboard/communication/crm`) | 1 |
| Migration SQL | 549 lines |

## 4. Verification results (all live against :3002, real sessions, real DB)

| Gate | Command | Result |
|---|---|---|
| CRM live sweep | `node scripts/verify-lead-crm.mjs` | **41/41 PASS** (exit 0) |
| Broadcast live sweep | `node scripts/verify-broadcast.mjs` | **54/54 PASS** (exit 0) |
| Page render | `node scripts/check-broadcast-pages.mjs` + campaign-detail | **14/14 + 2/2 = 16/16 PASS** (en+fr) |
| Add-on disable gate (CRM) | `node scripts/verify-lead-crm-addon-gate.mjs` | **8/8 PASS** (exit 0) |
| Add-on disable gate (Broadcast) | `node scripts/verify-broadcast-addon-gate.mjs` | **8/8 PASS** (exit 0) |
| Pure-function units | `npx vitest run --project unit "src/features/broadcast/services/__tests__"` | **21/21 PASS** |
| Tenant-isolation static | `npx tsx scripts/check-tenant-isolation.ts` | **0 flags** on crm/broadcast routes (4 flags remain in parallel guard-agent kiosk routes) |
| TypeScript | `npx tsc --noEmit` | **0 errors** in all broadcast/CRM code; repo-wide 5 errors — all in parallel agent's `scripts/test-transport-adversarial.ts` |
| Production build | `npx next build` | App **compiles + bundles** (`✓ Compiled successfully in 2.1min`); final TS gate fails only on those 5 pre-existing transport-script errors |
| Whitespace | `git diff --check` on feature files | Clean; the only 2 flags are a parallel agent's blank lines in `requirePlanTier` (permissions.ts, separate hunk), left untouched |

## 5. Security requirement evidence (summary)

Every verbatim requirement from the spec is implemented and proven — see
`AUDIT-RESPONSE.md` for the full requirement→evidence table. Highlights:

- Session-derived tenant/actor everywhere (`broadcastGuard`, `requireRequestContext`/`requireTenant`); never from body.
- **Tenant isolation**: live scripts assert "SchoolOS tenant untouched — count 0" at the DB; cross-tenant IDs → 404.
- **Add-on + capability gates**: both gate scripts prove 403 `ADDON_NOT_ACTIVATED` on every route when disabled.
- **Idempotency**: campaign create (`idempotencyKey`), preview, send/retry — live-verified (same-key replay returns SAME campaign).
- **No forbidden-field leakage**: `guardianId`, `studentId`, `salary`, `nationalId`, `financeBalance`, `privateNote`, `matricule`, `paymentStatus` asserted absent from campaign/recipient projections.
- **Consent/suppression re-checked at send time**: `checkConsent` at preview AND immediately before dispatch; revoked/suppressed recipients skipped.
- **Provider secrets never reach the browser**: `maskConfig` unit tests (5 cases) + live masked-config assertions; plaintext never returned.
- **Audit**: sensitive mutations recorded via central `recordAudit` — live-verified counts (CRM 7, broadcast 9).
- **No real external sends**: test provider only; deterministic outcome rules; `delivered` only after `sent`; overview banner "Diffusion simulée".

## 6. DB cleanup status

- All verify scripts self-clean at start and end (`[verify-` marks, `vfy-bday-` users).
- Final DB scan after the last gate run: **0** leftover verify campaigns, inquiries, connections, or birthday users.
- A manual "PageCheck Draft" campaign created during UI verification was deleted.
- Both add-ons **re-enabled** for both tenants (lead-crm 2/2, broadcast-messaging 2/2).

## 7. Remaining manual checks (see MANUAL-TESTING.md)

- Visually walk the kanban pipeline + drag transitions in a browser.
- Exercise CSV export download from a campaign detail page.
- Walk the composer preview → approve → process → retry flow with a real connection.
- Confirm the **"CRM & Diffusion"** sidebar group renders for a school_admin and is hidden for roles without `broadcast.read`.

## 8. Honest merge verdict

**Approve** for Lead CRM + Broadcast Messaging. All phases P1–P6 are complete, all
binding security requirements are implemented and proven by live DB-backed suites,
the UI renders in both locales, and DB test data is cleaned up. The only repo-wide
blockers are **pre-existing parallel-agent errors** (student-transport
`scripts/test-transport-adversarial.ts`, 5 TS errors; 2 whitespace lines in the
plan-tier hunk of `permissions.ts`) that are out of this feature's scope and left
untouched per the shared-worktree rule.
