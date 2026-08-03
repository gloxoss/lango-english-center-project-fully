# UltraPlan Summary — Data-Wiring Remediation

## What We're Building
Every SchoolOS page currently showing hardcoded/mock data — or a save button wired to nothing — gets connected to real, tenant-scoped, secure backend logic. 1 broken page fixed, 9 pages get new backends built, 19 pages get wired to existing-but-unused APIs, 3 pages get their fake actions made real.

## Key Findings (from the codebase audit, not guessed)
- 32 pages need work; ~7 confirmed already real; ~45 unverified (presumed OK, get a lightweight check in Section 19)
- Most "mock" pages already have a matching backend sitting unused — this is overwhelmingly a wiring problem, not a missing-backend problem
- 6 sections need genuinely new backend design (exams, rooms, tenant entitlements, report cards, dunning reminders, fee allocation)

## Tech Stack
No changes — Next.js 16, Drizzle, PostgreSQL, Better Auth, Tailwind v4, same route pattern used ~80 times already in this codebase.

## Risk Areas
- [red] Section 01 (Homework Submissions) — currently fails to compile, fix first
- [yellow] Section 04 (Entitlements Catalog) — must not leak cross-tenant entitlement data
- [yellow] Section 07 (Header Search) — must respect each result type's existing read permission, not bypass it
- [yellow] Section 15 (Financial Reports) — must derive from real ledger data, not a second parallel calculation that could drift

## Plan Structure
- 19 sections, 61 tasks, 3 priority batches
- All sections file-independent — safe to run in any order or fully parallel
- 100% traceability: every audit finding maps to a task, no invented scope

## Execution Guide
1. Before running any section: `git status` its target files — hold if your other agent session has them open.
2. Batch 1 first (newest pages, per your stated priority): sections 01-06.
3. Say: "Read .ultraplan/sections/index.md and execute section 01"
4. After each section: `tsc --noEmit`, then the section's own Verify steps.
5. Batches 2 and 3 (sections 07-19) can follow in any order once 1 is done, or run in parallel with it on file-independent sections.

## How to Update This Plan
Run: /ultraplan update
