# 03 — Teaching and Learning Prompt Pack

This pack covers daily academic delivery. Admin, teacher, student, and parent experiences must call the same services with role-specific scopes.

## Domain contract

- Published offerings and rosters drive attendance, resources, homework, assessments, and exams.
- Draft/published/closed lifecycle is explicit; published work cannot be silently rewritten.
- Student submissions and marks preserve attempt and moderation history.
- Files use the shared asset service with scanning, authorization, retention, and signed URLs.

## TL-01 — Attendance session workspace

**Routes:** `/dashboard/attendance`, `/attendance/sessions/[id]`. **Users:** teachers and authorized staff. **Objective:** open a scheduled or ad-hoc session, mark Present/Late/Absent/Excused, record safe notes, submit, and amend through an audited workflow. **Layout:** class/date/period selector, roster optimized for rapid keyboard/touch entry, counters, exception drawer, submit bar. **Actions:** mark all present, edit exceptions, save draft, submit, request amendment. **States:** not started, draft, submitted, locked, amendment pending, roster changed. **Acceptance:** one record per learner/session, offline-safe idempotent sync, reason for changes after submission. **Exclude:** health diagnoses in ordinary notes.

## TL-02 — QR attendance check-in

**Routes:** `/dashboard/attendance/qr`, mobile `/portal/attendance/check-in`. **Objective:** allow rotating signed session QR check-in while preventing replay and preserving a teacher-reviewed exception queue. **Layout:** teacher display mode with timer and fallback code; student scanner with camera permission guidance; live queue with confidence/reason flags. **Actions:** start/stop QR window, scan, manually verify, approve/reject anomaly. **States:** no camera, permission denied, expired token, duplicate, wrong class, offline pending, suspected replay. **Acceptance:** short-lived nonce, server signature, membership/time validation, device/session rate limits, no student PII encoded. **Exclude:** treating QR presence as unquestionable proof or requiring location tracking by default.

## TL-03 — Attendance review, excuses, and reports

**Routes:** `/dashboard/attendance/review`, `/excuses`, `/reports`. **Objective:** resolve missing registers, excuse requests, late patterns, and audited corrections. **Layout:** exception inbox, student timeline, document evidence, summary filters. **Actions:** approve/reject excuse, request evidence, remind teacher, export authorized report. **States:** pending, approved, rejected, expired, conflicting correction. **Acceptance:** guardians see only their children; exports are logged; pattern indicators are descriptive, not punitive scores. **Exclude:** automated disciplinary decisions.

## TL-04 — Resource and attachment library

**Routes:** `/dashboard/resources`, `/resource-types`, `/resources/new`, `/resources/[id]`. **Objective:** publish class/subject/all-school learning resources with versioning and audience rules. **Layout:** filterable library; create form with audience, availability, attachment, description; detail with version/download history. **Actions:** upload, replace as new version, publish/unpublish, download, archive. **States:** scanning, rejected file, scheduled, published, expired, access denied. **Acceptance:** signed URLs, MIME/size checks, malware scan, accessible media metadata. **Exclude:** public object-storage links.

## TL-05 — Homework list, composer, and detail

**Routes:** `/dashboard/homework`, `/homework/new`, `/homework/[id]`. **Objective:** assign clear work to a roster, schedule release/due dates, attach resources, and monitor completion. **Layout:** class/section/subject filters; composer with instructions, rubric, attempts, late policy; detail summary and submission roster. **Actions:** save draft, preview as student, publish, duplicate, extend selected learners, close. **States:** draft, scheduled, open, due soon, overdue, closed, cancelled. **Acceptance:** recipients snapshot at publish with controlled late enrollments; timezone-safe deadlines; notifications through outbox. **Exclude:** editable recipients that rewrite historical submissions.

## TL-06 — Student submission and teacher evaluation

**Routes:** portal `/homework/[id]`, teacher `/homework/[id]/submissions/[studentId]`. **Objective:** submit text/files, preserve attempts, give rubric-aligned feedback, and publish evaluation. **Layout:** student task/attempt panel; teacher split view with submission, rubric, feedback, history. **Actions:** submit/resubmit, save feedback draft, return for revision, grade, publish. **States:** not submitted, draft upload, submitted, late, returned, graded, inaccessible file. **Acceptance:** immutable attempt timestamps, autosave, file scanning, mark changes audited. **Exclude:** silently replacing a submitted attempt.

## TL-07 — Assessment terms, plans, and grade policy

**Routes:** `/dashboard/assessments/terms`, `/plans`, `/grade-ranges`, `/marksheet-templates`. **Objective:** define assessment windows, components, weights, rounding, grade labels, and official output mapping. **Layout:** policy builder with calculated examples and validation summary. **Actions:** create version, simulate learner result, publish, retire. **States:** weights invalid, draft, active, locked by results, superseded. **Acceptance:** decimal-safe calculations, explicit rounding, policy version attached to results. **Exclude:** changing published historical outcomes by editing a policy.

## TL-08 — Exam planning and logistics

**Routes:** `/dashboard/exams`, `/exam-halls`, `/exam-distribution`, `/exam-schedule`, `/exam-schedule/new`. **Objective:** configure exams, rooms, invigilators, seats, accommodations, and publish conflict-free schedules. **Layout:** setup wizard, hall capacity map-neutral grid, conflict center, schedule calendar. **Actions:** allocate, auto-suggest, manually adjust, validate, publish, generate admit cards. **States:** capacity shortage, learner/teacher conflict, accommodation unresolved, draft/published. **Acceptance:** deterministic seat numbers, no conflicting published slots, accessible manual alternative. **Exclude:** biometric proctoring.

## TL-09 — Question bank and online exam builder

**Routes:** `/dashboard/question-bank`, `/question-groups`, `/online-exams`, `/online-exams/new`, `/online-exams/[id]`. **Objective:** create tagged/versioned questions and assemble secure but accessible exams. **Layout:** bank filters and preview; builder sections for audience, timing, attempts, randomization, questions, scoring, accommodations. **Actions:** create/review/publish question, import with validation, build, preview, schedule. **States:** draft, review needed, exposed/retired question, invalid scoring, scheduled/open/closed. **Acceptance:** question version snapshot, sanitization, math/media accessibility, author/reviewer separation when enabled. **Exclude:** claiming cheat-proof exams.

## TL-10 — Online exam taking experience

**Route:** `/portal/exams/[id]/take`. **Objective:** provide a resilient, accessible timed assessment with autosave and clear submission. **Layout:** instructions/preflight, question navigator, one/all-question mode per policy, save indicator, timer, submit review. **Actions:** start, answer, flag, navigate, submit, resume permitted attempt. **States:** not open, identity step-up, network loss, autosave retry, time expired, submitted. **Acceptance:** server-authoritative timing, idempotent answer writes, recovery after refresh, accommodations honored. **Exclude:** invasive camera recording unless separately consented and legally reviewed.

## TL-11 — Mark entry, moderation, results, and progress

**Routes:** `/dashboard/marks/entry`, `/marks/moderation`, `/results`, `/position`, `/progress`. **Objective:** enter validated marks efficiently, moderate exceptions, calculate official results, and publish audience-safe outcomes. **Layout:** spreadsheet-like accessible grid, validation panel, moderation queue, result preview. **Actions:** save draft, import, submit, approve, reopen with reason, calculate, publish. **States:** missing, absent, excused, invalid, awaiting moderation, locked, published. **Acceptance:** server calculation from policy snapshot, complete change history, position/rank optional and policy-controlled. **Exclude:** ranking as a mandatory default and manual edits to computed totals.

## Verification prompt

Test roster changes, QR expiry/replay, offline attendance sync, submission retries, file rejection, due-date timezone boundaries, assessment rounding, exam collisions, server timer expiry, question version snapshots, mark moderation, publication visibility, tenant/class/child scoping, RTL and keyboard-only workflows.
