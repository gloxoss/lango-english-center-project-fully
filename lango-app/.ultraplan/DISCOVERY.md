# UltraPlan Discovery

## Project Idea
Fully fix all pages that other agent sessions built with hardcoded/mock data and no real backend wiring. For each: build or connect the real, secure, tenant-scoped business logic behind it so the page reads and writes real data instead of static placeholders.

## Codebase Context
Existing codebase (not greenfield): SchoolOS/Lango, Next.js 16 App Router, Drizzle ORM, PostgreSQL, Better Auth, Tailwind v4. Multi-tenant K-12/language-center SaaS. Established conventions: `requireRequestContext` → `requireTenant`/`requireSuperAdmin` → Zod `.strict()` → tenant-scoped Drizzle query → `recordAudit()` → `apiErrorResponse()`. 79/133 API routes have `requireCapability` wired (this session's prior work). Category 6 (Existing Patterns) is answered by the codebase itself, not by asking the user.

## Discovery Q&A

<!-- Categories: 9 total, condensed per user's existing-codebase context -->
<!-- Progress is tracked per category -->

### Category 1: Core Requirements
Q: Cover every hardcoded/mock page the audit finds, or only pages in roadmap-shipped phases?
A: Everything the audit finds. If a page is reachable in the app, it should work or be clearly marked unavailable, regardless of nominal roadmap phase.

### Category 7: Preferences & Tradeoffs
Q: Fix newest agent-built pages first, or long-standing known-hardcoded ones (header search, users pagination, report cards) first?
A: Newest first — most likely actively broken right now; fixing them prevents the gap calcifying while the other agent moves on to yet more new pages.

Q: Default policy when a page shows a stat with no real schema backing (e.g. old fake GPA field)?
A: Case-by-case, not a blanket rule. Some stats may be worth a small real migration if genuinely valuable; others get removed. Decide per page, not up front.

Q: Coordination with the other agent's ~62 actively-edited files (academics, attendance, homework, settings)?
A: Plan now, execute later. Planning doesn't touch files. Re-check file stability at execution time, per section, not at planning time.

### Category 4: Edge Cases
Q: Pages with no backend at all yet (needs new schema/migration) - design that too, or defer to a follow-up plan?
A: Design it too. One comprehensive plan, no deferred stubs.

### Category 5: Quality Attributes
Q: Testing bar per fixed page?
A: Real route-level test for anything touching money, permissions, or tenant isolation. tsc + manual browser check for straightforward CRUD/display pages.

Q: Plan structure - one big plan or split by module?
A: One plan, many sections. Single traceability matrix and progress view; sections still run independently.

### Categories 2, 3, 6, 8, 9 — answered from existing context, not re-asked
- **Users & Context**: already established (school_admin, teacher, accountant, receptionist, student, parent, guard roles; web dashboard, French-primary UI).
- **Integration Points**: no new external integrations implied by this idea — internal DB wiring only, using the existing Drizzle/Postgres/Better Auth stack.
- **Existing Patterns**: see Codebase Context above — established route pattern is the standard to match.
- **Monetization**: not applicable, this is internal feature-completion work, not a product/pricing decision.
- **Visual & UX Vision**: existing design system already defined in CLAUDE.md (slate/blue palette, KPI banners, data-dense tables) — not a redesign, pages keep their current look, just get real data.

## Discovery Summary
- Total questions asked: 7 (across 4 categories with real decision points)
- Categories fully covered: Core Requirements, Edge Cases, Quality Attributes, Preferences & Tradeoffs
- Categories answered from existing context (not re-asked): Users & Context, Integration Points, Existing Patterns, Visual & UX
- Categories skipped as not applicable: Monetization & Business Model
- Key themes: fix newest pages first, comprehensive scope (build missing backend, not stubs), case-by-case on fake stats, test money/security paths only, one unified plan

