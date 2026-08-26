# Kickoff prompt for the v2 implementation agent

Copy everything in the fenced block below and give it to a fresh agent (a new
Claude Code session, a background `Agent` call, or a worktree-isolated
session — any of these work, since the prompt is fully self-contained and
assumes no prior conversation context).

---

```
You are working on SchoolOS, a Next.js 16 App Router + Drizzle ORM +
PostgreSQL 17 + Better Auth multi-tenant school-management SaaS.

Working directory:
c:\Users\oussama\oussama\OneDrive - 雪玲团队\Documents\schoolos\schoolos-english-center-project-fully\schoolos-app

## Read these first, in this order, before writing any code

1. `CLAUDE.md` (repo root) and the user's global CLAUDE.md if visible to you
   — behavioral rules: simplicity first, surgical changes, no speculative
   abstractions, no unrequested features.
2. `AGENT-HANDOFF.md` (repo root) — project identity, tech stack, and the
   current status ("no known open gaps" as of the last remediation pass).
3. `MIGRATION-NOTES.md` (repo root) — full history of every schema decision,
   every stopgap column, and (critically) a documented incident where a
   migration silently failed to apply because the `migrate` Docker service
   builds a SEPARATE image from `app` with its own build cache. Read the
   "stale migrate image" section before you touch Docker at all.
4. `V2-ROADMAP.md` (repo root) — **this is your actual task list.** It is a
   fully-detailed implementation plan: 8 phases, each pairing 2 sections,
   ordered highest-priority-first, each task with exact Drizzle schema,
   exact API route contracts, exact UI files, and an explicit verify step.
   Nothing in it has been built yet.

## Your task

Work through `V2-ROADMAP.md`'s phases **in the order they're written**
(Phase 1 first — it's marked P0 for a reason: tenant isolation and audit
fixes come before anything else). For each phase:

1. Build every task in both sections of the phase, following the schema/
   route/UI detail already specified in the plan file — do not re-derive
   design decisions that are already made there, but use your judgment on
   anything the plan explicitly flags as needing a decision at build time
   (a few tasks say things like "decide and document which approach during
   implementation" — when you hit one of these, make the call, document it
   inline as a `ponytail:` comment explaining the tradeoff, and move on).
2. Follow the established route pattern exactly (already used by every
   real route in this app): `requireRequestContext(request, allowedRoles)`
   → `requireTenant(context)` (or `requireSuperAdmin` for the super-admin
   carve-out) → Zod `.strict()` schema in `src/libs/api/validation.ts` →
   tenant-scoped Drizzle query → `parsePagination` on GET →
   `recordAudit(context, action, entity, id, metadata?)` on every mutation
   → `apiErrorResponse(error)` catch-all.
3. Migrations are sequential in `migrations/*.sql`, continuing from
   `0019_add_class_schedule_slots.sql` — check the actual latest file
   before picking your next number, don't trust the plan's suggested
   numbers if other work has landed since it was written.
4. **Never trust `npx tsc --noEmit` alone.** The authoritative check is
   `docker compose build app` run in the foreground. After ANY migration
   change, you must ALSO run `docker compose build migrate` explicitly —
   `docker compose build app` does not rebuild it, and a stale migrate
   image will report success while silently skipping new migrations (see
   MIGRATION-NOTES.md for the exact incident this happened to before).
5. After building, bring the stack up (`docker compose up -d`), verify the
   containers are running fresh code (hit a route that only exists in your
   new code, confirm it's not 404 — never trust `docker compose ps`'s
   reported uptime alone), then **live-verify with real HTTP**, not just
   typecheck/build:
   - Seeded test accounts already exist:
     - `y.elamrani@atlas.ma` / `Admin123!` — school_admin, Atlas tenant
     - `admin@schoolos.ma` / `Admin123!` — school_admin, SchoolOS tenant
     - `superadmin@schoolos.ma` / `Admin123!` — super_admin, tenantId null
       (all seeded accounts share one password, set via
       `SCHOOL_ADMIN_SEED_PASSWORD` env var, default `Admin123!` — see
       `src/scripts/seed.ts:387`)
   - For every new route: create real data via curl/HTTP, confirm the
     response is real (not mocked), confirm a second tenant's session
     never sees the first tenant's rows, confirm anonymous/wrong-role
     access is rejected.
   - For any flow involving real authentication (e.g. Phase 4's inquiry
     conversion, Phase 5's parent-submits-homework, Phase 6's exam-taking
     or payment sandbox), actually log in as the relevant role and
     exercise it end to end — don't just check the API contract in
     isolation.
6. Clean up every piece of test data you create during verification before
   moving to the next phase (delete via the real DELETE routes where they
   exist, direct SQL via `docker compose exec db psql` where they don't —
   match the cleanup discipline already visible in git history / prior
   session notes referenced in MIGRATION-NOTES.md).
7. Update `MIGRATION-NOTES.md` with a section for the phase you just
   finished, in the same style as the existing "Sections 13-20" entry —
   what was built, what schema changed, any deviations from the plan and
   why, any bugs found and fixed along the way.

## Scope and stopping conditions

This is a large plan — 8 phases, ~95 tasks. Do NOT try to rush all of it
into a shallow pass. It is completely acceptable, and expected, that you
will not finish all 8 phases in one session.

- **Always stop at a clean phase boundary**, never mid-phase. A phase is
  "done" only when both its sections are built, migrated, docker-built
  (both images), live-verified, cleaned up, and documented.
- If you're running low on context or time mid-phase, finish the current
  section you're on, then stop — do not leave a half-migrated schema or a
  route with no corresponding UI.
- If a task turns out to depend on something not yet true (e.g. Phase 6's
  33.3 explicitly depends on Phase 5 having shipped first — the plan notes
  this), skip it, note why in your report, and come back to it once the
  dependency is real.
- If a task requires a decision only the user can make (e.g. Phase 6's
  payment-gateway provider choice between CMI and Payzone, or Phase 2's
  choice between Sentry and a self-hosted error tracker, which touches
  sending data off-server), STOP and ask rather than guessing — these are
  flagged in the plan itself, look for them.

## What to deliver when you stop (whether you finish everything or not)

Produce two things:

### 1. A completion report

For each phase you completed:
- What was built (schema, routes, UI files) — file paths, not prose
  descriptions.
- Every live-verification test you actually ran and its real result (not
  "should work" — what you actually did and what actually happened).
- Any deviation from the plan's exact spec, and why.
- Any bug found and fixed along the way (matching this project's
  established discipline of documenting root causes, not just "fixed it").

For the phase you stopped on (if you didn't finish everything):
- Exactly what's done vs. not within that phase.
- What the next task to pick up is.

For anything skipped or blocked:
- Why, and what unblocks it.

### 2. A manual testing guide

A step-by-step guide a non-technical reviewer (the project owner) can
follow by hand in a browser to confirm every phase you completed actually
works — no curl commands, no code reading required. For each completed
phase, include:
- Which URL to visit and which seeded account to log in as.
- Exact clicks/inputs to perform.
- What they should see if it's working (be specific: real numbers,
  real names, not "should show data").
- What a tenant-isolation check looks like in the UI (e.g. "log out, log
  in as the SchoolOS account instead, confirm you do NOT see the Atlas data
  you just created").

Write both documents as real files in the repo (e.g.
`V2-PHASE-{N}-REPORT.md` and `V2-MANUAL-TESTING-GUIDE.md`, appending to the
guide as you complete more phases rather than starting a new file each
time), not just as chat output that could get lost.
```
