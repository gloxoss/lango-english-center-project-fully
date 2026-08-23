# Section 04: Doc & Tracker Cleanup

## Overview
Three documents still claim the assessment module is "100% DEPLOYED" or leave the online-exam-addon decision as "not yet resolved", even though the decision was executed 2026-08-13 (Path A: retired) and the only remaining work is de-mocking the three UI pages. This section corrects those stale claims so the written record matches the live codebase.

## Risk: green — documentation-only edits; no code, no routes, no schema touched.

## Dependencies
- Depends on: none (but its "next steps" text should reflect sections 01–02 being done)
- Blocks: section-05
- Parallel batch: 2

## TDD Test Stubs
- Test: no file in this feature folder still claims the online-exam addon is live, deployed, or "not yet resolved".
- Test: `STATE.md` next-steps point at the M13 de-mock work, not a re-opened build/deploy of the retired addon.

## Tasks

<task type="auto" id="04-01">
  <name>Correct the stale "100% DEPLOYED" headline claims</name>
  <files>future-implementation/assessment-and-examination/EXECUTION-AUDIT-REPORT.md, future-implementation/assessment-and-examination/ASSESSMENT-AND-EXAMINATION-IMPLEMENTATION.md</files>
  <action>
    In `EXECUTION-AUDIT-REPORT.md`, replace the line-4 "100% EXECUTED, INTEGRATED, VERIFIED & DEPLOYED" status with an honest summary that names the two corrections already recorded below it (section 04 online-exam addon retired; section 05 UI "partially true"), rather than leaving a false headline above a correction note. In `ASSESSMENT-AND-EXAMINATION-IMPLEMENTATION.md`, rewrite the line-3 "COMPLETED & DEPLOYED TO PRODUCTION" status to reflect reality: homework + exam-master + shared ledger are live; the online-examinations addon was retired; the three UI pages are being de-mocked in M13. Do not touch the product-boundary or technical body — only the status line and any one-line scope annotation that must change to stay truthful.
  </action>
  <verify>Neither file's top status line claims full deployment of the retired addon; the online-exam-addon retirement is stated plainly at the top, not buried in a later correction.</verify>
  <done>Headline statuses are honest and self-contained.</done>
</task>

<task type="auto" id="04-02">
  <name>Refresh STATE.md next-steps</name>
  <files>future-implementation/assessment-and-examination/STATE.md</files>
  <action>
    Replace the "Next Steps (real, remaining)" list (lines 113–117). It currently still lists "Decide + execute the online-exam addon resolution" and "Build Online Examinations addon services" — both already resolved (retired) and out of scope. Rewrite the list to: (1) de-mock the online-exams page to the legacy `0025` MCQ routes, (2) de-mock the homework page (remove demo seed + fake student submit), (3) verify exam-master page, (4) final gates — i.e. mirror the M13 ultraplan. Keep the "Completed Steps" and the "online-exam addon decision" sections unchanged.
  </action>
  <verify>`STATE.md` no longer asks to "decide + execute" the already-executed retirement, and its next-steps match the M13 sections.</verify>
  <done>STATE.md next-steps reflect the actual remaining work.</done>
</task>

<task type="auto" id="04-03">
  <name>Update the master tracker to mark the online-exam addon retired</name>
  <files>MASTER_ROADMAP_AND_TRACKER.md</files>
  <action>
    In the Phase 3 "Core Teaching & Learning" row (and the Batch C "Teaching Core" row if it names online exams), append a one-line note that the richer "online-examinations" addon was retired 2026-08-13 and that the live online-exam feature is the legacy migration-`0025` MCQ flow, now being de-mocked in M13. Keep the existing "Online exams, Question Bank Admin UI" accomplishment text (it is true for the legacy flow) but ensure no reader infers the richer addon shipped.
  </action>
  <verify>Grep the tracker for the online-exam note; the retired-addon status is unambiguous and does not contradict the legacy-flow "done" claim.</verify>
  <done>The tracker distinguishes the retired addon from the live legacy MCQ flow.</done>
</task>
