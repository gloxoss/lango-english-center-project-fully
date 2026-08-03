# Parent and Guardian Portal — Future Implementation Plan

## Goal

Give an authenticated guardian one household view with explicit, child-specific authorization and consent-aware communication.

## Core journeys and pages

- **Household home:** child switcher, urgent alerts, today attendance, balances, upcoming exams/events, homework and messages.
- **Child overview:** placement, timetable, authorized teacher contacts, attendance, published progress and school documents.
- **Attendance/excuses:** history/coverage, absence/late notices, upload evidence, follow approval and correction state.
- **Learning/results:** homework visibility, published feedback/report cards/transcripts; no draft marks or internal teacher notes.
- **Finance:** household/student statements, invoices, receipts, due balance, payment and reminder preferences.
- **Meetings/communication:** book teacher slots, announcements, conversations and communication history under school policy.
- **Requests:** profile corrections, enrollment documents, leave/permission, transport/hostel/event consent and support tickets as modules enable them.
- **Settings:** relationship/contact details, legal authority evidence, language/channel preferences, sessions and privacy consent.

## Relationship and privacy model

- Access is based on effective `guardianStudents` relationship plus permissions (`academic`, `attendance`, `finance`, `pickup`, `medical`, `communication`) and custody/legal restrictions.
- One guardian may have different rights per child; one child may have multiple guardians. Primary contact is not universal authority.
- Relationship changes revoke access immediately and preserve audit history. Sensitive contact/address/custody data is field-restricted.
- Household aggregation never exposes another guardian’s private details or unrelated sibling data.
- `/api/guardian/me/children`, `/children/:relationshipId/home|attendance|results|finance|documents`, with relationship reauthorization per request.

## Delivery

1. Guardian account/invitation, relationship permissions and child switcher.
2. Attendance, announcements, schedule and published results.
3. Finance/payment/receipts.
4. Meetings, requests, documents and add-on consents.
5. Household preferences, accessibility and support.

## Done when

- Cross-child/guardian/custody negative tests pass for every API, export and download.
- Revocation is immediate; one-time invitations/reset never expose passwords.
- Financial and academic publication states match the source domains exactly.

