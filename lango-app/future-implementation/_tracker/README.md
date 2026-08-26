# `_tracker/` — Implementation-Plan Audit & Progress Workspace

This folder is your working space for tracking every future-implementation plan against the live `schoolos-app` codebase.

## What's here

| File | Purpose |
|------|---------|
| `PLANS-AUDIT-AND-PROGRESS.md` | **The single source of truth.** Full audit of all 36 plans (verdict, scope, what exists, what's missing) with a tick-box checklist per plan and a summary table. **Edit this as you work.** |

## How to work with it

1. **Pick a plan** from the Summary Table, or follow the *Suggested work order* at the bottom.
2. **Open the per-plan section** and read its `Found in code` + `Gaps / next actions` — every gap is a `- [ ]` checkbox.
3. **As you fix each gap**, change `- [ ]` → `- [x]` in this file. Commit the tracker alongside the code so progress is never lost.
4. **When a plan is complete**, update its **Status (edit me)** cell in the Summary Table (🔴 → 🟡 → ✅) and update the plan folder's own status doc if it has one (e.g. `PLAN-STATUS.md`, `STATE.md`).

## Ground rules discovered during the audit

- **Don't trust plan-doc status lines** — ~11 plans self-report "not started" while the code is fully built (and two EXECUTION-AUDIT reports overclaim "100% deployed"). The codebase is the source of truth; this tracker reflects it.
- **Fix the build blocker first** (`src/features/workforce/services/payroll-runs.ts:562`) — every other plan's verification runs `npx next build`.
- **Cross-cutting issues** (migration collision at `0057`, stale addon-registry flags, remaining mock data, unguarded teacher/student portal pages) are listed at the top of the tracker — sweep them as you go.
