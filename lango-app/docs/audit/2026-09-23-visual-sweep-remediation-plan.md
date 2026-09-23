# Deep visual sweep remediation plan

Date: 2026-09-23. Source: [deep visual sweep](2026-09-23-deep-visual-sweep.md), with the [runtime audit](2026-09-23-visual-runtime-audit.md) for V-1. This is a work plan, not a claim that the findings have been fixed or reproduced in production.

## Current evidence and limits

- The checkout has extensive existing, uncommitted work. Do not reset it or overwrite an in-progress fix. Compare each work packet with `git diff` immediately before editing.
- Static source review still confirms S-1, S-2, S-3, S-4, S-8, S-18, S-19, S-25 and the redirect part of S-32. S-6 is reproduced by `node scripts/check-missing-i18n-keys.mjs`: **134 missing keys in 21 files**.
- V-1 has an in-progress change in `api/accountant/me/home/route.ts`: it now checks due dates, net balance, posted payments, refunds and branch. The other callers and the same-seed runtime totals still need verification. Do not close V-1 based on this source edit alone.
- `npm run check:ui` passes its existing baseline, but its **0 mock screens** result misses imported CRM fixture data. `npm run check:isolation` passes with **74 non-failing tenant-scope warnings**. Review the warnings by data sensitivity; the static pass is not proof of isolation.
- The audit reached school admin, teacher and accountant on a seeded local tenant. Parent, student, guard, receptionist, librarian, gated add-ons and super-admin content after 2FA were not visually verified. Use authorized test accounts and fixtures before closing their findings. Do not use production student data for screenshots.

## Release order

| Gate | Work packet | Why first | Required evidence |
| --- | --- | --- | --- |
| 0 | S-8, S-20 | Pickup and emergency decisions can affect student safety | Transaction/concurrency tests, mixed manual-scan-exit fixture, guard screen |
| 1 | S-1, S-18, S-2, S-4, S-25, S-21, S-27 | Remove invented records and false all-clear states | Empty, loading and error screenshots; fixture detector fails on an imported mock |
| 2 | V-1, S-3, S-19, S-28, S-35 | One receivable truth and a reconcilable ledger | Same-seed API totals, posting exceptions and replay, accountant flow |
| 3 | S-32, S-14, S-16, S-22, S-30 | Staff must reach only usable screens | Role × route checks, no public-home denial redirects, no dead links |
| 4 | S-5, S-9, S-6, S-7, S-33, S-37 | Correct academic decisions and readable locales | Term-scoped document tests; French/Arabic/phone captures |
| 5 | Remaining S-10–S-17, S-23–S-26, S-29, S-31, S-34, S-36 and P3 | Clean up trust and navigation after the risky paths | Targeted interaction checks and screenshots |

Packets can be implemented separately. A gate is complete only when its acceptance checks pass; a visual change alone does not close an accounting or access finding.

## Work packets and acceptance criteria

### Truthful screens and system states

- **S-1, invented Communication data:** Remove the five direct routes and their fixture-backed clients from the live app, preserving the designs under `future-implementation/_archived-ui`. Search other reachable CRM routes for imported fixture state, especially campaign composer and delivery reports. Extend `check:ui` to follow imported `data/*` initial state and assert a deliberately fixture-backed client fails the rule. Direct URLs must show a deliberate unavailable state or 404, never fake KPI or contacts.
- **S-18, CNDP claim:** Remove the global compliance badge until a tenant-scoped registry status is available. If restored, map the actual receipt lifecycle to “Non déposé”, “Déposé”, “Approuvé”; include last checked time and an unknown/error state. A tenant without a receipt must never see a compliance shield or “Conforme”.
- **S-2, reminders:** Build a tenant and branch scoped, paginated at-risk query from authoritative absence and *past-due* invoice facts. A bounded dashboard watchlist must never become the SMS audience. Require communication capability, suppress opted-out numbers, and display recipient count and **simulation or live send mode** at the final send action. Empty, loading and failed fetch are distinct; a failure cannot produce “tout est au vert”. Test a risk student beyond the dashboard preview limit.
- **S-4, false 100%:** Give readiness checks explicit states: `ready`, `incomplete`, `blocked` and `not_applicable` only where genuinely optional. Empty prerequisites score 0 or are excluded only with a documented rule; do not turn 0/0 into 100%. Apply the same rule to attendance reporting, dashboard collection rate and SMS success rate. Show “— / à configurer” for undefined ratios, with a setup action. Test 0/0, partial and full cases.
- **S-25, identity:** Show a session skeleton while loading and an auth error state if it fails. Remove the fabricated name, email and default admin role. No identity-derived UI should imply a role before context resolves.
- **S-21, approvals:** With no active approval authority, show a setup state and link to authority configuration. “0 pending” is valid only after the accessible inbox has loaded and an authority exists.
- **S-27, cashier sessions:** With zero closed sessions, show “Aucune session à rapprocher”, not a green zero-discrepancy check. Positive reconciliation status requires at least one eligible session.

### Student safety

- **S-8, live pickup right:** Inside the release transaction, verify the guardian-student link belongs to the same tenant and student and is active, `canPickup`, and within effective dates. Lock the live link or serialize revocation and release through a shared row/transaction rule so a concurrent custody change cannot race the check. Keep the existing authorization lock, time window, one-time consumption and audit. Test revoked, expired, other-tenant and simultaneous release/revocation cases; deny without writing a release event.
- **S-20, emergency headcount:** Define an authoritative *as-of-now* occupancy calculation per student from today's manual attendance, accepted entry scans, exits and pickup releases. Deduplicate by student and apply the latest valid movement; mark unresolvable records “unknown” instead of presenting an exact zero. Show the data timestamp and let guards refresh. The camera status must follow actual `getUserMedia` success; replace the fake matricule hint. Test manual-only, scan-only, both, exit-after-entry, late scan and absent/unknown combinations. A classroom attendance mark alone may not prove the student is still on campus, so document the confidence rule in the UI.

### Money and books

- **V-1 / S-29, one overdue definition:** Use `libs/finance/definitions.ts` and Casablanca date consistently in accountant home, receivables, portal home and student summary. Balance is `netAmount - paidAmount`; collected is posted money net of approved refunds; overdue means unpaid and due date before today, with tenant and branch scope. Compare dashboard, finance home, invoices and reminders on one seed: one 3,000 MAD overdue invoice plus one 3,000 MAD future invoice must yield **1 invoice / 3,000 MAD** everywhere. Include partial, credited, cancelled and refunded cases. Treat the current accountant-home edit as pending verification.
- **S-3, payment GL gaps:** Return a typed posting result (`posted`, `blocked_setup`, `failed`) instead of silent `null`. Record a tenant-scoped accounting adapter exception for every payment that cannot post; do not silently mark books balanced. A setup banner must show no open fiscal period and the count/value of unposted source documents. Add an idempotent, bounded backfill/reconciliation job keyed to the source payment, with a unique source-to-ledger link and safe retry. Verify invoice → payment → GL → reversal/refund totals and report status; a 0/0 ledger with unposted payments cannot say “Équilibré”.
- **S-19, late fees:** Stop new duplicate charges first. Inspect existing duplicates before a migration. Define whether a policy charges once per invoice or accrues by period; that determines the unique key (at minimum tenant, invoice, policy, plus accrual period if recurring). Insert and bill atomically with conflict handling; create a linked, auditable invoice line or fine invoice that flows to student balance, parent view, statements, collection desk and GL. Waivers must reverse the receivable. Test two concurrent runs, retry, partial waiver and collection; report inserted rows, not proposed rows.
- **S-28, receivables:** Split “Non échu” from overdue aging. Offer late-payment SMS only for a genuinely overdue balance and a contact with valid consent; recheck eligibility when sending, since the invoice can be paid after the page loads. Remove placeholder contact addresses from the interface.
- **S-35, accountant lookups:** Provide finance-scoped read-only class and semester lookups, or a narrowly projected finance lookup API. Do not grant the accountant broad `academics.manage`. Test accountant 200 on required selectors, non-tenant access 403/404, and no access to academic mutations.

### Roles and navigation

- **S-32, visible but denied links:** Put route access requirements in one manifest shared by page guard and sidebar: capability, role exception and add-on. Compare permissions semantically, not alphabetically; `*.read` does not imply `*.manage`. A denied authenticated page renders an in-app “Accès refusé” with a route back to the user's portal, not `/${locale}`. Remove the two archived class links. Walk all sidebar destinations for teacher, accountant and school admin, with tenant/add-on variants; assert no 404 or marketing redirect. Keep the API capability check authoritative.
- **S-14, add-on links:** Hide disabled add-ons from day-to-day staff navigation. School admin may see an explicit “Available add-ons” entry; a locked feature should never look ready to use.
- **S-16, academics index:** Route directors to an academics overview; route teachers to their teaching schedule based on their role, with page guard parity.
- **S-22, leadership HR dependency:** Check entitlement and capability before requesting departments. When HR is off, omit that control or show an unavailable explanation, without a hidden 403.
- **S-30, payment history:** Either build a tenant-scoped, searchable payment history with receipts, refunds and reversals, or relabel the dashboard link as “Ouvrir la caisse” until that screen exists. Do not promise history through a redirect.

### Academic decisions, localization and documents

- **S-5, report card:** Require an exam term/semester selection and pass `examTermId` end to end. No graded subjects means average “—” and disabled download/print on both UI and document API; never issue a zero-average card from missing marks. Test draft/locked/published access and the /20 grading and coefficient rules.
- **S-9, promotion:** Distinguish roster size from assessed count; show undefined success rate as “—”. Default target to the next available year and disallow same-year source/target. Block confirmation while any decision is pending; validate again in the transaction. Test the four-unassessed-student fixture, capacity and replay/revert paths.
- **S-6 / S-33, missing keys and placeholders:** Add all **134** missing keys across `fr`, `en`, `ar`, with real translations; make the checker a CI gate. Fix `{capacity}`, `{type}` and `{count}` calls by passing named parameters. Verify rendered pages, since a passing key scan does not prove interpolation.
- **S-7 / S-37, hardcoded French and RTL:** Migrate visible strings by traffic and risk: safety, money, dashboard, students, then settings/CRM/events. Keep locale keys near feature ownership and review Arabic in context. Wrap the Latin brand and mixed numeric identifiers in `<bdi>`; verify RTL order and 390 px layouts. Keep the existing translated invoice and student patterns.

### Smaller UX and data-quality findings

- **S-10:** Remove developer copy, duplicate plus sign and 0% for 0/0 on homework; keep an honest empty state.
- **S-11:** Give direct marksheet access a title, exam link and actionable grade-entry empty state.
- **S-12:** Keep one primary timetable generate action; use configurable slot duration instead of fixed two-hour assumptions, with conflict checks.
- **S-13:** Choose one exam-planning entry and redirect or consolidate the duplicate views without losing capabilities.
- **S-15:** Explain IGP weights and missing-pillar reweighting beside the number; rename invoiced “Objectif”; remove duplicate director KPI destinations.
- **S-17:** Remove “réelle(s)” developer copy; resolve Filière/Cycle from the configured class structure or show a clear missing-configuration state.
- **S-23:** Translate audit event names, show safe human labels rather than raw UUIDs, and stop view-as-export and replay-as-create audit events. Preserve the underlying immutable event trail.
- **S-24:** Choose one *new* matricule format per tenant, validate it at generation/import, and retain historical IDs as aliases. Do not silently rewrite issued identifiers.
- **S-26:** Reflect multi-site entitlement, explain 2/1 quota overage and translate audit actions. Remove internal spec codes from headings.
- **S-29:** Close only with the V-1 same-seed reconciliation; it is the screen evidence for that issue.
- **S-31:** Remove developer claims from finance screens and give distinct report pages distinct titles.
- **S-34:** Detect missing photo files and count only retrievable images; give the upload hint an actual matricule example and remove internal spec text. Check guardian consent before publishing student photos.
- **S-36:** Use the existing student-list mobile card pattern for invoices at 390 px; status, total, due date and export remain accessible without horizontal clipping.
- **P3:** Document an authorized maker-checker route for one-admin schools without letting the same actor silently approve their own run. Explain the report-card band letters T/B/A/P/I where shown.

## Cross-cutting engineering rules

1. Every new institutional query, including lookup, count, export and background replay, must use server-derived `tenantId`; add branch scope when the user is branch restricted. Review the 74 isolation warnings, starting with guard, finance, attendance and student data. Keep `requireRequestContext → requireTenant → requireCapability → strict validation → scoped query → audit → apiErrorResponse` on writes.
2. Put indexes on the actual tenant-filtered access paths for the at-risk list, posting reconciliation, fine uniqueness and role lookups. Use server pagination for potentially full-tenant lists; the dashboard preview remains bounded and never feeds batch actions.
3. Model `loading`, `empty`, `blocked_setup`, `error` and `ready` explicitly. Empty is a successful query with zero eligible records; errors and missing prerequisites cannot reuse a green empty state.
4. For risky actions, recheck rights and eligibility in the same transaction as the write. Make retried commands idempotent and return the committed result. Record audit facts once, with sensitive student and guardian details redacted.
5. Keep existing working student, invoice, collection desk and dashboard layouts. Use their components and patterns for new states. Test French, Arabic, desktop and 390 px only where the packet changes the flow.

## Closure gate

Run `npm run check:types`, `npm run check:isolation`, `npm run check:ui`, `node scripts/check-missing-i18n-keys.mjs` and targeted Vitest tests after each packet. Before release, run the visual sweep for the changed school-admin, teacher and accountant routes and the safety/finance mobile and Arabic views. Log the resulting counts, failing routes and screenshots next to this plan. The isolation check's 74 warnings need review and disposition; do not treat the non-failing exit code as a clean security review.

Use role fixtures to cover teacher/accountant denials and authorized workflows; create test credentials for the parent, student, guard, receptionist and librarian flows. Add-on routes must be tested with an enabled test tenant as well as a disabled one. Super-admin visual review requires a test 2FA enrollment. A school-admin 2FA requirement is a separate policy decision to evaluate after these access and data-truth gates.

## Implementation log, 2026-09-23

The following packets have working code and targeted evidence in this checkout:

- **Closed with targeted checks:** S-1 fixture-backed Communication routes archived and UI reality ratchet updated; S-2 paginated risk audience with consent and live-send recheck; S-4/S-18/S-25 truthful zero, compliance and identity states; S-8 live pickup-right transaction check; S-20 as-of-now headcount endpoint and scanner states; S-5 term-scoped report cards with no-grade refusal; S-9 promotion target and pending-decision guards; S-21 approval setup state; S-27 cashier empty state; S-28/V-1 receivable aging and overdue reminder guards; S-35 finance-scoped lookups; S-6 referenced-key checks and translations; the academics landing redirect and dashboard collection link were also corrected.

- **Partially closed:** S-3 payment posting exceptions and incomplete-ledger banner are present, but idempotent backfill, source linkage and full payment/reversal coverage remain; S-19 fine runs now use Casablanca dates, positive balances, branch scope, an advisory transaction lock and a concurrent idempotency test, but fine billing/waiver/GL integration remains; S-32 denied-page redirect and archived links are fixed, but the full role × route manifest audit remains.

- **Still open:** S-7/S-10–S-17, S-22–S-24, S-26, S-29–S-31, S-33–S-37, P3, the 73 isolation warnings, same-seed runtime reconciliation, and authorized visual checks for parent, student, guard, receptionist, librarian, add-ons and super-admin. These are not release-closed based on static checks alone.

Evidence currently passing: `npm run check:ui`, `npm run check:isolation`, `npm run check:i18n`, `npm run check:i18n:keys`, targeted reminder, fine-run, payment-posting, receivables, promotion, report-card, headcount and pickup tests. `npm run check:types` is being rerun after a Node/TypeScript `File` test helper fix; no production build or VPS build was run.

## Second audit coverage, S-38 to S-57

The page-by-page audit in `docs/audit/page-audit/` covers the additional 20 findings and already contains the parent, student, guard, reception, library, add-on and super-admin visual evidence. Those visual checks must not be listed as missing coverage. They were run before the current remediation changes, so a post-fix re-sweep is still required before calling the changed screens verified.

The second audit is now part of this work queue. The following remain open in code and are the first priority: **S-38** HR self-service is locked for every employee; **S-39** super-admin dashboard uses invented values; **S-40** super-admin revenue can show collected greater than billed and a zero remainder; **S-41** the auth rate limit counts every page session check per IP; **S-52** parent/student event access is not scoped tightly enough by audience and status; **S-53** salary payment batches can skip RIB validation and bank export. The rest of the second-audit queue, **S-42–S-51 and S-54–S-57**, also remains open until its finding-specific code checks and a post-fix visual sweep pass.
