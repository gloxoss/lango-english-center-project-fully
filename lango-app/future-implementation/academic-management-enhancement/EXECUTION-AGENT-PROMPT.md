# Academic Management Enhancement — Execution Agent Prompt
# Give this ENTIRE file to the agent before asking it to do any work.
# Version: 2026-08-05 | Owner: Oussama Zaki (Zakio)

---

## 0. MANDATORY FIRST READS, IN THIS ORDER

1. `SCHOOLOS-AGENT-MASTER-PROMPT.md` (repo root) — full project identity, tech stack, API/UI conventions, design system, Docker workflow, permissions registry, agent discipline rules. Everything in that file applies here without exception; this document only adds mission-specific instructions on top of it.
2. `CLAUDE.md` (repo root) — project rules.
3. `future-implementation/academic-management-enhancement/ACADEMIC-MANAGEMENT-ENHANCEMENT.md` — the source requirements document. Read it in full before touching any section; every section you'll execute traces back to a specific paragraph in here.
4. `.ultraplan/PRD.md` — what's being built and why, in plain terms.
5. `.ultraplan/PLAN.md` — architecture overview, dependency graph, review notes. Read the dependency graph carefully: unlike a typical wiring task, these sections have REAL technical dependencies on each other, not just priority ordering.
6. `.ultraplan/sections/index.md` — the section manifest, batch order, and the "Collision-Risk Sections" list. Read this last, immediately before starting work, since it's the thing most likely to have changed if this prompt is reused across multiple sessions.

Do not start implementing anything until you've read all six.

---

## 1. MISSION

Execute sections **20 through 34** of `.ultraplan/sections/`, in the dependency order the index specifies (Batch 1 sequentially: 20→21→22→23; Batches 2–4 in parallel with each other once Batch 1 lands; Batch 5 last). Each section file is self-contained: Overview, Risk, Dependencies, TDD Test Stubs, and numbered `<task>` blocks with `<files>`, `<action>`, `<verify>`, and `<done>`.

This is real implementation work against a live, shared codebase — not a design exercise. Every task you complete must be typechecked, built, and verified against the real database and a real HTTP request before you consider it done. "The code looks right" is not a completion criterion anywhere in this mission.

---

## 2. THE ONE THING THAT MAKES THIS DIFFERENT FROM NORMAL WORK: CONCURRENT EDITING

A second agent session works in this exact repository throughout the day, independently of you, with no coordination channel between you. At various points this has meant 125–190+ files sitting uncommitted at once. This is a **known, standing condition**, not an occasional edge case — treat every file as potentially contested until you've checked it seconds ago.

**Before touching ANY file:**
```powershell
git status --short -- <exact file path>
```
If it shows modified (`M`) or untracked (`??`) and you did not create that dirty state yourself moments ago in this same session, **do not edit it directly**. Either:
- Hold that section/task and move to the next one that's currently safe, or
- If the file is something like `Schema.ts` where your change is a clean, independent addition (e.g., a new table appended after an existing one, nowhere near the other session's diff), use the **isolated git-blob commit technique**:
  ```powershell
  git show HEAD:<path> > /tmp/clean_copy
  # apply ONLY your own change to /tmp/clean_copy (not the working-tree file)
  git hash-object -w /tmp/clean_copy
  git update-index --cacheinfo 100644,<hash>,<path>   # full repo-root-relative path required
  git commit -m "..."   # working tree is untouched, their WIP survives on disk
  ```
  This stages "HEAD + your change" without ever writing to the working-tree file, so the other session's in-progress, uncommitted edits are never disturbed. This technique was used successfully multiple times in the session that produced this plan — trust it over waiting indefinitely, but never use it on a file where your change and their diff might actually overlap (read their `git diff` first to confirm).

**Never, under any circumstance:**
- Run `git checkout`, `git restore`, `git reset --hard`, or `git clean` on a file with uncommitted changes that aren't yours.
- Revert or overwrite the other session's in-progress work to "fix" a collision. If your work and theirs are incompatible, your job is to make your own change additive/backward-compatible (see the promotions-route precedent below), not to win the collision.

**Before staging any commit**, run `git diff --cached --stat` and confirm every file listed is one YOU intentionally changed. Accidentally co-committing the other session's staged-but-uncommitted files has happened before in this exact repo — it's the single most common mistake here.

**Precedent worth knowing**: a prior pass through this same repo shipped a new `.strict()` request schema for `/api/students/promotions` that would have silently broken the other session's in-flight UI edits (which still called the old shape). Rather than force the collision, the response was to accept both shapes at the route level and normalize internally — see `src/app/api/students/promotions/route.ts`'s `legacyBulkSchema`/`requestSchema` union for the actual pattern. When your section changes a contract another file might depend on, check who calls it before assuming you can just change the shape.

---

## 3. EXECUTION PROTOCOL, PER SECTION

For each section, in dependency order:

1. **Re-read the section file fresh** (`.ultraplan/sections/section-NN-*.md`) — don't rely on memory from earlier in your run, since the codebase may have shifted underneath you.
2. **Collision check every file in every task's `<files>` list.** If a section's Risk is flagged `HIGH COLLISION RISK` (sections 27, 29, 31), be extra conservative — check, and if genuinely blocked, move to a different section in the same or a later batch rather than waiting idle.
3. **Section 27 specifically**: run its `27-00` collision/duplication check task FIRST, before writing any code. If a real (non-mock) rooms directory + route already exists from the other session's work, mark the section done-by-other-session in your audit report and skip to section 28 — do not duplicate it.
4. **Every migration-adding task**: re-read `migrations/meta/_journal.json`'s true highest `idx` at execution time — do not trust any migration number written in the section files, since the other session creates migration files without journaling them.
5. Implement each `<task>` in order within the section. One task ≈ one commit's worth of change, matching its own `<files>` list — don't bundle multiple tasks into one commit.
6. Run that task's own `<verify>` step exactly as written.
7. After every task that touches TypeScript: `npx tsc --noEmit`, zero errors, before moving on.
8. After any schema change: `docker compose build migrate` AND `docker compose build app` (separate images, master prompt §Docker Workflow) — then `docker compose up -d` and re-run the migration, then verify the table/column exists via a real `psql` check, not just a clean build log.
9. After any route/UI change: rebuild the app image, restart the container, and hit the real endpoint (`curl` for API routes with an expected auth-gated status code; a real browser or `curl -i` for pages) — confirm it isn't 404/500/a stale cached response.
10. Stage and commit **only the files this task actually changed**, verified via `git diff --cached --stat` immediately before commit. Write a commit message that states what shipped and, if anything was deliberately deferred or scoped down, why — matching the commit-message style already established in this repo's git log for this plan's earlier sections (see `2b603e5`, `f37e77e`, `d204052` for reference).
11. **Immediately after each section completes (or is explicitly held/blocked), append an entry to the audit report** — see §4. Do not batch this up for the end; if your run is interrupted, the audit report must already reflect everything done so far.

If a section is blocked by collision for its entire allotted attempt, do not spin waiting on it. Move to the next available section per the batch order, note the block in the audit report with what specifically was dirty, and revisit it later in the same run if time allows.

---

## 4. THE AUDIT REPORT (the actual deliverable this prompt exists to produce)

Create and continuously update: `future-implementation/academic-management-enhancement/EXECUTION-AUDIT-REPORT.md`

This is not a log dump — it's written for Oussama to read once, at the end, and understand exactly what happened without re-deriving it from git history himself. Structure:

```markdown
# Academic Management Enhancement — Execution Audit Report
Run started: <timestamp>
Run completed / last updated: <timestamp>

## Overview Table (update after every section)
| # | Section | Status | Risk (planned → realized) | Commits | Tests run | Notes |
|---|---|---|---|---|---|---|
| 20 | ADR | done | green → green | <sha> | n/a (doc) | |
| 21 | Class Offerings | done | yellow → yellow | <sha>, <sha> | tsc✓ migrate✓ curl✓ | |
| 27 | Room Directory | skipped | yellow → n/a | none | n/a | already built by other session, see log |
| ... | | | | | | |

Status values: done / partial (some tasks done, some blocked) / blocked / skipped-already-done / skipped-out-of-time

## Per-Section Detail
### Section NN: <name>
- **What was actually built**: plain description, not a copy of the section file's tasks
- **Deviations from the plan**: anything you did differently than the section specified, and why (a section file is a plan, not a contract — if reality required a different call, make it and say so)
- **Tests performed and results**:
  - `tsc --noEmit`: pass/fail, paste any errors that occurred mid-work even if later fixed
  - `docker compose build migrate` / `app`: pass/fail
  - Real verification: exact command run (curl/psql/browser) and exact result observed — not "should work", show what you actually saw
  - Any of the section's own TDD Test Stubs you executed and their outcome
- **Collision incidents**: any file you held off on, for how long, and whether it eventually freed up
- **Commits**: sha + message for everything shipped in this section

## Cross-Cutting Findings
Anything discovered during execution that affects sections you haven't reached yet, or that the plan didn't anticipate (e.g., a table shape being different than Research assumed, a capability string collision, the other session having already built something adjacent).

## Final Summary
- Sections fully done: X / 15
- Sections partially done: X
- Sections blocked (with reason): X
- Sections skipped as already-built-elsewhere: X
- Total commits shipped this run
- Anything Oussama needs to decide or unblock before the remaining sections can proceed
```

Update the Overview Table row for a section the moment it finishes (or is held), even before writing that section's full Per-Section Detail — the table should always be an accurate live snapshot, not something reconstructed at the very end.

---

## 5. WHAT "TESTED" MEANS HERE (do not report something as done without this)

Per `.ultraplan/PRD.md` §8 and the master prompt's own discipline rules:
- `npx tsc --noEmit` alone is never sufficient — it has produced false "failed" signals in this exact repo before (grep-on-filtered-output returning exit 1 with zero real errors) and false confidence (compiles clean, runtime 404s because the container was serving a stale image). Always follow it with a real container rebuild and a real HTTP/DB check.
- Tenant isolation: for any new route, confirm a cross-tenant ID is rejected, not just that same-tenant IDs work.
- Idempotency-sensitive tasks (sections 21's backfill, 23's copy, 28's version publish, 31's commit, 32's rollback): actually run the operation twice with the same key/inputs and confirm no duplicate rows, not just read the code and conclude it should be idempotent.
- Migration backfills: query the actual row counts before and after, don't just check the migration "applied successfully" log line.

---

## 6. SCOPE DISCIPLINE

- Do not touch files outside a section's own `<files>` lists unless a task explicitly says to (e.g., nav registration tasks).
- Do not "improve" adjacent code you notice while working — note it in Cross-Cutting Findings instead.
- Do not skip a task because it seems redundant with something you find already built — verify it's actually equivalent first (same shape, same guarantees), and if so, note it as already-satisfied in the audit rather than silently doing nothing.
- If a task's instructions turn out to be wrong about current codebase state (e.g., a referenced file has moved, a table has different columns than described), trust the live codebase over the section file's text, make the sensible call, and document the discrepancy in Cross-Cutting Findings — don't block on it.
- Section 33 (nav regroup) and 34 (readiness + exports) are explicitly meant to run last — don't jump to them early even if they look easy, since 34 depends on almost everything else existing to have data to report on.

---

## 7. WHEN YOU'RE DONE (or time/scope runs out)

1. Finalize the audit report's Final Summary section.
2. Update `.ultraplan/sections/index.md`'s manifest table with actual outcomes (add a "Result" column if it doesn't have one) so the next person picking this up — human or agent — doesn't have to re-derive status from git log.
3. Update `.ultraplan/STATE.md`'s Session History with one line summarizing this execution run.
4. Give Oussama a short, direct final message: what shipped, what's blocked and why, and the single most important thing he should look at first (usually: the highest-risk section that actually got touched, e.g. section 28's timetable versions if it was attempted).
