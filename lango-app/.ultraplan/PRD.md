# Product Requirements Document (PRD) — Data-Wiring Remediation

## 1. What We're Building
A remediation pass across the SchoolOS dashboard: every page currently showing hardcoded arrays, fake numbers, or a "save" button that doesn't persist anything gets connected to real, tenant-scoped, secure backend logic. One page (`homework-submission-view.tsx`) is currently broken (compile errors) and gets fixed as part of this.

## 2. The Problem
Multiple agent sessions have built this app in parallel over several days. Some pages shipped with real backends; others shipped as visual mockups that were never wired up, or had their "Enregistrer" button wired to a `setTimeout` instead of a `fetch`. A school admin using these pages today would see data that looks real but isn't, and actions that appear to succeed but silently do nothing.

## 3. Who It's For
Same roles as the rest of the app: school_admin (sees everything), teacher, accountant, receptionist, student, parent — each page's audience is whichever role already has access to it today; this plan doesn't change access, it makes the pages honest.

## 4. What It Does
- Fixes 1 currently-broken page (compile errors).
- Wires 9 pages that have zero backend at all — 6 need new API routes (and in some cases new tables/migrations) built from scratch; 3 have real APIs sitting unused.
- Wires 19 pages that show hardcoded arrays but already have a matching, unused API route.
- Fixes 3 pages where server-side data is real but client-side actions (job triggers, connection tests, migration steps) are fake local-state changes.
- Fixes 2 dead-UI issues: global header search has no state at all; users-list pagination buttons have no handlers.
- Replaces `syllabus-view.tsx` with an honest "coming soon" placeholder (previously-established decision — no schema concept exists for it, not worth inventing one now).

## 5. How It Should Feel
No visual change. Same design system (CLAUDE.md: slate/blue palette, KPI banners, data-dense tables). The only user-visible difference: numbers are real, buttons work, and where something genuinely isn't built yet, it says so instead of faking it.

## 6. What It Connects To
No new external integrations. Everything wires into the existing Drizzle/PostgreSQL/Better Auth stack, following the established route pattern: `requireRequestContext` → `requireTenant` → `requireCapability` → Zod `.strict()` → tenant-scoped query → `recordAudit()` → `apiErrorResponse()`.

## 7. What It Does NOT Do
- Does not redesign any page's layout or visuals.
- Does not change who can access which page (no new roles/permissions beyond what wiring requires).
- Does not build syllabus tracking (explicitly deferred, placeholder instead).
- Does not touch the ~45 "NOT CHECKED" pages the audit didn't verify in depth — those are presumed wired (fetch calls present) and out of scope unless a follow-up audit finds otherwise.
- Does not touch files currently mid-edit by the other agent session until they're confirmed stable (execution-time check, not a planning-time exclusion).

## 8. How We'll Know It Works
- Every page in scope: `tsc --noEmit` clean, loads with real DB data for a fresh tenant (no leftover mock rows visible), and every action button performs a real, verifiable mutation.
- Money/permission/tenant-isolation-touching sections: a real automated test, not just manual check.
- Zero pages left showing a number or row that doesn't trace to a real table.

## 9. Business Model
Not applicable — internal remediation work, no pricing/monetization implications.

## 10. Risks & Concerns
1. **Collision risk**: the other agent's session is actively editing ~62 files overlapping several of these targets (academics, attendance, homework, settings). Mitigated by re-checking file state immediately before executing each section, not just at planning time.
2. **Scope inflation**: 6 pages need genuinely new backends (schema + routes), not just wiring — each is its own small design decision, not a mechanical fix.
3. **Silent divergence**: some "REAL" pages the audit confirmed still have partial fakes inside them (e.g. `security-sessions` synthesizes device/IP fields) — flagged per-section, not blanket-fixed, since the user asked for case-by-case judgment on this class of issue.
4. **Volume**: ~35 pages in scope. Executing all of it is a multi-session effort, not one sitting — the plan is structured in independently-runnable sections for exactly this reason.
