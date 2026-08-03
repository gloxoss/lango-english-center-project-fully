# Employee Self-Service Portal — Future Implementation Plan

## Goal

Let non-admin staff manage their own employment, time, leave, payroll documents and requests through the HR/Payroll add-ons.

## Core journeys and pages

- **Home:** schedule/shift, clock state, leave balance, requests, latest payslip, documents due and announcements.
- **My profile:** permitted personal/contact/bank/tax/emergency details with correction/approval workflow for controlled fields.
- **Time & attendance:** own punches/work sessions, exceptions, correction request and approved schedule; no peer data.
- **Leave:** balances/transactions, request/cancel, attachment, approver status and team calendar limited to approved visibility.
- **Payroll:** published payslips, payment state, annual summaries and explanations; no draft payroll-run information.
- **Advances/awards:** request/status/repayment schedule and published awards where Payroll plan enables them.
- **Documents:** contracts, certificates, policies, acknowledgements and expiring-document reminders.
- **Requests/help:** HR cases, equipment/resources, reimbursement later, and private communication.
- **Security/preferences:** sessions, 2FA, notification and payslip delivery preferences.

## Identity and rules

- Employee is a profile/assignment linked to a user, not necessarily a new exclusive role. Teachers/accountants/librarians may also access employee self-service in their own account.
- Self-service capability is additive and active only during effective employment or defined post-employment retention window.
- Sensitive edits use field workflows; bank/tax changes require reauthentication and approval. Payslips are immutable published snapshots.
- `/api/employee/me/home|profile|time|leave|payroll|documents|requests` derives employee identity from session.

## Delivery

1. Employee identity link, manifest, profile/documents.
2. Leave self-service.
3. Time/punch/correction.
4. Payslips/payment/advances.
5. Requests, acknowledgements and mobile polish.

## Done when

- Self-service never reveals peer salary/leave/private records.
- Employment start/end and multi-assignment behavior revoke/retain access correctly.
- Every sensitive change and downloaded payslip is auditable.

