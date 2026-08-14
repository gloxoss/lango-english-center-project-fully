# Section 05: Reusable question bank — tags, difficulty, independent copy

## Overview
Implements the PRD's "Reusable exam question bank" Must Have. Adds `sectionLabel`/`difficulty`/`subjectId`/`cycle` directly to the existing exam-scoped `onlineExamQuestions`, and introduces a genuinely new, decoupled `questionBankItems` table (confirmed by research as a real gap, not a relabeling) with a copy-into-exam action that makes an independent row — never a live-linked reference — per the discovery decision.

## Risk: yellow - new decoupled table plus a transactional copy operation
The per-question field additions are low risk. The bank-to-exam copy operation is the real complexity: it must correctly duplicate a question and all of its options into a new, fully independent `onlineExamQuestions`/`onlineExamQuestionOptions` row pair, validated against the same MCQ-options-need-a-correct-answer rule the existing exam-question POST already enforces.

## Dependencies
- **Depends on:** section-01 (schema foundation)
- **Blocks:** none
- **Parallel batch:** 2

## TDD Test Stubs
- Test: Creating a bank question with `difficulty: 'difficile'` and a real `subjectId` persists and is filterable by both fields.
- Test: Copying a bank question into a real exam creates a new `onlineExamQuestions` row with its own new `onlineExamQuestionOptions` rows — no FK back to the bank item.
- Test: Editing the original bank question after a copy has been made does not change the already-copied exam question (independent-copy model, verified as intended behavior, not a bug).
- Test: Copying into an exam belonging to a different tenant is rejected with a reference error.
- Test: An exam question's `sectionLabel` visually groups questions in the existing per-exam question view.

## Tasks

<task type="auto" id="05-01">
  <name>Add section/difficulty/subject/cycle to exam question routes</name>
  <files>src/app/api/academics/online-exams/[examId]/questions/route.ts, src/app/api/academics/online-exams/[examId]/questions/[questionId]/route.ts</files>
  <action>
    Read both existing files. Extend the POST (create) and PATCH (update) Zod `.strict()` schemas to accept optional `sectionLabel` (string), `difficulty` (`facile|moyen|difficile`), `subjectId` (uuid, validated against the tenant's `subjects` table), and `cycle` (`maternelle|primaire|college|lycee`). Include all four fields in GET responses alongside the existing question/option shape. No change to the existing MCQ-options-require-a-correct-answer validation.
  </action>
  <verify>POST a question with all 4 new fields returns 201 with them set; GET on the exam's questions list shows them; PATCH updates them independently of `questionText`/`marks`.</verify>
  <done>Exam questions support real section/difficulty/subject/cycle tagging end to end.</done>
</task>

<task type="auto" id="05-02">
  <name>Build question bank CRUD route</name>
  <files>src/app/api/academics/question-bank/route.ts</files>
  <action>
    New file. GET, cap `grading.read`: tenant-scoped list of `questionBankItems` with nested `options[]`, supporting `?subjectId=`/`?cycle=`/`?difficulty=` filters plus this app's existing `parsePagination` convention (same pattern as every other list route). POST, cap `grading.manage`, role `school_admin|teacher`: Zod `.strict()` schema for `questionText`, `marks`, optional `subjectId`/`cycle`/`difficulty`/`sectionLabel`, and `options: {optionText, isCorrect}[]` — validate at least one option has `isCorrect: true` when options are provided (mirror the existing exam-question POST's validation exactly). Insert the bank item + its options transactionally, `createdById` from context. DELETE, cap `grading.manage`: removes a bank item and its options (cascade) unconditionally — safe to allow freely since copies made via task 05-03 are fully independent rows with no reference back to the bank item, so deleting the original can never affect an exam that already used it.
  </action>
  <verify>POST a bank question with 4 options (1 correct) returns 201 with a real ID. GET with `?subjectId=X&difficulty=difficile` returns only matching real items. POST with zero correct options is rejected. DELETE on an item already copied into a real exam succeeds, and the exam's copy is confirmed unaffected afterward.</verify>
  <done>A real, tenant-scoped, filterable question bank exists independent of any specific exam.</done>
</task>

<task type="auto" id="05-03">
  <name>Build copy-bank-item-into-exam endpoint</name>
  <files>src/app/api/academics/question-bank/[id]/copy-into-exam/route.ts</files>
  <action>
    New file. POST handler, cap `grading.manage`, body `{onlineExamId}` via Zod `.strict()`. Validate both the bank item and the target exam belong to the tenant. Inside a `db.transaction`: insert a new `onlineExamQuestions` row copying `questionText`/`marks`/`sectionLabel`/`difficulty`/`subjectId`/`cycle` from the bank item (new independent ID, `onlineExamId` set to the target), then insert new `onlineExamQuestionOptions` rows copying the bank item's options (new independent IDs, pointing at the new question). No FK or reference back to `questionBankItems` is stored anywhere on the new rows.
  </action>
  <verify>Copy a real bank item into a real exam; confirm via psql the new onlineExamQuestions/Options rows have entirely new IDs and no column referencing the original bank item. Editing the bank item afterward and re-fetching the exam's questions shows the exam's copy unchanged.</verify>
  <done>A bank question can be copied into any tenant-owned exam as a real, fully independent copy.</done>
</task>

<task type="auto" id="05-04">
  <name>Build Banque de questions UI tab and wire tagging fields</name>
  <files>src/features/academics/ui/question-bank-view.tsx</files>
  <action>
    Read the existing file in full (per its own code comment, it's currently wired to the real per-exam-question shape only, explicitly noting no bank exists). Add a real "Banque" tab: list/filter bank items by subject/cycle/difficulty (task 05-02's GET), a create form for new bank items with options, a delete action per item (calls task 05-02's DELETE, no confirmation needed beyond the app's existing delete-confirmation pattern), and a "Copier dans un examen" action per item that prompts for a target exam and calls task 05-03. Add `sectionLabel`/`difficulty`/`subjectId`/`cycle` fields to the existing per-exam question create/edit form, wired to task 05-01. Handle the empty-bank case honestly ("Aucune question dans la banque" with a clear "Ajouter une question" action, not a blank gap). Remove the file's ponytail comment about the missing bank once this task lands, since it's no longer accurate.
  </action>
  <verify>In the browser: create a bank question, filter the bank list by its subject and difficulty, copy it into a real exam, confirm it appears in that exam's question list with an independent identity (editing the bank original doesn't change it).</verify>
  <done>The Banque de questions page offers a real, filterable, reusable question bank with a real copy-into-exam action, plus real tagging on per-exam questions.</done>
</task>
