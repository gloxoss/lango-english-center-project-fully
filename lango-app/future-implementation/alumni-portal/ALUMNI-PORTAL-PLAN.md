# Alumni Portal — Future Implementation Plan

## Goal

Provide an opt-in post-graduation relationship for records, events and community without retaining unnecessary student-portal access.

## Core journeys and pages

- **Alumni home:** announcements, events, record requests and profile completeness.
- **Records:** published transcript/certificates and secure verification/request workflows; corrections remain controlled.
- **Events/community:** alumni events, RSVP, volunteering/mentoring opportunities and preferences.
- **Directory:** opt-in fields only, searchable according to consent; private by default and revocable.
- **Profile:** graduation cohort, current voluntary details, communication consent, visibility and account/security settings.
- **Requests/support:** document reissue, data access/correction/deletion and school contact.
- Donations/fundraising are explicitly deferred until legal, payment and accounting requirements are separately planned.

## Lifecycle and rules

- Graduation closes learner operational access and may offer a distinct alumni transition/invitation. Never silently repurpose the student account or consent.
- Separate required academic-record retention from optional alumni/community data. Withdrawing community consent does not erase legally retained records.
- Minors are not migrated into a public alumni directory. Directory and mentoring require age/consent/safeguarding policies.
- `/api/alumni/me/profile|records|events|requests|preferences`, with verification-safe document downloads.

## Delivery

1. Graduate lifecycle, invitation/consent and record access.
2. Events/announcements.
3. Opt-in directory and mentoring after safeguarding review.
4. Requests, analytics and retention automation.

## Done when

- Student permissions are removed at transition while authorized record access remains.
- Directory data is opt-in, field-specific and immediately revocable.
- Retention/consent/export/delete rules distinguish official records from community data.

