# Teacher Portal — Future Implementation Plan

## Goal

Give teachers a fast daily workspace limited to assigned classes, sections, subjects and effective substitutions.

## Core journeys and pages

- **Home / Today:** timetable, next class, registers due/missing, grading queue, homework submissions, messages, meetings and announcements.
- **My timetable:** week/day, room, subject, class/section, substitution and conflict notices.
- **My classes:** roster, authorized student summary, accommodations/support indicators with field-level privacy, guardian contact only when policy permits.
- **Attendance:** open assigned register, QR/manual mark, late/excuse view, submit/lock; corrections/reopen requests follow policy.
- **Teaching & resources:** assignments/homework, files/Attachments Book, live-class creation/join and syllabus progress.
- **Assessments:** assessment plan, mark entry, rubrics/comments, moderation status, missing work and publication readiness.
- **Communication:** class/guardian announcements and individual conversations using approved channels/templates; no raw bulk contact export.
- **Meetings:** publish availability, guardian booking, agenda and follow-up notes with visibility controls.
- **Reports:** assigned-class attendance, assessment and progress reports; exports limited to current assignment scope.
- **Profile:** own contact visibility, availability, notification preferences, security sessions and permitted document access.

## Rules and APIs

- Scope derives from `classTeachers`, `subjectTeachers`, timetable assignments and effective substitutions; never from a client-supplied class ID alone.
- Class teacher and subject teacher capabilities differ. A subject teacher cannot edit another subject’s marks; a substitute receives bounded temporary access.
- Draft marks/homework remain private; publishing uses Assessment workflows. Teacher comments are versioned and moderated where configured.
- `/api/teacher/me/today|classes|timetable|tasks|reports`, plus scoped domain actions for attendance, assignments, grades and meetings.
- Add `teacherSubstitutions`, `teacherDelegations`, `teacherPortalPreferences` only where current assignment models are insufficient.

## Delivery

1. Scoped manifest, home and timetable.
2. My Classes and attendance.
3. Homework/resources/live classes.
4. Grade entry/moderation/reporting.
5. Communication, meetings and mobile/offline refinements.

## Done when

- A teacher sees/actions only effective assignments; substitution start/end works without stale access.
- Attendance and marks preserve existing register/publication authority.
- Daily core actions are usable on a phone and all changes are auditable.

