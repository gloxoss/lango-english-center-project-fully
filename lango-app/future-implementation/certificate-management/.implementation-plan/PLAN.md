# Certificate Issuance & Verification — Implementation Plan

> Read `future-implementation/_shared/APP-CONTEXT-AND-UI-SYSTEM.md` FIRST. Read the source spec `CERTIFICATE-MANAGEMENT.md` and `REFERENCE-REPOSITORIES-AND-STANDARDS.md` in this same folder — the product logic (page architecture, categories, correction-vs-revocation rules, evidence model, permissions, privacy) is already thorough and is not repeated here. Also read `future-implementation/card-and-admit-card-management/.implementation-plan/PLAN.md` — this plan depends on decisions made there.

## 1. Dependency on Card Management — build order matters

This addon's own source spec is explicit: it "should reuse the same internal document-template/generation platform selected for Card Management (`pdfme`)... Shared engine code belongs in a neutral internal library, not inside one addon importing another addon's private UI." **This plan assumes Card Management's `src/libs/document-studio/` shared engine (template schema type, `renderPdf`, `<TemplateDesigner>`, field-allowlist validator, pdfme wrapper — see the Card Management plan §2) is built first or in parallel.** If executed before `document-studio` exists, the correct first move is to build that shared package (following the Card Management plan's §2 exactly) rather than starting a second, parallel pdfme integration inside `src/features/certificates/`. Do not duplicate the designer/engine.

## 2. What's already real vs. what the source spec assumes

Re-verified against the actual codebase for this plan (same audit that informed the Card Management plan):

- **`certificates` table is confirmed dead**, exactly as the source spec states: `Schema.ts:1382-1406`, FKs to `courses` (the explicitly dead LMS chain, `Schema.ts:98-103` comment), zero routes or services read/write it anywhere in `src/`. Build a clean new schema, per the source spec's own instruction — do not extend this table.
- **No email delivery infrastructure exists.** Confirmed — there is no messaging/email service in this codebase to check against; the source spec's own "Missing today" section already correctly identifies this and scopes email delivery out of v1 ("Email delivery is enabled only after real email infrastructure exists... never claim a message was sent"). Keep that scoping. Portal download only for v1.
- **`html2canvas`/`jspdf` are installed but have zero real usages** — same finding as the Card Management plan. Do not use them; use the shared `document-studio` (pdfme) engine for all certificate rendering, matching the source spec's own instruction to share the engine with Card Management.
- **Employee experience/service certificates need HR employment history that doesn't fully exist yet** — the source spec already flags this correctly ("restrict these to an authorized manual request with reviewed evidence" before HR exists). No correction needed; just confirm at execution time whether the HR addon (`employeeProfiles` model, referenced in this session's other work) has landed yet, and gate the richer employee-certificate fields on its presence exactly as the source spec describes.
- **Addon entitlement gating**: reuse the same real `requireAddon(tenantId, addonId)` helper (`src/libs/api/entitlements.ts`) the Card Management plan uses — register a distinct `'certificates'` addon id (commercially independent purchase, per the source spec), not bundled with `'cards'`.
- **Evidence sources that already exist and are real**: `assessmentDefinitions`/`assessmentOutcomes` (this session's assessment-and-examination work) for the "assessment threshold" eligibility rule, `attendance`/`attendanceRegisters` for the "attendance percentage" rule, `studentPlacements`/`classSections` for the "active enrollment" rule. The source spec's "Eligibility rule builder" categories map directly onto these real tables — confirm exact column names at execution time (this session built/hardened all of them, so they're current and trustworthy) rather than assuming the source spec's field names match exactly.

## 3. Schema

Build the source spec's "Recommended data model" section verbatim as a new feature schema at `src/features/certificates/models/certificates-schema.ts` — `certificateDefinitions`, `certificateDefinitionVersions`, `certificateTemplates`/`certificateTemplateVersions` (same JSON schema shape as Card Management's `documentTemplateVersions`, pointing at the same `document-studio` template type, but a separate tenant-scoped table — each addon owns its own template rows even though they share the rendering engine), `certificateRequests`, `issuedCertificates`, `certificateJobs`/`certificateJobItems`, `certificateEvents`, `certificateSignatories`. Follow the shared reference doc's schema conventions exactly (barrel export, hand-written migration, no `drizzle-kit generate`).

## 4. Eligibility rule evaluation — real adapters, not a generic rule engine

The source spec is explicit that rules must be "stored as validated structured JSON/enums. Never accept raw SQL or JavaScript expressions." Implement this as a small, closed set of real TypeScript evaluator functions (one per rule type: manual-authorized, enrollment-active, assessment-threshold, attendance-percentage, event-participation, HR-employment), each a pure function taking `(tenantId, recipientId, ruleParams)` → `{ eligible: boolean; evidenceSnapshot: object }`, dispatched by the stored rule-type enum. This matches this session's established "extract pure, directly-tested functions the real code calls" discipline (`isAssetVisibleToUser`, `doTimeRangesOverlap`, etc.) — each evaluator becomes real vitest-testable logic, not an untestable generic interpreter. Do not build a generic expression parser/interpreter even a "safe" one — the closed-adapter-set approach is both simpler and matches the explicit "no arbitrary code" requirement more directly.

## 5. Serial number policy — real collision-safe generation

Source spec explicitly warns: "Never use `Date.now()` alone as a credential serial or security token." Implement the serial (`LNG-2026-000123`-style) via a real per-tenant-per-year sequence: either a Postgres sequence/`nextval` scoped per tenant+year, or a `SELECT ... FOR UPDATE`-guarded increment inside the same `db.transaction` pattern used for `AssetService.ingestVersion`'s version numbering this session (`src/features/attachments/services/asset-service.ts`) — reuse that exact transaction-safety pattern, don't re-derive it. The public verification token is a separate, unrelated, high-entropy random value (`crypto.randomBytes`), hashed at rest (same `blobKeyFor`-adjacent discipline as everywhere else tokens are handled this session) — never derive the token from the serial or vice versa.

## 6. Page architecture

Use the source spec's page list verbatim (`CERTIFICATE-MANAGEMENT.md` §"Page-by-page plan", routes `/dashboard/certificates`, `/definitions`, `/templates`, `/templates/[id]/edit`, `/issue/students`, `/issue/employees`, `/requests`, `/issued`, `/issued/[id]`, `/jobs`, `/settings`, public `/verify/certificate/[token]`) — already well-specified. Build every page per the shared UI system doc's conventions (single-file pages, real fetch, KPI banner, correct `Badge` variants, French copy, sidebar registration under a "Certificats" nav section). The template designer page reuses `document-studio`'s `<TemplateDesigner>` component directly (same exception to "single-file pages" as Card Management's designer, same shared component — do not build a second designer wrapper).

## 7. Suggested build order

1. Confirm `document-studio` exists (Card Management plan) — build it first if not.
2. Addon entitlement gating (`requireAddon(tenantId, 'certificates')`).
3. Certificate schema + migration (§3).
4. Eligibility evaluator functions (§4) with real unit tests.
5. Definitions + Template Library + Designer pages.
6. Issued-certificate/serial/token lifecycle (§5) + public verifier.
7. Student issuance flow (single + bulk via job system — reuse whatever async-job approach Card Management lands on, don't build a second one).
8. Requests & Approvals workflow (draft→submitted→under_review→changes_requested→approved→rejected→issued→cancelled state machine — a real, small state machine, not a loose status string with implicit transitions).
9. Employee issuance (gated on HR employment-history availability per §2).
10. Correction/replacement/revocation flows, signatories settings page.
11. Open Badges 3.0 export — explicitly a later phase per the source spec, do not build in v1.

## 8. Acceptance checklist (live-verify, no self-reporting)

- [ ] A real certificate issued from a real eligibility evaluation (e.g. real `assessmentOutcomes` threshold) — confirm the evidence snapshot stored on the issued record matches the real source data at issuance time, and that later changing the underlying assessment definition's pass threshold does NOT retroactively alter the already-issued certificate's claim (per the source spec's explicit requirement).
- [ ] Duplicate/retry a bulk issuance job — confirm no student receives two active certificates for the same definition+period (job-item idempotency).
- [ ] Correction flow: create a replacement certificate, confirm the original is marked `replaced` (not deleted), both directions link correctly, and the replacement gets a genuinely new serial + token.
- [ ] Revocation: confirm `/verify/certificate/[token]` immediately reflects `revoked` status while the full record/history remains intact internally.
- [ ] Public verification page never leaks evidence, DOB, national ID, salary, or guardian data — inspect the actual response payload, not just the rendered UI.
- [ ] Four-eyes approval (if enabled for a definition): confirm the requester/preparer cannot also be the final approver on the same certificate — test this as a real rejected-action case, not just a UI hint.
- [ ] Cross-tenant sweep on every new route.
- [ ] Serial numbers are real, collision-safe, sequential per tenant+year under concurrent issuance (load-test with parallel requests, not just sequential ones) — this is exactly the kind of race the version-numbering transaction pattern in §5 exists to prevent.
