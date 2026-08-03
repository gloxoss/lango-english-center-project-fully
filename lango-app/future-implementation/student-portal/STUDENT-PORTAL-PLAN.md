# Student Portal — Future Implementation Plan

## Goal

Provide an age-appropriate learner workspace for schedule, learning, results, attendance, finance visibility and school services.

## Core journeys and pages

- **Home:** today’s schedule, due homework, live class, announcements, attendance alert and newly published results.
- **Calendar/timetable:** classes, exams, events, holidays and deadlines from the unified calendar read model.
- **Courses/resources:** enrolled subjects, syllabus progress, teacher-published resources and secure downloads.
- **Homework:** assignment detail, submission/upload, version/late state, teacher feedback and resubmission policy.
- **Live classes:** authorized join, readiness check and recording/resource access when published.
- **Attendance:** own daily/history/overview, late/absence/excuse state; submit excuse evidence only when policy and age allow.
- **Results:** published report cards, progress, marks/grades, transcript/certificates and verification-safe downloads.
- **Exams:** schedule, admit card, online attempts, result publication and accommodations displayed privately.
- **Library:** search, loans, due dates, renewals/holds when add-on enabled.
- **Finance:** own statement/invoices/receipts; payment actions follow age/guardian policy and gateway readiness.
- **Profile/support:** permitted self-service fields, documents, password/2FA/sessions, notification preferences and help request.

## Rules and APIs

- All reads derive student identity from the authenticated session. No arbitrary `studentId` access.
- Only published academic results/resources appear. Drafts, teacher notes and risk models remain private unless a policy explicitly exposes a safe explanation.
- Submission files use tenant/student paths, malware/type/size validation and version history.
- Direct communication/contact visibility follows age, consent and school policy; guardian routing is default for minors.
- `/api/student/me/home|calendar|subjects|attendance|results|finance|documents`, with domain-owned submission/join actions.

## Delivery

1. Identity/placement manifest, home, timetable and announcements.
2. Subjects/resources/homework.
3. Attendance and published results/documents.
4. Exams/live classes.
5. Optional Library, Events and Finance experiences.

## Done when

- A student cannot access another student by changing URLs/IDs.
- Draft/unpublished and private staff/guardian data never leaks.
- Mobile, accessibility, Arabic RTL and low-bandwidth submission/recovery flows pass.

