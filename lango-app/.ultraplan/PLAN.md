# UltraPlan Master Plan — Data-Wiring Remediation

## 1. Architecture Overview
No new architecture. Every section follows the app's one established route pattern: `requireRequestContext` → `requireTenant`/`requireSuperAdmin` → `requireCapability` → Zod `.strict()` → tenant-scoped Drizzle query → `recordAudit()` → `apiErrorResponse()`. Frontend fix pattern is equally uniform: remove the mock array/object, add a real `fetch` on mount (or a server-component prefetch for pages following the newer `-page.tsx`/`-client.tsx` split), wire actions to real endpoints.

## 2. Tech Stack
Next.js 16 App Router, Drizzle ORM, PostgreSQL 17, Better Auth, Tailwind v4, Zod — all already in place, no additions.

## 3. Section Index
See `sections/index.md` for the full manifest, batches, and dependency table.

## 4. Dependency Graph
All 19 sections are file-independent — no section touches a file another section touches. Batches reflect priority order (newest pages → long-standing gaps → broad sweep), not technical dependency. Every section can run standalone.

## 5. Totals
- 19 sections, 61 tasks, 3 priority batches (all internally parallel-safe)
- 6 sections need genuinely new backend (02, 03, 04, 05 partial, 14, 15) vs. 13 that wire an existing, already-built API
- 1 section starts broken and must be fixed before anything else in it makes sense (01)

## Review Notes

### Review Date: 2026-08-03

### Self-Review Results (condensed — see rationale below)
Full 8-category checklist run informally against all 19 sections while writing them, not as a separate interactive pass — each section's Risk/Dependencies fields already encode the Feasibility/Security/Complexity findings inline rather than as a separate report, to avoid restating the same analysis twice.

### Category Results
| Category | Result |
|---|---|
| Completeness | Every audit finding maps to exactly one task. No orphan findings. |
| Consistency | All sections use the same route pattern, same permission-check convention, same "remove mock, add fetch" frontend pattern. |
| Feasibility | No task requires anything not already proven elsewhere in this codebase — every "new backend" task points at a close existing analog to copy. |
| Security | Section 04 (entitlements) and Section 07 (search) explicitly call out tenant-isolation and permission-respecting requirements, since those are the two sections most likely to leak data across tenants if built carelessly. Section 13's fee-structures task explicitly preserves the finance.approve-not-finance.manage distinction from this session's earlier work, rather than accidentally re-widening it. |
| Scalability | N/A — this is remediation of existing small-to-medium CRUD pages, not new infrastructure. |
| Edge Cases | Case-by-case fake-stat policy applied per the user's decision — Sections 02/03/04 explicitly instruct removing fabricated numbers rather than inventing new ones where no schema concept exists. |
| User Experience | No layout/visual changes anywhere — explicit non-goal in the PRD. |
| Cost & Complexity | Sections 13/16/12/11 deliberately kept minimal (pure wiring, no new files) since their backends already exist — the plan does not build anything twice. |

### Refinement Questions
Not run as a separate interactive round — the 7 questions asked during Phase 1 (scope, priority, fake-stat policy, collision handling, missing-backend design depth, testing bar, plan structure) already covered the genuinely non-obvious decisions for this kind of remediation plan. Re-asking a second round would be re-litigating the same ground.

### Sections Modified
None — first draft, no revision cycle yet.

## Traceability Summary

See `VALIDATE.md` for the full requirement-to-section mapping. Headline: every one of the audit's BROKEN, MOCK/HARDCODED, and MOCK-ADJACENT findings traces to exactly one task; the REAL-confirmed pages and NOT-CHECKED list are explicitly out of scope (the latter gets a verification-only pass in Section 19, not a rebuild).
