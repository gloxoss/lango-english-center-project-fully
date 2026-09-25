# UltraPlan Summary — SchoolOS post-audit fixes

## What this plan does
Takes SchoolOS from ~72/100 to releasable: make tests trustworthy (own test DB, real second-agent verification), close the last real integrity gaps (timetable double-booking, graduates keeping beds and bus seats, an unguarded legacy grade route), restore the translation lock, then land 27 branches and 620 uncommitted changes safely.

## Plan structure
15 sections, 29 tasks, 4 batches. Details: `sections/index.md`. Rules every agent follows: `PLAN.md` (top).

## Start now (Batch 1, in parallel)
- 01 Test DB isolation — any careful agent
- 02 Verification sweep — 2–3 agents who did not write the fixes
- 03 Translation lock regression — cheap agent (after codex-4 releases its files)
- 05 Alumni transition cleanup — backend agent
- 06 Retire legacy grade route — any agent (needs D4)
- 07 Public forms — any agent (measure first; build only if D7 says so)
- 11 UX cleanup — cheap agent

## Owner decisions needed (see PLAN.md table)
D1 merge strategy · D2 dashboards · D3 accountant-signed payroll figures · D4 retire legacy route · D5 delete leftover test tenant · D6 menu placement · D7 captcha now or later

## Risk areas
- [red] 04 timetable constraint on live data (read-only overlap check first)
- [red] 09 payroll figures (nothing without accountant sign-off)
- [red] 13 merging 27 branches over 620 uncommitted changes (one agent, owner present)

## How to hand it to an agent
Give it `AGENT-PROMPT.md` with the section number filled in.
