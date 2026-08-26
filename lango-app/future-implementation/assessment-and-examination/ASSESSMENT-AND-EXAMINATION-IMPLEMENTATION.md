# Assessment and Examination Implementation Plan

Status: PARTIALLY DEPLOYED — Homework, Exam Master, and the shared assessment ledger are live and wired (migration 0060). The Online Examinations addon was retired 2026-08-13 (dead code removed, see EXECUTION-AUDIT-REPORT.md decision record); the online-exams and homework UI pages were de-mocked in M13 (2026-08-14).
Scope: Homework, Evaluation Reports, Exam Master, Exam Schedule, Marks, Question Bank, Online Exams, and Exam Results  
Optional addon ID: `online-examinations`

## 1. Product boundary

This initiative has one academic model but two commercial surfaces:

- **Core Academics:** homework, submission/review, evaluation reports, assessment definitions, exam terms, exam halls, room/seat distribution, exam setup, marksheet templates, exam scheduling, mark entry, grade ranges, positions/ranks, result publication, report cards, and transcripts.
- **Online Examinations addon:** question bank authoring/import, question groups/blueprints, secure timed delivery, autosave/recovery, objective auto-grading, manual grading queue, attempt monitoring, integrity signals, online result analysis, and optional Safe Exam Browser integration.

The addon must not introduce a second gradebook. Homework, paper exams, and online attempts all post moderated outcomes into the same core assessment/result ledger.

## 2. Current SchoolOS reality

SchoolOS is partially implemented, not empty:

- `assignments` and `assignmentSubmissions` store homework metadata, submission status, score, and feedback.
- Assignment APIs create, submit, and grade records.
- The current Homework UI is student-oriented only and sends a dummy JSON `fileExt` with `studentId: current-student`; it does not upload real bytes.
- `assessmentPlans`, criteria, grading scales, assessments, results, and result details support marks and report cards against real `classSubjects`.
- A Moroccan grade engine and tests already exist.
- Grade-entry, class-results, and report-card pages already exist.
- `onlineExams`, inline exam questions/options, attempts, and answers provide a very small MCQ auto-scoring backend.
- There are no exam-term, hall, seat distribution, schedule, question-bank, question-group, marksheet-template, moderation, result-publication, or dedicated online-exam pages.

## 3. Confirmed defects to fix before expansion

### Homework/API defects

- Assignment GET returns all tenant assignments without role/audience scoping.
- Teacher creation validates tenant ownership of `classSubjectId`, but not that the teacher is assigned to it.
- Submission accepts caller-supplied `studentId` and metadata without actual file storage.
- Submission does not prove the student belongs to the assignment audience.
- A repeated submission overwrites the same row without attempt/version history.
- Grading verifies tenant ownership but not teacher ownership of the assignment.
- No draft/published/closed lifecycle, availability date, late policy, rubric, attachment, extension, exemption, return/resubmit, or notification workflow.

### Online-exam defects

- Exam GET is tenant-wide and lacks role/self scoping.
- Creation does not validate class-subject ownership or teacher assignment.
- The submit endpoint has no student-role restriction or enrollment/audience validation.
- It checks only `endsAt`, not `startsAt`, duration, attempt state, or server-issued attempt token.
- `startedAt` is set at final submission, so elapsed time is not measured.
- Submitted option IDs are not validated as belonging to the submitted question.
- Questions need only belong to the exam; submitted questions/options can create inconsistent answers.
- Upsert plus append can duplicate answer rows; there is no unique attempt/question constraint.
- Scoring and writes are not one transaction.
- Correct answers are stored beside normal option data with no authoring/delivery projection separation.
- Only single-choice MCQ is supported; no question bank, versioning, randomization, autosave, manual grading, accommodations, attempt recovery, publication, or result moderation.

These are security and integrity blockers. Do not expose the current online endpoints as a production exam feature before Phase 1.

## 4. Target domain model

### Shared core assessment ledger

- `assessmentDefinitions`: tenant, session/class offering, class subject, term, type (`homework`, `quiz`, `paper_exam`, `online_exam`, `project`, `oral`, `practical`), title, maximum, coefficient, dates, lifecycle, creator.
- `assessmentAudience`: definition plus class offering/section, selected students, group, or accommodation cohort.
- `assessmentOutcomes`: definition, student, raw score, maximum snapshot, normalized score, grade, outcome status, source type/reference, marker, moderation/publication state, timestamps.
- `assessmentOutcomeRevisions`: immutable before/after, reason, actor and approval.
- Existing `assessments`/`assessmentResults` should be migrated or evolved into this contract rather than duplicated blindly.

### Homework

- Extend/rework assignments with open/due/close times, instructions, rubric, late policy, attempt limit, group/individual mode, status and publication.
- `assignmentAttempts`: immutable attempt number, submitted time, text response, declaration, status and lateness snapshot.
- `assignmentAttemptFiles`: stable reference to Attachments Book asset version when enabled, otherwise a core private submission-blob record.
- `assignmentExtensions`, `assignmentRubrics`, `rubricCriteria`, `rubricRatings`, and `assignmentFeedbackFiles`.

### Exam Master

- `examTerms`: session year, name/code, date window, lifecycle and result-publication policy.
- `examComponents`: term, class subject, assessment definition, written/practical/oral type, maximum, coefficient, pass mark.
- `examHalls`: tenant/branch, room reference or label, capacity, accessibility, active state.
- `examSeats`: term/session occurrence, student, hall, seat/desk number, candidate number and allocation status.
- `examSchedules`: component, class offering/section, start/end, hall requirement, supervisor requirement, status/version.
- `examSupervisors`: schedule, staff member, role and attendance.
- `marksheetTemplates`: columns, totals, rounding, grade/rank visibility, signatures, publication layout; immutable published versions.
- `resultPublications`: term/audience, state, published/withdrawn times, actor and message.

### Online-examination addon

- `questionBanks` and nested `questionCategories`: tenant, owner/scope and permissions.
- `questionItems`: stable identity, subject, type, difficulty, outcome/tags, status and currentVersionId.
- `questionItemVersions`: immutable authoring content, answer/scoring model, explanation, accessibility metadata, author/reviewer, checksum.
- `questionOptions` and type-specific validated payloads.
- `questionGroups`/`examBlueprints`: selection rules by category, difficulty, learning outcome and count/marks.
- `onlineExamForms`: generated immutable form/version and ordered question-version references.
- `onlineExamPolicies`: attempt count, navigation, shuffle, feedback release, negative marking, password, network grace, integrity controls.
- `onlineExamAccommodations`: student-specific extra time, alternate window, attempt/reset approval and accessibility settings.
- `onlineExamAttempts`: server-started state machine, form snapshot, deadlines, heartbeat, version and finalization reason.
- `onlineExamResponses`: unique attempt/question-version, normalized answer, save version/timestamp and awarded score.
- `onlineExamEvents`: bounded append-only audit events such as start, autosave, reconnect, focus loss, submit and admin action.
- `manualGradingTasks`: response, marker, rubric, blind-marking state, moderation.

Never store correct-answer payloads in the student delivery response. Generate separate authoring, delivery, and grading projections.

## 5. Pages and workflows

### Homework

- **Homework workspace:** class -> section -> subject filters, lifecycle tabs, counts, teacher ownership and bulk actions.
- **Create/edit homework:** audience, instructions, files, rubric, availability/due/close dates, late policy, attempts, notifications, preview and publish.
- **Homework detail:** roster matrix with not submitted/draft/submitted/late/returned/graded/exempt.
- **Submission review:** file/text preview, plagiarism/integrity placeholder, rubric/score, feedback, return/resubmit, next/previous student.
- **Student homework:** eligible work only, actual uploads, autosaved text, attempt history, receipt and returned feedback.
- **Evaluation Report:** completion, punctuality, score distribution, criteria mastery, missing work and student drill-down. Export respects permissions.

### Exam Master

- **Exam Terms:** setup, status, date boundaries and copy-from-prior-term preview.
- **Exam Halls:** capacity, accessibility, availability and usage.
- **Distribution:** candidate numbering plus capacity-aware room/seat allocation; deterministic regeneration with lock/freeze.
- **Exam Setup:** subject components, maxima, coefficients, pass rules, marksheet template and result policy.
- **Marksheet Templates:** versioned table/print layouts; presentation only, never grading logic.
- **Exam Schedule list/add:** conflict-aware scheduling for student cohorts, teachers/supervisors and halls; draft/publish versions.
- **Mark Entries:** spreadsheet-style roster, absence/exemption/withheld codes, validation, autosave, submit and moderation lock.
- **Grade Ranges:** effective-dated, non-overlapping ranges and rounding policy.
- **Generate Position:** explicit ranking policy, ties, exclusions, privacy, preview and publish. Ranking is optional and disabled by default.
- **Results:** validation dashboard, publish/withdraw, student/parent release, class analysis and immutable publication snapshot.

### Online Examinations

- **Online Exam list/create:** setup wizard, blueprint/manual selection, form preview, audience, window, duration, attempts, accommodations and release policy.
- **Question Bank:** category tree, filters, author/reviewer status, version history, duplicate/retire, import/export.
- **Question Group/Blueprint:** reusable randomized selection rules with availability simulation.
- **Position Generate:** use the shared ranking service; do not duplicate ranking logic under Online Exam.
- **Exam Result:** item analysis, attempts, grading queue, moderation, release and export.
- **Student runner:** preflight, instructions/consent, server clock, accessible navigation, flag question, autosave, reconnect, submit confirmation and receipt.
- **Live monitor:** started/online/disconnected/submitted states, remaining server time, incident annotations and controlled extra-time/reset actions.

## 6. Question types

V1:

- single choice, multiple response, true/false;
- short text and numeric with tolerance/unit rules;
- essay/manual grade;
- matching and ordering;
- file response only when explicitly allowed.

Later:

- cloze, hotspot, audio response, formula/parameterized questions, code runner and QTI portable custom interactions.

Every type defines versioned validation, student rendering, response normalization, deterministic scoring, manual override and accessible alternatives. Rich text is sanitized; math uses a maintained renderer such as KaTeX/MathLive after license/security review.

## 7. Attempt state machine

`not_started -> in_progress -> submitted -> auto_graded/manual_grading -> moderated -> released`

Exceptional terminal/repair states: `expired`, `abandoned`, `invalidated`, `reset`, `withdrawn`.

- Only the server starts attempts and calculates `deadline = min(examClose, startedAt + accommodatedDuration)`.
- Autosaves use optimistic versioning/idempotency and a unique attempt/question constraint.
- The client displays the server deadline; it is not authoritative for time.
- Finalization is transactional and idempotent, locks responses, computes objective scores from version snapshots, and creates manual tasks.
- A background reconciler expires stale attempts after the grace policy.
- Admin changes append events and require reason/permission.

## 8. Scheduling, marks and results invariants

- Exam terms, definitions and schedules are session-scoped.
- Schedule publishing blocks overlapping cohort, hall, supervisor, or shared-student conflicts.
- Hall allocation never exceeds usable capacity and reserves accessible seats.
- Marks cannot exceed snapshot maximum; special codes are modeled, not encoded as magic numbers.
- Grade ranges cannot overlap or leave unintended gaps.
- Calculation uses one versioned deterministic service with explicit rounding order.
- Mark entry moves through `draft -> submitted -> moderated -> locked -> published`.
- Published results are immutable snapshots; corrections create revisions and, when necessary, a replacement publication.
- Rankings always record the population, included components, tie method and calculation version.

## 9. Security, privacy and integrity

- Teachers access only assigned class subjects; students only active audiences; parents only linked children.
- Validate every question, option, attempt, asset and assessment relationship inside the tenant and exam snapshot.
- CSRF/session protection, rate limiting, idempotency, audit, encrypted secrets and private file access are mandatory.
- Sanitize rich text and isolate untrusted previews; never execute question-authored script.
- Logs must avoid answer keys and unnecessary student response content.
- Encrypt particularly sensitive exports/backups and define retention.
- Browser focus/fullscreen events are weak signals, not proof of cheating.
- Webcam/AI proctoring is excluded from v1. It needs a separate legal, bias, consent, accessibility and data-protection review.
- Safe Exam Browser is optional defense-in-depth, never claimed to make an exam cheat-proof.

## 10. Implementation phases

### Phase 0 - domain ADR and migration map

- Choose how existing assignments/assessments/results evolve into the shared ledger.
- Map every grade-entry/report-card consumer and deprecated `courseId` fallback.
- Define session scoping, rounding, special marks, moderation, publication and retention policies.
- Build two-tenant fixtures and golden calculation cases.

### Phase 1 - close current integrity holes

- Scope assignment/online-exam reads by role, assignment and enrollment.
- Enforce teacher assignment and student audience on every write.
- Replace dummy homework submission with actual authorized private upload and versioned attempts.
- Make online start/save/submit transactional, server-timed and idempotent; validate question/option relationships and unique responses.
- Hide answer keys from delivery DTOs and add adversarial API tests.

### Phase 2 - core homework completion

- Add lifecycle, audiences, rubrics, files, extensions, late policy, teacher review and student receipts/history.
- Build teacher workspace, creation, roster and grading pages plus evaluation reports.
- Post graded outcomes through the shared ledger.

### Phase 3 - Exam Master

- Add terms, components, halls, schedules, conflicts, candidate/seat allocation, supervisors and template versions.
- Build controlled marks entry, validation/moderation, grade ranges, calculations, rankings and publication.
- Rework report cards to consume publication snapshots.

### Phase 4 - Online Exam authoring

- Add addon gating, question bank/categories/versioning/review, types, blueprints, immutable forms, QTI import/export foundation and preview.
- Migrate existing inline MCQs into bank items/form snapshots.

### Phase 5 - Online Exam delivery

- Build preflight, start, autosave, reconnect, finalization, manual grading, accommodations, live monitor and results.
- Add worker reconciliation, operational dashboards, load shedding and recovery tooling.

### Phase 6 - interoperability and advanced quality

- Validate QTI import/export against official examples/conformance expectations.
- Add optional Safe Exam Browser integration, item analysis, reliability/difficulty/discrimination indicators with minimum-sample warnings, localized accessibility testing, and large-cohort load tests.
- Add LTI integration only when a real external-tool use case exists.

## 11. Test and acceptance matrix

- Tenant/role/teacher/student/parent isolation for every list, detail, mutation, download and export.
- Concurrent autosave, duplicate submit, expired window, reconnect, reset, accommodation and stale-client cases.
- Forged question/option IDs and answer-key exposure tests.
- File spoofing, malware/quarantine, size/quota and version-history tests.
- Schedule conflict and hall-capacity/property tests.
- Grade range boundary, decimal/rounding, absence/exemption, tie and correction golden tests.
- Publication/withdrawal snapshots remain reproducible after templates/rules change.
- Accessibility: keyboard-only, screen reader semantics, zoom/reflow, color independence, extra-time and alternate-content flows.
- Load: synchronized exam starts, autosave bursts and final-minute submission without lost responses.
- Disaster recovery: database plus submission/object storage restore produces consistent attempts and outcomes.

Definition of done: no mock/dummy submission remains; all three assessment modes share one outcome pipeline; current endpoints are hardened; paper and online exams are session-scoped and auditable; results are reproducible; and disabling Online Examinations leaves core homework, marks and report cards fully functional.

