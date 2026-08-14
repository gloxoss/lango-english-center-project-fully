# Section 31: Promotion wizard UI

## Overview
Replaces `promotions-view.tsx`'s blind bulk-move UI with a real wizard: source/target picker → fetch `/promotions/preview` (now capacity-aware from section-30) → a per-student decision table defaulted from the real grade-based recommendation → commit via the decisions-based POST already shipped this session. This is the single biggest loose end from this session's own prior work.

## Risk: [yellow, HIGH COLLISION RISK] - `promotions-view.tsx` has been actively dirty (edited by the other concurrent session, adding search/stat cards on the OLD bulk-move contract) for the majority of this session. This session already shipped a backward-compat bridge in the POST route specifically so that in-flight work keeps functioning - do not remove that bridge as part of this section until this new wizard is confirmed to be the only caller.

## Dependencies
- Depends on: section-30
- Blocks: none
- Parallel batch: 4

## TDD Test Stubs
- Test: default decisions match /promotions/preview's recommendation (promote if avg >= threshold, retain->repeat, defer->hold) unless the admin overrides a specific student
- Test: a capacity-exceeding set of 'promote'/'repeat' decisions shows a visible warning before commit, does not block commit (per doc: capacity is a warning, not a hard stop, since a school might legitimately overfill a section)
- Test: commit produces the exact same promotion_batches/promotion_decisions/studentPlacements rows as calling the API directly (already verified this session) - the wizard is a thin client of the existing contract

## Tasks

<task type="auto" id="31-01">
  <name>Rewrite promotions-view.tsx as a decision wizard</name>
  <files>src/features/students/ui/promotions-view.tsx</files>
  <action>
    Re-check git status first - if the other session's edits are still in flight, hold this task (per this section's Risk note) rather than force an isolated-blob rewrite over active UI work, unless it has been stalled long enough to reasonably conclude it's abandoned for the day. Step 1: source class-section + target session/section picker (reuse the existing picker UI). Step 2: fetch /promotions/preview?sourceSectionId=&targetOfferingId=, render one row per student with their real average and default decision (promote/repeat/graduate/transfer/withdraw/hold - default from the recommendation, overridable via a select per row), plus the capacity headroom banner from section-30's response. Step 3: a reason field for any non-promote decision (required for repeat/hold/withdraw per the doc). Commit calls POST /api/students/promotions with the new decisions-based shape and a generated idempotencyKey; on success, show the batch summary (counts per decision type) and a link to batch history (section-34's export, if built by then, otherwise just the raw GET /promotions list).
  </action>
  <verify>tsc --noEmit clean; full wizard round-trip against a real tenant with mixed grade averages, confirm the resulting studentPlacements/promotion_decisions rows match what the wizard displayed</verify>
  <done>No blind bulk-move path remains reachable from the UI; every commit goes through explicit per-student decisions</done>
</task>
