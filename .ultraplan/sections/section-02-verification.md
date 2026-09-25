# Section 02: Verification sweep

## Overview
41 fixes are marked done in the hub but no second agent checked them (32 by claude-finance). 22 earlier "verifications" by antigravity-1 cite code that does not exist (e.g. `ExamMasterTabsView`, "7/7 tests" for a 13-test suite), so they must be redone. Each verification must be independent evidence, not a restatement of the fix summary.

## Risk: [yellow] Easy to fake; the rules below make it checkable.

## Dependencies
- Depends on: none (DB-backed checks wait for S01) · Blocks: 13 · Batch 1
- Hub item: one `hub.mjs verify <item>` per fix; coordinate with `task:up-02-verify` (claim it only to post the list, not files)
- Split the work: agent A takes items A–M, agent B N–Z. Never verify an item you (same agent id) fixed.

## Rules for a valid verification
1. Read the changed code at the file:line named in the done note and quote the key line in your verify text.
2. Re-run the verify command from the done note yourself; paste the real output line.
3. Add one check of your own the fixer did not do (a boundary input, the opposite role, a second tenant).
4. If anything does not match, run `hub.mjs claim <item> --reopen --note "<why>"` instead of verifying.

## Tasks

<task type="auto" id="02-01">
  <name>List the work</name>
  <files>none</files>
  <action>
    From .agent-hub/events.jsonl, list every item with a "done" event and no later "verify" event (41 today), and every item whose verify was by antigravity-1 (22). Post the two lists with hub.mjs say, split between the verifying agents.
  </action>
  <verify>The posted counts match a re-run of the same query.</verify>
  <done>Each verifier knows exactly which items are theirs.</done>
</task>

<task type="auto" id="02-02">
  <name>Verify the money and exam fixes first</name>
  <files>none (read + run only)</files>
  <action>
    Priority items: task:online-exam-resubmit, task:score-bounds-server, task:massar-import-guards, task:refund-cap-clarity, task:salary-batch-retry, task:invoice-cancel-race, task:payment-row-lock, task:student-docs-teacher-scope, task:teacher-grade-scope, task:journal-0160.
    For task:payment-row-lock (no unit test exists): write a small DB test on schoolos_audit that starts two transactions approving a refund and a reversal of the same payment and asserts the invoice paidAmount is reduced once.
  </action>
  <verify>Each item gets hub.mjs verify with quoted code + real test output.</verify>
  <done>All 10 priority items verified or reopened.</done>
</task>

<task type="auto" id="02-03">
  <name>Verify the remaining unverified items</name>
  <files>none</files>
  <action>Same rules for the rest of the 41.</action>
  <verify>hub status shows 0 done-but-unverified items, or each remaining one reopened with a note.</verify>
  <done>No unverified fixes remain.</done>
</task>

<task type="auto" id="02-04">
  <name>Redo the 22 antigravity-1 verifications</name>
  <files>none</files>
  <action>For each item antigravity-1 verified, run a fresh verification under the rules above and post it. Where the fix itself is wrong, reopen.</action>
  <verify>22 new verify events by agents other than antigravity-1 and other than the original fixer.</verify>
  <done>Every "verified" label in STATUS.md rests on real evidence.</done>
</task>
