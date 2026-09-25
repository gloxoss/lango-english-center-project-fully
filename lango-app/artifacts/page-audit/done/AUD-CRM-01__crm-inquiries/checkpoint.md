# AUD-CRM-01 — CHECKPOINT (resume point)

- task: AUD-CRM-01 — CRM & Diffusion (inquiries / leads pipeline)
- agent: codex-2 (Executor C)
- base: f42c2bc41cb2386afed52244c5355c31c8a91f96
- worktree: `C:/Users/OMEN/AppData/Local/Temp/schoolos/agentc-AUD-CRM-01`
- branch: `audit/agent-c/AUD-CRM-01-crm-inquiries`
- hub claims held: `task:AUD-CRM-01`, `task:port-3464`
- collision check before claim: CLEAN
- dev: port 3464, NEXT_DIST_DIR=.next-agentc, DATABASE_URL -> schoolos_audit
- node_modules: `npm install --ignore-scripts` DONE
- **EDIT IN THE WORKTREE.** Bash heredocs eat backslashes (`/\s+/` became `/s+/`
  and broke name splitting until the tests caught it) — build regexes with
  `String.fromCharCode(92)` or use the Write tool.

## WHY THIS WAS CLAIMED (the brief asked for a gate-or-claim decision)
CRM is **substantial, not a navigation shell**: `src/features/crm` is 2,997 lines
with a real lead pipeline (`inquiries-service.ts` 428 lines, `inquiries-kanban-view.tsx`
872 lines), 5 `api/crm` routes, and 2 existing test suites. Data model:
`inquiries` (contactName, phone, email, assignedToId, notes, tags[], source,
status, interestLevel, convertedApplicantId) + `inquiry_follow_ups`
(notes, scheduledFor, completedAt).

## SCOPE
OWNED:
  src/features/crm/**            (inquiries pipeline + the two Diffusion UIs)
  src/app/api/crm/**             (inquiries root, [id], [id]/duplicates,
                                  [id]/follow-ups, merge)
  /dashboard/communication/crm
Also rendered from this feature folder (captured, delivery internals NOT touched):
  /dashboard/communication/campaign-composer
  /dashboard/communication/delivery-reports
EXCLUDED per brief:
  - frozen Communication/SMS delivery internals (outbox-worker, sms-delivery,
    consent-service, segments-service, deliveries-service) — audited in
    AUD-COMMS-01; only the integration is checked here.
  - verified Admissions lifecycle (AUD-ADMISSIONS-02). `convertInquiryToApplicant`
    is the hand-off INTO it; the admissions state machine is not redesigned.
  - Reception workflows.
NOTE: there is no `contacts`, `leads`, `segments` or `campaign_audiences` table.
Segments/audiences live in broadcast-schema (`communication_segments`) and
`event_audience_rules` (calendar). "Consent boundaries" = `communication_consents`
/ `communication_suppressions`, frozen Communication domain.

## FINDINGS + FIX
F-01 HIGH **FIXED** `convertInquiryToApplicant` was not concurrency-safe.
  The insert and the update ran OUTSIDE a transaction with no row lock, and the
  guard required `status === 'converted' && convertedApplicantId`. A double-click
  or a retried request passed the read twice and created **two applicants from one
  lead**; a half-written row (status set, link null) also slipped past the guard.
  FIX: wrap in `db.transaction` with `.for('update')` on the inquiry row (the same
  pattern as `issueCopy` and `cancelEvent`), and treat EITHER signal as converted.
  TEST: `src/features/crm/__tests__/conversion-integrity.test.ts` (5 cases).

F-02 MED **CLASSIFIED — not fixed** Conversion fabricates contact data:
  `phone: inquiry.phone || '0600000000'` and
  `email: inquiry.email || 'prospect-<id>@schoolos.local'`.
  `applicants.email` / `applicants.phone` are **NOT NULL**, so a placeholder is
  unavoidable without a schema change — but `0600000000` is a syntactically valid
  Moroccan mobile that could one day be a real person's number, and SMS could be
  sent to it. PROJECT_CONTEXT forbids "magic fallback values that pretend
  configuration/data exists".
  Recommendation: make those columns nullable and add a contact-incomplete flag,
  or use an RFC-reserved marker that cannot be dialled. Not done here because it
  is a schema + product decision.

## VERIFIED STRONG
- `deleteInquiry`: tenant-scoped, and **refuses** to delete a converted lead
  (`CONVERTED_CANNOT_DELETE`) so the applicant link survives.
- `mergeInquiries`: one transaction, verifies every secondary exists, refuses
  converted rows (`CONVERTED_CANNOT_MERGE`), re-points follow-ups to the primary,
  unions tags, concatenates notes with a separator, then deletes secondaries.
  `recordAudit` after commit.
- `findDuplicateCandidates`: tenant-scoped, honours `excludeId`, capped at 10.
  (Exact string match only — a differently-formatted phone will not match; minor.)

## NEXT EXACT ACTION
1. Read /tmp/agentc-crm-gates.log (types/isolation/i18n/i18n:keys/ui/eslint).
2. Finish the sweep on 3464: 3 school_admin routes + teacher boundary.
3. Mobile 390 + AR RTL on /dashboard/communication/crm (the 872-line kanban).
4. report.md from shared/REPORT_TEMPLATE.md: route matrix + the lead lifecycle
   (create -> duplicate detect -> merge -> follow-ups -> convert -> history) and
   the consent-boundary note (frozen Communication domain, integration only).
5. commit -> push -> `hub done task:AUD-CRM-01` -> release both -> stop.

## REMINDER
AUD-PLATFORM-01 is still BLOCKED on missing Super Admin TOTP. Branch
`audit/agent-c/AUD-PLATFORM-01-platform-entitlements` is pushed with its
checkpoint. Do not reset it.
