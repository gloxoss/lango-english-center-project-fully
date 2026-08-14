# Accountant Portal — Execution Agent Prompt
# Give this ENTIRE file to the agent before asking it to do any work.
# Version: 2026-08-05 | Owner: Oussama Zaki (Zakio)

---

## 0. MANDATORY FIRST READS, IN THIS ORDER

1. `SCHOOLOS-AGENT-MASTER-PROMPT.md` (repo root) — project identity, tech stack, API/UI conventions, design system, Docker workflow, permissions registry, agent discipline rules. Everything there applies here without exception.
2. `CLAUDE.md` (repo root) — project rules.
3. `future-implementation/accountant-portal/ACCOUNTANT-PORTAL-PLAN.md` — the plan you're executing. It is a **corrected v2**, already audited against the live codebase (not a first draft) — every "reuse this" / "this already exists" / "this is genuinely missing" claim in it was verified directly against `Schema.ts`, `permissions.ts`, the real route files, and the real page tree. Trust its existing-vs-missing breakdown; don't re-derive it from scratch.
4. `src/libs/api/permissions.ts` — read the actual current `PERMISSIONS` object and `DEFAULT_ROLE_PERMISSIONS.accountant` array before touching either. The plan describes what's there as of the audit; re-confirm it's still accurate at execution time in case the concurrent session (see §2) has touched it.

Do not start implementing until you've read all four.

---

## 1. MISSION

Execute Phases 0 through 5 of `ACCOUNTANT-PORTAL-PLAN.md`, in order — Phase 0 is two one-line capability-gate fixes and should ship first, standalone, before anything else. Phases 1–4 build on each other. Phase 5 (verification) is not optional cleanup at the end — it is the phase that determines whether any of this is real.

This plan exists specifically because a prior plan for a different feature (academic management enhancement, same repo) was executed by an agent that repeatedly reported "done" and "tested" for work that, on independent re-verification, turned out to be: migrations that were never applied, a backfill script with a join bug that silently linked zero rows, a UI with a hardcoded fallback value standing in for real data through two separate rounds of claimed fixes, and a first pass with zero git commits despite explicit instructions to commit per task. Every one of those failures was caught by literally re-running the migration, querying the database directly, and reading the actual fetch calls in the file — not by trusting the agent's own summary. **Assume the same standard of independent verification will be applied to your work here.** Section 6 below lists the exact failure patterns to avoid, because they are specific, not generic advice.

---

## 2. CONCURRENT EDITING — same standing condition as every other plan in this repo

A second agent session works in this exact repository throughout the day, independently, with no coordination channel. This has meant 125–240+ files sitting uncommitted at once at various points. Treat every file as potentially contested until you've checked it seconds ago.

**Before touching ANY file:**
```powershell
git status --short -- <exact file path>
```
If it's dirty and you didn't just make it dirty yourself, don't edit it directly. Either hold that task and move to the next safe one, or — for a clean, independent addition to a large shared file like `Schema.ts` or `permissions.ts` — use the isolated git-blob commit technique:
```powershell
git show HEAD:<path> > /tmp/clean_copy
# apply ONLY your own change to /tmp/clean_copy, never to the working-tree file
git hash-object -w /tmp/clean_copy
git update-index --cacheinfo 100644,<hash>,<path>   # full repo-root-relative path required
git commit -m "..."
```
This leaves the other session's in-progress, uncommitted edits on disk, completely undisturbed.

**Never**: `git checkout`/`restore`/`reset --hard`/`clean` on a file with uncommitted changes that aren't yours. Never revert their WIP to resolve a collision — make your own change additive/compatible instead.

**Before every commit**: `git diff --cached --stat` and confirm every listed file is one you intentionally changed. Commit per task (one task ≈ one commit), not in one giant batch at the end — a partial, honestly-committed run is worth more than an uncommitted "complete" one.

---

## 3. EXECUTION PROTOCOL, PER PHASE

1. Re-read the relevant section of `ACCOUNTANT-PORTAL-PLAN.md` fresh before starting it — don't rely on memory.
2. Collision-check every file you're about to touch (§2).
3. **Phase 0 first, alone.** These are two `requireCapability(...)` string changes plus one new capability entry — ship and verify them before anything else, since they're the highest-value, lowest-risk item in the whole plan and don't block on anything.
4. For Phase 2 (schema): re-read `migrations/meta/_journal.json`'s true highest `idx` at execution time — do not trust any migration number implied elsewhere, since the other session creates migration files without journaling them.
5. For Phase 4 (UI): before wiring any page to "real data," check whether the underlying route already exists and returns the shape you expect — several of the pages this plan reuses were built in earlier, unrelated sessions this same day; read them, don't assume their contract.
6. After every schema change: `docker compose build migrate` AND `docker compose build app` (separate images), run the migration, then verify via a **real `psql` query** — row counts, not just a success log line.
7. After every route/UI change: rebuild the app image, restart the container, hit the real endpoint or page with `curl`/browser and confirm the actual response — not what you expect it to be.
8. `npx tsc --noEmit` after every file change, but never as your only test. It has produced a false-clean result in this exact repo before (a script with a broken runtime comparison that `tsc` didn't catch until a later, separate check).
9. Stage and commit only what that task changed, verified via `git diff --cached --stat` before committing.

---

## 4. THE AUDIT REPORT

Create and continuously update: `future-implementation/accountant-portal/EXECUTION-AUDIT-REPORT.md`

Same structure as the academic-enhancement plan's audit report — an overview table updated after every phase (not batched at the end), per-phase detail with **exact commands run and their exact output pasted in**, not paraphrased, and a final summary. If you find yourself writing "tsc✓" as the only test evidence for a task that touched a database or a UI fetch call, that's a sign you haven't actually verified it — go run the real check first.

```markdown
## Overview Table
| Phase | Status | Commits | Tests run (real evidence) | Notes |
|---|---|---|---|---|
| 0 | done | <sha> | curl -i as accountant → 403 on credit-notes/fiscal-close; curl as school_admin → 200 | |
| ... | | | | |
```

---

## 5. WHAT "TESTED" MEANS HERE

- **Capability gates (Phase 0)**: log in (or simulate the request context) as `accountant@lango.ma` and as `admin@lango.ma`/`y.elamrani@atlas.ma`, hit the actual endpoint both ways, paste both real HTTP status codes. A code review of the `requireCapability` line is not a test.
- **Cashier session / collection desk (Phase 3)**: open a session, collect a real payment against a real invoice, confirm the invoice's balance actually changed in the database, close the session, confirm the closing totals match what was actually collected — computed from real rows, not asserted.
- **Sidebar filtering (Phase 1)**: log in as accountant, take the actual rendered nav item list (or query `/api/me/permissions` directly), confirm Academics/Settings/HR-employee-management items are absent — not "the filter logic looks right."
- **Migrations/backfills**: query real row counts before and after. If a backfill is supposed to link N rows and produces 0, that is not success with a caveat — it's a bug, find it before moving on (the exact bug that shipped twice in the academic-enhancement work was a join comparing two different foreign-key ID spaces that looked plausible on read but matched nothing at runtime).

---

## 6. SPECIFIC FAILURE PATTERNS FROM THE PRIOR PLAN — DO NOT REPEAT THESE

These are not generic reminders. Each of these actually happened, was reported as done/tested, and was only caught by independent re-verification:

1. **Claiming a migration succeeded without checking the database.** `docker compose run migrate` printing "applied successfully" only means the SQL executed without a syntax error — it says nothing about whether a backfill's `WHERE`/`JOIN` actually matched any rows. Always follow with a real row-count query.
2. **A UI component with a hardcoded placeholder standing in for a real value, left in place across multiple rounds of claimed fixes.** (`students.length || 20`, `averagePercentage: 75 // Default grade preview`.) Before claiming any page is "wired to real data," open the file and read every literal number/fallback in the fetch/render logic — if a fallback exists for the case where real data hasn't loaded yet, confirm it's never reachable in the actual rendered path, not just present as a defensive default.
3. **A join comparing two different foreign-key ID spaces** (a column pointing at `class_sections.id` compared directly against a column pointing at `sections.id` — same naming pattern, different tables). This app has several `X.somethingId` columns per table pointing at different targets; when writing a JOIN/UPDATE...FROM, verify what each `id` column actually references in `Schema.ts` before assuming two similarly-named columns are comparable.
4. **An overly broad dependency/guard check that makes a feature technically present but practically unusable** (a rollback's "has this student had any activity ever" check instead of "any activity since this specific event," which would block almost every real rollback forever). When writing a guard condition, sanity-check it against a realistic data volume, not just the empty-database case.
5. **Reporting zero commits as an acceptable end state** ("Total commits shipped this run: 0 (local changes)") despite explicit per-task commit instructions. Uncommitted work mixed into 200+ other dirty files from a concurrent session is not a safe stopping point under any circumstance — it is unrecoverable and unreviewable. Commit as you go.
6. **"Deviations from the plan: None" on a section that actually deviated** (building a parallel API route tree instead of extending the one the plan specified, silently dropping an existing DB constraint, defaulting a null value to a hardcoded number instead of "unlimited" as specified). If you make a different call than the plan describes — and sometimes that's the right call — say so explicitly and why. Silence on a real deviation reads as either not noticing or not disclosing; neither is acceptable.

---

## 7. SCOPE DISCIPLINE

- Don't touch any of the 14 existing finance pages/routes beyond what a specific task calls for (adding a nav link, changing one capability string). Most of this plan is deliberately built by *linking to* existing work, not modifying it.
- Don't add the granular `finance.collect`/`finance.prepare`/`finance.reconcile` capabilities the original draft proposed — the reworked plan explicitly dropped them as unnecessary. If you find a real reason mid-execution that they're needed after all, say so in the audit report rather than silently adding them back.
- Don't attempt to unify `sidebar.tsx` and `portal-manifest.ts` into one navigation source — the plan explicitly scopes that out as a larger follow-up.
- Don't build invoice cancellation unless Phase 3 turns out to need it for the approvals queue to make sense — check first, it may not.

---

## 8. WHEN YOU'RE DONE (or time/scope runs out)

1. Finalize the audit report's summary — what shipped, what's blocked, what needs a decision.
2. Update `ACCOUNTANT-PORTAL-PLAN.md`'s phase list with actual outcomes if anything deviated from plan.
3. Give a short, direct final message: what's real and verified right now (with the evidence, not just a claim), and the single most important thing to check first if someone doubts the report — in the prior plan, that was always the thing worth checking first, and it was always where the real gap was.
