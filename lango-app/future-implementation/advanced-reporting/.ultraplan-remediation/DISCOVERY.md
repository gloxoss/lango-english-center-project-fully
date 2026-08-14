# UltraPlan Discovery — Advanced Reporting Addon Remediation

## Project Idea
Remediate the Advanced Reporting Addon so it is actually production-ready: every report in the 27-item catalog runs against a real query and produces a real export, permissions are genuinely enforced, and nothing claims to be "verified" without being genuinely tested. Full audit findings (see STATE.md) are the primary input, not a rediscovery.

## Codebase Detection
- Codebase found: Yes
- Stack: Next.js 15 App Router, TypeScript, Drizzle ORM, PostgreSQL, multi-tenant (school_id-scoped), Docker Compose deployment
- Patterns: `requireRequestContext` → `requireTenant` → `requireCapability` → Zod `.strict()` → tenant-scoped Drizzle query → `recordAudit()` → `apiErrorResponse()` — this addon currently violates this convention in nearly every route

## Discovery Q&A

<!-- Categories: 9 total -->
<!-- Progress is tracked per category -->

### Core Requirements - Batch 1

**Q: What's the priority for this remediation, given 23/27 reports fall back to fake data?**
A: Wire every report to real data — make all 27 catalog reports genuinely query the database, not just the 4 that partially work today.

**Q: If a report's underlying data genuinely isn't ready yet (e.g. Inventory, disabled module), what should happen?**
A: Show "not available yet" and refuse to run — matches the honest-placeholder pattern already used elsewhere in this codebase.

### Core Requirements - Batch 2

**Q: The plan specified 31 reports but only 27 were built (4 Platform/Audit reports silently dropped). Build them or cut scope?**
A: Formally cut them from scope — document as out of scope (likely belongs in a super-admin monitoring tool, not a school-level reporting catalog).

**Q: Should this remediation also grant the addon to real tenants, or just fix the code?**
A: Fix the code, leave activation as a separate explicit decision made afterward — not bundled into this remediation.

### Core Requirements - Batch 3

**Q: Should the golden-dataset test suite be rebuilt to actually test the 5 originally-specified invariants?**
A: Yes, rebuild it for real — a real automated test suite is the guardrail that prevents a fake "verified" claim from happening again silently.

**Q: XLSX export is fake XML, PDF export is HTML-with-.pdf-filename. How to fix?**
A: Build real exports — install a proper library (e.g. exceljs, a real PDF renderer) so files actually open correctly.

### Users & Context - Batch 1

**Q: Sidebar nav is gated behind 'reports.manage' (admin-only) though the plan named teachers/accountants/parents as audiences. Fix it?**
A: Yes, gate on 'reports.read' instead — fixes a real bug where named audiences currently can't see the nav link at all.

**Q: Should sensitive reports (payroll, financial statements, credentials) stay admin-only even with broader nav access?**
A: Add sensitivity-based restrictions — matches this codebase's existing capability-based access pattern. [Confirmed during discovery: `reporting-schema.ts:26` and every entry in `catalog-definitions.ts` already carry a `sensitivityLevel` field (standard/restricted/confidential) that is currently defined but never enforced anywhere — this is a wiring gap, not new schema work.]

### Users & Context - Batch 2

**Q: Which roles beyond school_admin should access 'restricted' reports?**
A: school_admin + teacher.

**Q: Which roles should access 'confidential' reports (payroll, financial statements, credentials)?**
A: school_admin only.

### Users & Context - Batch 3

**Q: Should accountants get domain-scoped restricted/confidential access (Fees/Financial only) rather than none at all?**
A: Yes — accountants get restricted+confidential access, but only within Fees/Financial domain reports (not HR payroll, not student credentials).

**Q: Should parents get their own per-child-scoped access in this remediation, or be excluded for now?**
A: Exclude parents from this remediation — per-child data scoping is a materially different access model, treat as a follow-up.

### Integration Points - Batch 1

**Q: Should this remediation build a real scheduler/worker for Scheduled Delivery, which currently never executes?**
A: Yes, build a real worker — cron-parsing calculateNextRun() plus an actual execution loop, matching how this app already runs background jobs.

**Q: Should completed export files be stored durably or generated fresh every time?**
A: Store durably in the existing tenant-namespaced uploads volume — same pattern already used for student photos/documents.

**[CORRECTION during discovery]** Verified via grep: this app has NO existing background job/cron mechanism anywhere (no worker container in docker-compose.yml, no `node-cron` or similar in package.json). The earlier answer's premise ("matching how this app already runs background jobs") was wrong — there is no such existing pattern.

**Q: Given no existing scheduler pattern and a single-container Docker Compose deployment, which worker approach fits best?**
A: In-process interval check — a lightweight setInterval-based checker inside the existing app process that polls for due schedules every few minutes, no new container/infrastructure.

### Integration Points - Batch 2

**Q: What delivery mechanism should the worker use once a scheduled report is generated?**
A: In-app notification only — appears in the user's Runs/Reports list, no email/SMS integration. Matches this app's pattern of honestly-simulated notifications.

**Q: Should the addon integrate with the existing audit log system (recordAudit) for every report run/export/schedule action?**
A: Yes, wire recordAudit() into every mutating route — matches codebase convention, currently zero audit calls exist anywhere in this addon.

### Edge Cases - Batch 1

**Q: Should report_definitions be global or tenant-scoped, and should seeding be safe to re-run?**
A: Global (confirmed: `reporting-schema.ts:21` — `key` is the PK, no `tenantId` column exists), seeded once, idempotent/safe to re-run.

**[Finding during discovery]** `report_definitions` already has an unused `requiredPermissions: text[]` array column (`reporting-schema.ts:32`) — this can be populated per catalog entry and checked at the route layer, reusing existing schema instead of inventing a new access-control mechanism for the sensitivity tiering decided above.

**Q: Should a failed report query show a real error or silently fall back to something?**
A: Real error message, no silent fallback — run marked 'failed', never silently substitute mock/fake data.

### Edge Cases - Batch 2

**Q: Should there be a limit on report result set size to avoid slow queries/huge exports?**
A: Yes — reasonable cap with pagination for on-screen preview; full export still includes everything, hard row cap (e.g. 50,000) prevents pathological queries.

**Q: What happens if a user tries to download an expired/deleted export file?**
A: Clear "this file is no longer available" error — no silent fallback, no fake file.

**Q: What if a scheduled report's target (e.g. deleted class-section) no longer exists when it fires?**
A: Skip that run, mark it failed with a clear reason, keep the schedule active — don't disable the whole schedule over one stale run.

### Quality Attributes - Batch 1

**Q: Should the fabricated Balance Sheet / HR masking claims specifically get real automated regression tests?**
A: Yes, real automated tests for all 5 original invariants — confirms the earlier test-rebuild decision extends to these two fabricated claims specifically.

**Q: Should report execution be rate-limited given the confidential data involved?**
A: Yes, add reasonable rate limiting — matches existing checkRateLimit pattern already used elsewhere (e.g. document verification at 10/hour/IP).

### Quality Attributes - Batch 2

**Q: Should the fake hardcoded checksum string be fixed to a real hash?**
A: Yes, real SHA-256 of actual file content — reuse SnapshotService's existing correct SHA-256 logic.

**Q: How much history should be kept for report runs before cleanup?**
A: Keep run metadata indefinitely (audit purposes), clean up only export files after ~30-90 days to save disk space.

### Existing Patterns - Batch 1

**Q: Should every reporting route file be rewritten to fully match codebase convention, or just patched at the specific broken pieces?**
A: Rewrite each route file to fully match convention — given multiple simultaneous deviations per file, a clean rewrite per route is more reliable than patching separately.

**Q: Should domain adapters keep their current per-domain-file structure?**
A: Yes, keep current structure — the problem is fake methods inside, not the organization; fix in place.

### Existing Patterns - Batch 2

**Q: Should this remediation run the existing tenant-isolation checker script and fix everything it flags?**
A: Yes, run it and fix every flagged route — same verification discipline used for alumni-portal earlier this session.

**Q: Anything else you want changed beyond what the audit flagged?**
A: No, just fix exactly what the audit found — stay scoped to confirmed defects, no speculative additions.

### Preferences & Tradeoffs - Batch 1

**Q: One continuous execution pass, or checkpoint partway through?**
A: One continuous pass with live verification at the end — same approach as alumni-portal.

**Q: Simpler fix matching existing patterns, or more complete/robust when in tension?**
A: Simpler, matching existing codebase patterns exactly — consistent with the rest of this session's work.

**Q: Any constraint on adding new npm dependencies (exceljs, PDF library) for real exports?**
A: Fine to add well-established, actively-maintained packages.

### Monetization & Business Model - Batch 1 (adapted: this addon's real analog is its tenant-entitlement/licensing gate, `addon_entitlements`)

**Q: Should the remediation touch the entitlement/licensing mechanism itself?**
A: Leave the entitlement mechanism exactly as-is — not broken; the audit found the code behind it (once entitled) is non-functional, not the gate itself.

### Visual & UX Vision - Batch 1

**Q: Should the missing `save-view-modal.tsx` be built now?**
A: Yes — lets a user save current filters/columns as a named reusable view, matching the existing unused `report_saved_views` table.

**Q: How should "not ready" reports appear in the catalog?**
A: Greyed-out with a "Bientôt disponible" badge, disabled click — consistent with the earlier "show it but block running it" decision.

### Visual & UX Vision - Batch 2

**Q: Should the 5 existing UI pages get a visual refresh, or just have their data/functionality fixed?**
A: Keep current visual design, just fix the data/functionality behind it — no visual refresh needed.

**Q: Should completed scheduled reports show any in-app completion indicator?**
A: Simple new/unread badge on the Runs nav item — lightweight, no full real-time notification system.

## Discovery Summary
- Total questions asked: 38
- Categories fully covered: Core Requirements, Users & Context, Integration Points, Edge Cases, Quality Attributes, Existing Patterns, Preferences & Tradeoffs, Visual & UX Vision (8/9 at full depth)
- Categories covered at reduced depth (deliberately, low relevance for an internal admin addon): Monetization & Business Model (1 question, adapted to the addon's real analog — its tenant-entitlement gate)
- Categories skipped: none
- Key themes identified:
  - Wire all 27 catalog reports to real data; explicit "not ready" state (not fake data) for anything genuinely unbuildable
  - Fix the addon-wide `await` bug and FK-seeding blocker as the true root unlocks
  - Add real sensitivity-tiered access control reusing the already-present but unused `sensitivityLevel`/`requiredPermissions` schema fields
  - Build a real (but appropriately small) in-process scheduler worker — corrected mid-discovery after finding no existing cron/worker pattern in this app at all
  - Rebuild the golden-dataset test suite to genuinely test the 5 originally-specified invariants
  - Real exports (exceljs + a PDF library), real checksums, durable storage in the existing uploads volume, rate limiting, audit logging — all reusing existing codebase patterns rather than inventing new ones
  - Keep existing UI visual design and adapter file structure; only fix functionality
