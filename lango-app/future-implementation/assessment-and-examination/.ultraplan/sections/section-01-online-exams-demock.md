# Section 01: De-Mock Online Exams

## Overview
The online-exams page (`online-exams/page.client.tsx`) is a 100% hardcoded mock: it advertises the retired rich addon ("248 Questions", "12 Session Actives", "18 En Épreuve", "92% auto-correction", a live-monitor tab, a demo runner with `sampleQuestions`, and a fake "18.0 / 20" submit). None of it calls an API. Rewrite it to drive the live legacy MCQ flow (`/api/academics/online-exams/*`), which is the one true implementation that remains after the rich addon was retired.

## Risk: yellow — must match the legacy route shapes exactly; page currently misleads real users.

## Dependencies
- Depends on: none
- Blocks: section-05
- Parallel batch: 1

## TDD Test Stubs
- Test: loading the page lists real exams from `GET /api/academics/online-exams`, not hardcoded rows.
- Test: creating an exam + a question + options persists and reappears on reload.
- Test: submitting an attempt returns the real server score, not a constant.

## Tasks

<task type="auto" id="01-01">
  <name>Read the legacy online-exam route shapes before writing any UI</name>
  <files>src/app/api/academics/online-exams/route.ts, src/app/api/academics/online-exams/[examId]/questions/route.ts, src/app/api/academics/online-exams/[examId]/questions/[questionId]/route.ts, src/app/api/academics/online-exams/submit/route.ts</files>
  <action>
    Read all four route files in full and record the exact request/response shapes: field names for an exam, a question, an option, and the submit payload + response (including how a student is identified on submit — never assume a client-supplied studentId is honored). Note which roles each route requires. These shapes are the contract for the rewrite; do not invent fields the routes don't return.
  </action>
  <verify>Every field the new UI renders is backed by a field these routes actually return; the submit payload matches the route's accepted body exactly.</verify>
  <done>The exact legacy route contract is documented in the working notes before any UI code is written.</done>
</task>

<task type="auto" id="01-02">
  <name>Rewrite the online-exams page to real list/create/question-authoring flows</name>
  <files>src/app/[locale]/(dashboard)/dashboard/academics/assessment/online-exams/page.client.tsx</files>
  <action>
    Replace the entire mock. Build three real states driven by `fetch()`: (1) a list of exams from `GET /api/academics/online-exams` with an empty state when none; (2) a create-exam form posting to the same route; (3) per-exam question/option authoring using `GET/POST [examId]/questions` and `[questionId]`. Delete every hardcoded count, sample question, candidate name, and the fake "anti-cheat / live monitor / 92% auto-correction" badges. Match this codebase's existing fetch/loading/error patterns (e.g. the workforce or reporting workspaces).
  </action>
  <verify>Load against a real tenant: create an exam, add a multiple-choice question with options, reload, confirm both persist from the database.</verify>
  <done>No hardcoded data remains; exam + question authoring round-trips through the real routes.</done>
</task>

<task type="auto" id="01-03">
  <name>Wire a real attempt submit + score display</name>
  <files>src/app/[locale]/(dashboard)/dashboard/academics/assessment/online-exams/page.client.tsx</files>
  <action>
    Add a take-exam view that presents a selected exam's questions (fetched from the real routes) and posts the answers to `POST /api/academics/online-exams/submit` using the route's exact payload. Render the real returned score/status. Remove the demo runner (`sampleQuestions`, `answersMap`, hardcoded timer, "Refaire un Test Démo"). If the submit route derives the student from the session, do not prompt for a studentId.
  </action>
  <verify>Submit a real attempt and confirm the displayed score equals the server's computed score, verified against the database row.</verify>
  <done>The page shows only the real score from the submit route; the demo runner is gone.</done>
</task>
