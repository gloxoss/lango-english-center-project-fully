# Section 13: Land the 27 branches and commit

## Overview
`student-directory-hardening` has 620 uncommitted changes (512 modified, 74 new, 34 deleted), is 6 ahead / 3 behind origin, 52 ahead of main. 26 `audit/*` branches (3–8 commits, 9–115 files each) plus `release/REL-INTEGRATE-01` (59 commits, 703 files, stale) are unmerged. Nothing reaches production until this is done.

## Risk: [red] Largest risk in the plan. One agent only, owner present, gate D1.

## Dependencies
- Depends on: 01, 02, 03, 04, 05, D1 · Blocks: 14 · Batch 4 · Hub item: `task:up-13-merge` (claim the whole repo; announce with hub say; all other agents pause edits)

## Tasks

<task type="auto" id="13-01">
  <name>Checkpoint the working tree</name>
  <files>all tracked changes (never cookies.txt, .next-*, artifacts/, *.rar, personal folders)</files>
  <action>
    Owner approves a checkpoint commit. Stage explicitly (git add lango-app/src lango-app/locales lango-app/migrations lango-app/scripts lango-app/docs .agent-hub/CHANGELOG.md … — review git status first; never git add -A blindly). Commit "checkpoint: audit fixes 2026-09-25" with the attribution lines from the session. Do not push yet.
  </action>
  <verify>git status shows only intentionally-excluded files; full gates pass on the commit (tsc, vitest on schoolos_audit, check:isolation, check:ui, check:i18n, check:i18n:hardcoded).</verify>
  <done>A clean, green base commit.</done>
</task>

<task type="auto" id="13-02">
  <name>Merge audit branches one at a time, smallest first</name>
  <files>per branch</files>
  <action>
    Order by file count ascending. For each: git merge --no-ff <branch>. On conflict: locales (take both sides' keys, re-run the duplicate/nested namespace scan), sidebar.tsx (keep all entries, re-check gating), migrations (renumber clashes and fix _journal.json). After EACH merge: run all gates; if red, fix or abort that merge (git merge --abort) and report — never leave a half-merged tree.
    Skip release/REL-INTEGRATE-01 unless D1 says to use it as the base.
  </action>
  <verify>After each merge the hub gets one line: branch, conflicts resolved, gate results.</verify>
  <done>All audit branches merged, gates green after each.</done>
</task>

<task type="auto" id="13-03">
  <name>Push (only with explicit owner approval)</name>
  <files>none</files>
  <action>git push origin student-directory-hardening. Open a PR to main with the gate results in the description. Do not deploy.</action>
  <verify>PR link posted in the hub.</verify>
  <done>Work is on the remote and reviewable.</done>
</task>
