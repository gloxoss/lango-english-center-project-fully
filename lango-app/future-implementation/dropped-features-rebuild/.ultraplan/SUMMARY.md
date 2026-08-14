# UltraPlan Summary — Dropped-Features Rebuild

## What We're Building
Six pages across Élèves & Profils and Matières & Classes that had features removed earlier this session for being fake (fabricated data, dead buttons) get those features rebuilt for real: household/guardian info (co-tutors, pickup authorization, emergency priority, comm-prefs, combined family payment history), class setup (cycle, enrollment cap, homeroom teacher, home room), schedule teacher/room views, a reusable cross-exam question bank, admission interview/notes/checklist tracking, and real transfer KPIs.

## Key Features
- Real co-tutor visibility and household payment history, computed from existing guardian-student links — no new household table
- Real class cycle, enrollment capacity, homeroom teacher (reusing the existing `classTeachers` table), and home-base room (reusing the existing `rooms` table)
- Teacher-view and room-view of the real schedule, no schema change
- A genuinely new, reusable, cross-exam question bank with an independent-copy model (editing the bank original never retroactively changes an exam that already used it)
- Real, single-interview admission tracking, a staff-only comment thread, and a fixed review checklist
- Real transfer-activity KPIs (transfers this month, active students per branch) on top of the already-real transfer feature

## Tech Stack
No new stack — pure extension of the existing Next.js 15 App Router / TypeScript / Drizzle ORM / PostgreSQL / Better Auth stack already governing this app. One combined migration (`0058`). No new permission/capability strings anywhere in the plan.

## Risk Areas
- [yellow] section-01 (schema foundation) — many small DDL changes across 6 tables in one migration; mitigated by live psql verification before any dependent section starts
- [yellow] section-02 (households) — cross-student payment aggregation is the one real piece of business logic; fixed during review to use batched queries, not a per-student loop
- [yellow] section-03 (classes) — homeroom-teacher uniqueness needs an application-level transactional guard since the DB constraint alone doesn't cover the common case yet
- [yellow] section-05 (question bank) — new decoupled table + a transactional copy-into-exam operation
- [green] section-04, 06, 07, 08 — straightforward additions over already-real data, low complexity

## Plan Structure
- 8 sections, 29 tasks
- 3 parallel batches (01/04/07 → 02/03/05/06 → 08)
- Critical path: section-01 (schema) must complete and be Docker-verified before batch 2 starts

## How to Execute This Plan
1. Open any AI coding tool (Claude Code, Cursor, etc.) in this repo.
2. Point it at `future-implementation/dropped-features-rebuild/.ultraplan/` (not the project-root `.ultraplan/`, which belongs to a different, already-completed plan from a concurrent session).
3. Say: "Read future-implementation/dropped-features-rebuild/.ultraplan/sections/index.md and execute section 1."
4. After section 1 (schema foundation) completes and is Docker-verified, sections 2, 3, 5, 6 can run in parallel — say "execute sections 2, 3, 5, 6" or run them one at a time.
5. Sections 4 and 7 have no dependency on section 1 and can be executed any time, including in parallel with section 1 itself.
6. Run section 8 (final verification) last, after everything else.
7. Before touching any existing file, run `git status --short` on it first — this repo has an actively-committing concurrent session, and this exact discipline is what prevented (and once, when skipped, caused) a real file-collision incident earlier this session. See PLAN.md's "Execution Notes" for the full cross-cutting conventions every task should follow.

## How to Update This Plan
Run: `/ultraplan update` from within `future-implementation/dropped-features-rebuild/`
Describe what changed, and only affected sections will be regenerated.
