# SchoolOS page-by-page audit

Generated 2026-09-23 from the sweep logs, screenshots and findings of the 2026-09-22/23 audits. One file per app page (`pages/`), one per finding (`findings/`), screenshots in `shots/` (JPEG, 900 px wide, cropped at ~2 600 px).

**337 pages:** 164 need a fix · 1 need triage · 172 pass · 0 screenshot only · 0 not swept.

## How to read it

- **Status** is the worst page-specific finding. Cross-cutting findings (header, rate limit, translations) are listed on each page but do not change its status.
- **Sweep results** show every automated run: `ok`, `expected` (by design, e.g. add-on off, access denied, not-found for fake IDs), a finding ID, or **?** (unclassified, needs a look).
- **Passes:** `A` = Pass A · main DB (:3111/:3222), 2026-09-22/23; `B` = Pass B · seeded audit DB, all add-ons, 2026-09-23; `C` = Pass C · detail + public pages, 2026-09-23; `C-idor` = Pass C · parent typing staff URLs (expected: blocked); `C-site` = Pass C · public site after publishing content.
- **Limits:** only one school in the audit DB, so cross-school leaks are not tested. Automated checks run on every page; about 50 screenshots were also reviewed by eye.

- **Code now** column: the working tree changes while agents fix things. At generation time some findings were re-checked in code (see each finding file). Status still reflects what the sweep saw; confirm fixes with a re-sweep.

## Findings

| ID | Sev | Problem | Pages | Code now |
|---|---|---|---|---|
| [S-1](findings/S-1.md) | P0 | Five Communication pages ran entirely on invented data | 0 | LIKELY FIXED |
| [S-2](findings/S-2.md) | P1 | SMS reminders page shows a false all-clear | 1 | Not re-checked since the sweep. |
| [S-3](findings/S-3.md) | P1 | General ledger silently empty, reports say "Équilibré" | 3 | Not re-checked since the sweep. |
| [S-4](findings/S-4.md) | P1 | Empty checks scored as 100 % (readiness, attendance, collection, SMS) | 1 | Not re-checked since the sweep. |
| [S-5](findings/S-5.md) | P1 | Report card generator: "Moyenne générale 0.00/20" with no marks, print enabled | 1 | Not re-checked since the sweep. |
| [S-6](findings/S-6.md) | P1 | Translation keys used in code are missing (users see raw keys or blanks) | 18 | LIKELY FIXED in the working tree |
| [S-7](findings/S-7.md) | P1 | ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French) | 0 + global | Not re-checked since the sweep. |
| [S-8](findings/S-8.md) | P1 | Gate pickup does not re-check guardianship at release | 2 | Not re-checked since the sweep. |
| [S-9](findings/S-9.md) | P1 | Promotion wizard: wrong defaults and misleading numbers | 2 | Not re-checked since the sweep. |
| [S-18](findings/S-18.md) | P1 | Header claims CNDP compliance on every page; the school has not filed | 1 + global | Not re-checked since the sweep. |
| [S-19](findings/S-19.md) | P1 | Late fees are assessed but never billed, and can double | 1 | Not re-checked since the sweep. |
| [S-20](findings/S-20.md) | P1 | Emergency headcount ignores manual attendance | 1 | Not re-checked since the sweep. |
| [S-21](findings/S-21.md) | P1 | Approvals inbox shows "0 en attente" when the director has no approval authority | 1 | Not re-checked since the sweep. |
| [S-32](findings/S-32.md) | P1 | Sidebar links looser than their page; denied users land on the public homepage | 91 | Not re-checked since the sweep. |
| [S-35](findings/S-35.md) | P1 | Accountant gets 403 on class sections and semesters on the cash desk | 4 | Not re-checked since the sweep. |
| [S-38](findings/S-38.md) | P1 | HR self-service locked for every employee | 1 | STILL OPEN |
| [S-39](findings/S-39.md) | P1 | Super-admin dashboard shows invented numbers | 1 | STILL OPEN |
| [S-40](findings/S-40.md) | P1 | Super-admin revenue: collected > billed, "Reste dû 0" | 1 | STILL OPEN |
| [S-41](findings/S-41.md) | P1 | Auth rate limit counts every page's session check, per IP | 0 + global | STILL OPEN |
| [V-1](findings/V-1.md) | P1 | Finance home shows 6 000 MAD overdue, every other screen shows 3 000 | 1 | Not re-checked since the sweep. |
| [S-10](findings/S-10.md) | P2 | Homework page shows developer copy and "0 %" for 0/0 | 2 | Not re-checked since the sweep. |
| [S-11](findings/S-11.md) | P2 | Marksheet and grade entry: no title or link back to the exam list | 2 | Not re-checked since the sweep. |
| [S-12](findings/S-12.md) | P2 | Timetable: duplicate generate buttons, 2-hour grid | 1 | Not re-checked since the sweep. |
| [S-13](findings/S-13.md) | P2 | Exam planning exists twice | 2 | Not re-checked since the sweep. |
| [S-14](findings/S-14.md) | P2 | Sidebar lists add-on modules the tenant has not enabled | 0 + global | Not re-checked since the sweep. |
| [S-15](findings/S-15.md) | P2 | Two director dashboards with overlapping KPIs; IGP unexplained | 3 | Not re-checked since the sweep. |
| [S-16](findings/S-16.md) | P2 | Academics index redirects the director to the teacher schedule | 1 | Not re-checked since the sweep. |
| [S-17](findings/S-17.md) | P2 | Classes page developer copy; Filière/Cycle empty for lycée classes | 1 | Not re-checked since the sweep. |
| [S-22](findings/S-22.md) | P2 | Leadership admin calls HR API when HR add-on is off | 1 | Not re-checked since the sweep. |
| [S-23](findings/S-23.md) | P2 | Audit log shows internal names and writes rows on view | 1 | Not re-checked since the sweep. |
| [S-24](findings/S-24.md) | P2 | Three matricule formats in one tenant | 2 | Not re-checked since the sweep. |
| [S-25](findings/S-25.md) | P2 | Header shows a fake identity when the session call is slow | 0 + global | Not re-checked since the sweep. |
| [S-26](findings/S-26.md) | P2 | Settings page: wrong "Configuré" state, raw English actions, spec codes | 1 | Not re-checked since the sweep. |
| [S-27](findings/S-27.md) | P2 | Cashier sessions: green "Écart cumulé 0 MAD" with zero sessions | 1 | Not re-checked since the sweep. |
| [S-28](findings/S-28.md) | P2 | Receivables aging treats not-yet-due invoices as late and offers an SMS reminder | 1 | Not re-checked since the sweep. |
| [S-30](findings/S-30.md) | P2 | No payment history screen; payments routes land on the cash desk | 2 | Not re-checked since the sweep. |
| [S-31](findings/S-31.md) | P2 | Developer copy on finance screens | 4 | Not re-checked since the sweep. |
| [S-33](findings/S-33.md) | P2 | "{count} demandes" rendered without a value | 1 | Not re-checked since the sweep. |
| [S-34](findings/S-34.md) | P2 | Student photos: broken files counted, upload hint names a format nobody has | 1 | Not re-checked since the sweep. |
| [S-36](findings/S-36.md) | P2 | Invoices on phone: desktop table squeezed, status off-screen | 1 | Not re-checked since the sweep. |
| [S-37](findings/S-37.md) | P2 | Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL | 1 + global | Not re-checked since the sweep. |
| [S-42](findings/S-42.md) | P2 | Certificates module untranslated; raw keys on screen | 12 | LIKELY FIXED in the working tree |
| [S-43](findings/S-43.md) | P2 | `HR.colStatus` missing on 3 HR pages | 3 | LIKELY FIXED in the working tree |
| [S-44](findings/S-44.md) | P2 | Staff campus switcher renders for parents, students and super admin (403 on every page) | 0 + global | Not re-checked since the sweep. |
| [S-45](findings/S-45.md) | P2 | Parent sidebar reuses staff labels | 7 | Not re-checked since the sweep. |
| [S-46](findings/S-46.md) | P2 | Seed data contradicts itself (library loans, live-class dates) | 3 | Not re-checked since the sweep. |
| [S-52](findings/S-52.md) | P2 | Parents and students can read any event by ID (drafts, staff-only) | 1 | STILL OPEN |
| [S-53](findings/S-53.md) | P2 | Salary payment batches skip the RIB check; no bank export | 3 | STILL OPEN |
| [S-54](findings/S-54.md) | P2 | Expired hostel stays stay "checked_in" forever | 5 | Not re-checked since the sweep. |
| [S-56](findings/S-56.md) | P2 | Inventory quantities read as thousands ("+12.000" for 12) | 3 | Not re-checked since the sweep. |
| [S-29](findings/S-29.md) | P3 | Overdue totals agree everywhere except the finance home (confirms V-1) | 1 | Not re-checked since the sweep. |
| [S-47](findings/S-47.md) | P3 | Empty subtitle rendered as "—" (teacher class card, parent child picker) | 8 | Not re-checked since the sweep. |
| [S-48](findings/S-48.md) | P3 | Parent amounts unformatted ("24000 MAD") | 2 | Not re-checked since the sweep. |
| [S-49](findings/S-49.md) | P3 | Super-admin dashboard text glitches | 1 | Not re-checked since the sweep. |
| [S-50](findings/S-50.md) | P3 | Transport allocations list without React keys | 2 | Not re-checked since the sweep. |
| [S-51](findings/S-51.md) | P3 | Cards "Émissions récentes" never shows the recipient | 1 | Not re-checked since the sweep. |
| [S-55](findings/S-55.md) | P3 | Public school site: no menu, home ignores news, low-contrast hero | 9 | Not re-checked since the sweep. |
| [S-57](findings/S-57.md) | P3 | Raw enum values, two money formats, stale "current" year, overlapping widget | 6 | Not re-checked since the sweep. |

## Pages by module

### academics

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/academics`](pages/academics/academics.md) | NEEDS FIX (P2) | S-16 | 1 |
| [`/dashboard/academics/assessment/exam-master`](pages/academics/academics__assessment__exam-master.md) | NEEDS FIX (P1) | S-13, S-32 | 1 |
| [`/dashboard/academics/assessment/homework`](pages/academics/academics__assessment__homework.md) | NEEDS FIX (P1) | S-10, S-32 | 3 |
| [`/dashboard/academics/assessment/marksheet`](pages/academics/academics__assessment__marksheet.md) | NEEDS FIX (P2) | S-11 | 3 |
| [`/dashboard/academics/assessment/online-exams`](pages/academics/academics__assessment__online-exams.md) | NEEDS FIX (P1) | S-32 | 4 |
| [`/dashboard/academics/assignments`](pages/academics/academics__assignments.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/academics/calendar`](pages/academics/academics__calendar.md) | PASS | — | 1 |
| [`/dashboard/academics/classes`](pages/academics/academics__classes.md) | NEEDS FIX (P1) | S-32, S-17 | 2 |
| [`/dashboard/academics/classes/[id]`](pages/academics/academics__classes___id_.md) | PASS | — | 2 |
| [`/dashboard/academics/conflicts`](pages/academics/academics__conflicts.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/academics/evaluations`](pages/academics/academics__evaluations.md) | PASS | — | 1 |
| [`/dashboard/academics/exams`](pages/academics/academics__exams.md) | NEEDS FIX (P2) | S-13 | 1 |
| [`/dashboard/academics/grades/entry`](pages/academics/academics__grades__entry.md) | NEEDS FIX (P2) | S-11 | 5 |
| [`/dashboard/academics/grading/policies`](pages/academics/academics__grading__policies.md) | PASS | — | 1 |
| [`/dashboard/academics/live-class`](pages/academics/academics__live-class.md) | NEEDS FIX (P2) | S-46 | 4 |
| [`/dashboard/academics/live-class-reports`](pages/academics/academics__live-class-reports.md) | PASS | — | 2 |
| [`/dashboard/academics/live-class/[id]`](pages/academics/academics__live-class___id_.md) | NEEDS FIX (P2) | S-46 | 2 |
| [`/dashboard/academics/live-class/new`](pages/academics/academics__live-class__new.md) | PASS | — | 2 |
| [`/dashboard/academics/mediums`](pages/academics/academics__mediums.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/academics/optional-subjects`](pages/academics/academics__optional-subjects.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/academics/promotions`](pages/academics/academics__promotions.md) | NEEDS FIX (P1) | S-9 | 1 |
| [`/dashboard/academics/question-bank`](pages/academics/academics__question-bank.md) | NEEDS FIX (P1) | S-6, S-32 | 2 |
| [`/dashboard/academics/readiness`](pages/academics/academics__readiness.md) | NEEDS FIX (P1) | S-4, S-32 | 1 |
| [`/dashboard/academics/results`](pages/academics/academics__results.md) | PASS | — | 1 |
| [`/dashboard/academics/rooms`](pages/academics/academics__rooms.md) | NEEDS FIX (P1) | S-6 | 1 |
| [`/dashboard/academics/schedule`](pages/academics/academics__schedule.md) | NEEDS FIX (P1) | S-6, S-32, S-12 | 2 |
| [`/dashboard/academics/sections`](pages/academics/academics__sections.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/academics/semesters`](pages/academics/academics__semesters.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/academics/session-copy`](pages/academics/academics__session-copy.md) | PASS | — | 1 |
| [`/dashboard/academics/shifts`](pages/academics/academics__shifts.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/academics/streams`](pages/academics/academics__streams.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/academics/subjects`](pages/academics/academics__subjects.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/academics/syllabus`](pages/academics/academics__syllabus.md) | NEEDS FIX (P1) | S-32 | 2 |
| [`/dashboard/academics/teacher-availability`](pages/academics/academics__teacher-availability.md) | PASS | — | 1 |
| [`/dashboard/academics/teacher-schedule`](pages/academics/academics__teacher-schedule.md) | PASS | — | 3 |

### access-denied

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/access-denied`](pages/access-denied/access-denied.md) | PASS | — | 1 |

### accountant

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/accountant`](pages/accountant/accountant.md) | PASS | — | 1 |

### alumni

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/alumni`](pages/alumni/alumni.md) | PASS | — | 1 |
| [`/alumni/directory`](pages/alumni/alumni__directory.md) | PASS | — | 1 |
| [`/alumni/events`](pages/alumni/alumni__events.md) | PASS | — | 1 |
| [`/alumni/mentoring`](pages/alumni/alumni__mentoring.md) | PASS | — | 1 |
| [`/alumni/profile`](pages/alumni/alumni__profile.md) | PASS | — | 1 |
| [`/alumni/records`](pages/alumni/alumni__records.md) | PASS | — | 1 |
| [`/alumni/requests`](pages/alumni/alumni__requests.md) | PASS | — | 1 |

### analytics

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/analytics`](pages/analytics/analytics.md) | NEEDS FIX (P1) | S-15, S-32 | 1 |

### attendance

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/attendance`](pages/attendance/attendance.md) | PASS | — | 8 |
| [`/dashboard/attendance/audit`](pages/attendance/attendance__audit.md) | PASS | — | 1 |
| [`/dashboard/attendance/badges`](pages/attendance/attendance__badges.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/attendance/excuses`](pages/attendance/attendance__excuses.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/attendance/flags`](pages/attendance/attendance__flags.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/attendance/flags/[id]`](pages/attendance/attendance__flags___id_.md) | PASS | — | 2 |
| [`/dashboard/attendance/qr-reports`](pages/attendance/attendance__qr-reports.md) | PASS | — | 1 |
| [`/dashboard/attendance/scanner`](pages/attendance/attendance__scanner.md) | NEEDS FIX (P1) | S-20 | 1 |

### broadcast

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/broadcast`](pages/broadcast/broadcast.md) | PASS | — | 2 |
| [`/dashboard/broadcast/automations`](pages/broadcast/broadcast__automations.md) | NEEDS FIX (P1) | S-32 | 2 |
| [`/dashboard/broadcast/campaigns`](pages/broadcast/broadcast__campaigns.md) | PASS | — | 2 |
| [`/dashboard/broadcast/campaigns/[id]`](pages/broadcast/broadcast__campaigns___id_.md) | PASS | — | 2 |
| [`/dashboard/broadcast/connections`](pages/broadcast/broadcast__connections.md) | NEEDS FIX (P1) | S-32 | 2 |
| [`/dashboard/broadcast/reports`](pages/broadcast/broadcast__reports.md) | PASS | — | 2 |
| [`/dashboard/broadcast/segments`](pages/broadcast/broadcast__segments.md) | NEEDS FIX (P1) | S-32 | 2 |
| [`/dashboard/broadcast/templates`](pages/broadcast/broadcast__templates.md) | NEEDS FIX (P1) | S-32 | 2 |

### cards

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/cards`](pages/cards/cards.md) | NEEDS FIX (P3) | S-51 | 2 |
| [`/dashboard/cards/admit-cards`](pages/cards/cards__admit-cards.md) | PASS | — | 2 |
| [`/dashboard/cards/employees`](pages/cards/cards__employees.md) | PASS | — | 2 |
| [`/dashboard/cards/issued`](pages/cards/cards__issued.md) | PASS | — | 2 |
| [`/dashboard/cards/jobs`](pages/cards/cards__jobs.md) | PASS | — | 2 |
| [`/dashboard/cards/students`](pages/cards/cards__students.md) | PASS | — | 2 |
| [`/dashboard/cards/templates`](pages/cards/cards__templates.md) | PASS | — | 2 |
| [`/dashboard/cards/templates/[id]/edit`](pages/cards/cards__templates___id___edit.md) | PASS | — | 2 |

### certificates

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/certificates`](pages/certificates/certificates.md) | NEEDS FIX (P2) | S-42 | 2 |
| [`/dashboard/certificates/definitions`](pages/certificates/certificates__definitions.md) | NEEDS FIX (P1) | S-6, S-42 | 2 |
| [`/dashboard/certificates/definitions/[id]`](pages/certificates/certificates__definitions___id_.md) | NEEDS FIX (P1) | S-6, S-42 | 2 |
| [`/dashboard/certificates/issue/employees`](pages/certificates/certificates__issue__employees.md) | NEEDS FIX (P1) | S-6, S-42 | 2 |
| [`/dashboard/certificates/issue/students`](pages/certificates/certificates__issue__students.md) | NEEDS FIX (P1) | S-6, S-42 | 2 |
| [`/dashboard/certificates/issued`](pages/certificates/certificates__issued.md) | NEEDS FIX (P1) | S-6, S-42 | 2 |
| [`/dashboard/certificates/issued/[id]`](pages/certificates/certificates__issued___id_.md) | NEEDS FIX (P1) | S-6, S-42 | 2 |
| [`/dashboard/certificates/jobs`](pages/certificates/certificates__jobs.md) | NEEDS FIX (P1) | S-6, S-42 | 2 |
| [`/dashboard/certificates/requests`](pages/certificates/certificates__requests.md) | NEEDS FIX (P1) | S-6, S-32, S-42 | 2 |
| [`/dashboard/certificates/settings`](pages/certificates/certificates__settings.md) | NEEDS FIX (P1) | S-6, S-42 | 2 |
| [`/dashboard/certificates/templates`](pages/certificates/certificates__templates.md) | NEEDS FIX (P1) | S-6, S-42 | 2 |
| [`/dashboard/certificates/templates/[id]/edit`](pages/certificates/certificates__templates___id___edit.md) | NEEDS FIX (P1) | S-6, S-42 | 2 |

### communication

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/communication`](pages/communication/communication.md) | PASS | — | 1 |
| [`/dashboard/communication/broadcast`](pages/communication/communication__broadcast.md) | PASS | — | 1 |
| [`/dashboard/communication/campaign-composer`](pages/communication/communication__campaign-composer.md) | PASS | — | 1 |
| [`/dashboard/communication/crm`](pages/communication/communication__crm.md) | PASS | — | 2 |
| [`/dashboard/communication/delivery-reports`](pages/communication/communication__delivery-reports.md) | PASS | — | 1 |
| [`/dashboard/communication/events`](pages/communication/communication__events.md) | PASS | — | 2 |
| [`/dashboard/communication/reminders`](pages/communication/communication__reminders.md) | NEEDS FIX (P1) | S-2, S-32 | 3 |
| [`/dashboard/communication/templates`](pages/communication/communication__templates.md) | NEEDS FIX (P1) | S-32 | 1 |

### content

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/content/library`](pages/content/content__library.md) | NEEDS FIX (P1) | S-32 | 2 |
| [`/dashboard/content/types`](pages/content/content__types.md) | PASS | — | 2 |

### dashboard-home

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard`](pages/dashboard-home/home.md) | NEEDS FIX (P2) | S-15, S-37 | 7 |

### documents

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/documents/generator`](pages/documents/documents__generator.md) | NEEDS FIX (P1) | S-5, S-32 | 2 |

### events

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/events`](pages/events/events.md) | NEEDS FIX (P3) | S-57 | 4 |
| [`/dashboard/events/[id]`](pages/events/events___id_.md) | NEEDS FIX (P2) | S-52, S-57 | 2 |

### finance

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/finance`](pages/finance/finance.md) | NEEDS FIX (P1) | V-1, S-29 | 8 |
| [`/dashboard/finance/accounting/accounts`](pages/finance/finance__accounting__accounts.md) | PASS | — | 2 |
| [`/dashboard/finance/accounting/deposits/new`](pages/finance/finance__accounting__deposits__new.md) | PASS | — | 2 |
| [`/dashboard/finance/accounting/expenses`](pages/finance/finance__accounting__expenses.md) | PASS | — | 2 |
| [`/dashboard/finance/accounting/periods`](pages/finance/finance__accounting__periods.md) | NEEDS FIX (P1) | S-3 | 2 |
| [`/dashboard/finance/accounting/statements`](pages/finance/finance__accounting__statements.md) | NEEDS FIX (P1) | S-3, S-31 | 2 |
| [`/dashboard/finance/accounting/student-accounting`](pages/finance/finance__accounting__student-accounting.md) | NEEDS FIX (P1) | S-3 | 2 |
| [`/dashboard/finance/accounting/transactions`](pages/finance/finance__accounting__transactions.md) | PASS | — | 2 |
| [`/dashboard/finance/accounting/voucher-types`](pages/finance/finance__accounting__voucher-types.md) | PASS | — | 2 |
| [`/dashboard/finance/allocation`](pages/finance/finance__allocation.md) | NEEDS FIX (P1) | S-32 | 2 |
| [`/dashboard/finance/allocations`](pages/finance/finance__allocations.md) | NEEDS FIX (P1) | S-32 | 2 |
| [`/dashboard/finance/approvals`](pages/finance/finance__approvals.md) | NEEDS FIX (P1) | S-32 | 2 |
| [`/dashboard/finance/bank-reconciliation`](pages/finance/finance__bank-reconciliation.md) | PASS | — | 2 |
| [`/dashboard/finance/cashier-sessions`](pages/finance/finance__cashier-sessions.md) | NEEDS FIX (P2) | S-27 | 2 |
| [`/dashboard/finance/chart-of-accounts`](pages/finance/finance__chart-of-accounts.md) | PASS | — | 2 |
| [`/dashboard/finance/collection-desk`](pages/finance/finance__collection-desk.md) | NEEDS FIX (P1) | S-35, S-32 | 7 |
| [`/dashboard/finance/credit-notes`](pages/finance/finance__credit-notes.md) | NEEDS FIX (P1) | S-32 | 2 |
| [`/dashboard/finance/expenses`](pages/finance/finance__expenses.md) | PASS | — | 2 |
| [`/dashboard/finance/expenses/new`](pages/finance/finance__expenses__new.md) | PASS | — | 2 |
| [`/dashboard/finance/fee-assignments`](pages/finance/finance__fee-assignments.md) | NEEDS FIX (P1) | S-32 | 2 |
| [`/dashboard/finance/fee-structures`](pages/finance/finance__fee-structures.md) | NEEDS FIX (P1) | S-35, S-31, S-32 | 2 |
| [`/dashboard/finance/fee-types`](pages/finance/finance__fee-types.md) | NEEDS FIX (P1) | S-32 | 2 |
| [`/dashboard/finance/fine-policies`](pages/finance/finance__fine-policies.md) | NEEDS FIX (P1) | S-19, S-32 | 2 |
| [`/dashboard/finance/invoices`](pages/finance/finance__invoices.md) | NEEDS FIX (P2) | S-31, S-36 | 4 |
| [`/dashboard/finance/invoices/[id]`](pages/finance/finance__invoices___id_.md) | PASS | — | 3 |
| [`/dashboard/finance/journal`](pages/finance/finance__journal.md) | PASS | — | 2 |
| [`/dashboard/finance/office-accounting`](pages/finance/finance__office-accounting.md) | PASS | — | 2 |
| [`/dashboard/finance/online-payments`](pages/finance/finance__online-payments.md) | PASS | — | 2 |
| [`/dashboard/finance/payments`](pages/finance/finance__payments.md) | NEEDS FIX (P1) | S-30, S-35 | 2 |
| [`/dashboard/finance/payments/new`](pages/finance/finance__payments__new.md) | NEEDS FIX (P1) | S-30, S-35, S-32 | 2 |
| [`/dashboard/finance/receipts`](pages/finance/finance__receipts.md) | PASS | — | 2 |
| [`/dashboard/finance/receivables`](pages/finance/finance__receivables.md) | NEEDS FIX (P2) | S-28 | 2 |
| [`/dashboard/finance/reconciliation`](pages/finance/finance__reconciliation.md) | PASS | — | 2 |
| [`/dashboard/finance/refunds`](pages/finance/finance__refunds.md) | NEEDS FIX (P1) | S-32 | 2 |
| [`/dashboard/finance/reminders`](pages/finance/finance__reminders.md) | PASS | — | 2 |
| [`/dashboard/finance/reports`](pages/finance/finance__reports.md) | NEEDS FIX (P2) | S-31 | 2 |
| [`/dashboard/finance/statements`](pages/finance/finance__statements.md) | NEEDS FIX (P1) | S-32 | 2 |

### homework

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/homework`](pages/homework/homework.md) | NEEDS FIX (P1) | S-32, S-10 | 3 |

### hostel

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/hostel`](pages/hostel/hostel.md) | NEEDS FIX (P2) | S-54 | 2 |
| [`/dashboard/hostel/allocations`](pages/hostel/hostel__allocations.md) | NEEDS FIX (P1) | S-32, S-54 | 2 |
| [`/dashboard/hostel/allocations/[id]`](pages/hostel/hostel__allocations___id_.md) | NEEDS FIX (P2) | S-54 | 2 |
| [`/dashboard/hostel/applications`](pages/hostel/hostel__applications.md) | NEEDS FIX (P1) | S-32 | 2 |
| [`/dashboard/hostel/board`](pages/hostel/hostel__board.md) | NEEDS FIX (P1) | S-32, S-54 | 2 |
| [`/dashboard/hostel/categories`](pages/hostel/hostel__categories.md) | NEEDS FIX (P1) | S-32 | 2 |
| [`/dashboard/hostel/guardian`](pages/hostel/hostel__guardian.md) | PASS | — | 1 |
| [`/dashboard/hostel/hostels`](pages/hostel/hostel__hostels.md) | NEEDS FIX (P1) | S-32 | 2 |
| [`/dashboard/hostel/hostels/[id]`](pages/hostel/hostel__hostels___id_.md) | PASS | — | 2 |
| [`/dashboard/hostel/leave-passes`](pages/hostel/hostel__leave-passes.md) | PASS | — | 2 |
| [`/dashboard/hostel/me`](pages/hostel/hostel__me.md) | PASS | — | 1 |
| [`/dashboard/hostel/policies`](pages/hostel/hostel__policies.md) | PASS | — | 2 |
| [`/dashboard/hostel/reports`](pages/hostel/hostel__reports.md) | PASS | — | 2 |
| [`/dashboard/hostel/roll-call`](pages/hostel/hostel__roll-call.md) | NEEDS FIX (P1) | S-32, S-54 | 2 |
| [`/dashboard/hostel/rooms`](pages/hostel/hostel__rooms.md) | NEEDS FIX (P1) | S-32 | 2 |
| [`/dashboard/hostel/zones`](pages/hostel/hostel__zones.md) | NEEDS FIX (P1) | S-32 | 2 |

### hr

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/hr`](pages/hr/hr.md) | NEEDS FIX (P1) | S-32 | 2 |
| [`/dashboard/hr/access`](pages/hr/hr__access.md) | PASS | — | 2 |
| [`/dashboard/hr/advances`](pages/hr/hr__advances.md) | PASS | — | 2 |
| [`/dashboard/hr/awards`](pages/hr/hr__awards.md) | PASS | — | 2 |
| [`/dashboard/hr/departments`](pages/hr/hr__departments.md) | NEEDS FIX (P1) | S-6, S-43 | 2 |
| [`/dashboard/hr/designations`](pages/hr/hr__designations.md) | NEEDS FIX (P1) | S-6, S-43 | 2 |
| [`/dashboard/hr/employees`](pages/hr/hr__employees.md) | NEEDS FIX (P1) | S-6, S-32, S-43 | 2 |
| [`/dashboard/hr/employees/[id]`](pages/hr/hr__employees___id_.md) | NEEDS FIX (P1) | S-6, S-57 | 3 |
| [`/dashboard/hr/employees/new`](pages/hr/hr__employees__new.md) | NEEDS FIX (P1) | S-32 | 2 |
| [`/dashboard/hr/leave`](pages/hr/hr__leave.md) | PASS | — | 2 |
| [`/dashboard/hr/leave-management`](pages/hr/hr__leave-management.md) | PASS | — | 2 |
| [`/dashboard/hr/overview`](pages/hr/hr__overview.md) | NEEDS FIX (P1) | S-32 | 2 |
| [`/dashboard/hr/salary-advances`](pages/hr/hr__salary-advances.md) | PASS | — | 2 |
| [`/dashboard/hr/self-service`](pages/hr/hr__self-service.md) | NEEDS FIX (P1) | S-38 | 2 |

### inventory

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/inventory`](pages/inventory/inventory.md) | PASS | — | 2 |
| [`/dashboard/inventory/adjustments`](pages/inventory/inventory__adjustments.md) | NEEDS FIX (P1) | S-32 | 2 |
| [`/dashboard/inventory/categories`](pages/inventory/inventory__categories.md) | PASS | — | 2 |
| [`/dashboard/inventory/issues`](pages/inventory/inventory__issues.md) | NEEDS FIX (P1) | S-32 | 2 |
| [`/dashboard/inventory/overview`](pages/inventory/inventory__overview.md) | NEEDS FIX (P2) | S-56 | 2 |
| [`/dashboard/inventory/products`](pages/inventory/inventory__products.md) | NEEDS FIX (P1) | S-32, S-56 | 2 |
| [`/dashboard/inventory/purchases`](pages/inventory/inventory__purchases.md) | NEEDS FIX (P1) | S-32 | 2 |
| [`/dashboard/inventory/sales`](pages/inventory/inventory__sales.md) | NEEDS FIX (P1) | S-32 | 2 |
| [`/dashboard/inventory/stock`](pages/inventory/inventory__stock.md) | NEEDS FIX (P2) | S-56 | 2 |
| [`/dashboard/inventory/stores`](pages/inventory/inventory__stores.md) | PASS | — | 2 |
| [`/dashboard/inventory/suppliers`](pages/inventory/inventory__suppliers.md) | PASS | — | 2 |
| [`/dashboard/inventory/transfers`](pages/inventory/inventory__transfers.md) | NEEDS FIX (P1) | S-32 | 3 |
| [`/dashboard/inventory/units`](pages/inventory/inventory__units.md) | PASS | — | 3 |

### library

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/library`](pages/library/library.md) | PASS | — | 4 |
| [`/dashboard/library/catalog`](pages/library/library__catalog.md) | PASS | — | 4 |
| [`/dashboard/library/catalog/[id]`](pages/library/library__catalog___id_.md) | PASS | — | 2 |
| [`/dashboard/library/categories`](pages/library/library__categories.md) | PASS | — | 3 |
| [`/dashboard/library/me`](pages/library/library__me.md) | NEEDS FIX (P1) | S-32 | 4 |

### parent

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/parent`](pages/parent/parent.md) | NEEDS FIX (P2) | S-45, S-47, S-48 | 1 |
| [`/dashboard/parent/attendance`](pages/parent/parent__attendance.md) | NEEDS FIX (P2) | S-45, S-47 | 1 |
| [`/dashboard/parent/communication`](pages/parent/parent__communication.md) | NEEDS FIX (P2) | S-45, S-47 | 1 |
| [`/dashboard/parent/finance`](pages/parent/parent__finance.md) | NEEDS FIX (P2) | S-45, S-47, S-48 | 1 |
| [`/dashboard/parent/live-classes`](pages/parent/parent__live-classes.md) | NEEDS FIX (P2) | S-45, S-47 | 1 |
| [`/dashboard/parent/requests`](pages/parent/parent__requests.md) | NEEDS FIX (P2) | S-45, S-47 | 1 |
| [`/dashboard/parent/settings`](pages/parent/parent__settings.md) | NEEDS FIX (P2) | S-45, S-47 | 1 |

### portals

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/portals/guard`](pages/portals/portals__guard.md) | PASS | — | 1 |
| [`/dashboard/portals/guard/config`](pages/portals/portals__guard__config.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/portals/guard/emergency`](pages/portals/portals__guard__emergency.md) | PASS | — | 1 |
| [`/dashboard/portals/guard/incidents`](pages/portals/portals__guard__incidents.md) | PASS | — | 1 |
| [`/dashboard/portals/guard/pickups`](pages/portals/portals__guard__pickups.md) | NEEDS FIX (P1) | S-8 | 1 |
| [`/dashboard/portals/guard/scanner`](pages/portals/portals__guard__scanner.md) | PASS | — | 1 |
| [`/dashboard/portals/guard/visitors`](pages/portals/portals__guard__visitors.md) | PASS | — | 1 |
| [`/dashboard/portals/leadership`](pages/portals/portals__leadership.md) | NEEDS FIX (P2) | S-15 | 1 |
| [`/dashboard/portals/leadership/admin`](pages/portals/portals__leadership__admin.md) | NEEDS FIX (P2) | S-22 | 1 |
| [`/dashboard/portals/leadership/approvals`](pages/portals/portals__leadership__approvals.md) | NEEDS FIX (P1) | S-21 | 1 |
| [`/dashboard/portals/leadership/exceptions`](pages/portals/portals__leadership__exceptions.md) | PASS | — | 1 |
| [`/dashboard/portals/librarian`](pages/portals/portals__librarian.md) | NEEDS FIX (P2) | S-46 | 1 |
| [`/dashboard/portals/librarian/charges`](pages/portals/portals__librarian__charges.md) | PASS | — | 1 |
| [`/dashboard/portals/librarian/copies`](pages/portals/portals__librarian__copies.md) | PASS | — | 1 |
| [`/dashboard/portals/librarian/desk`](pages/portals/portals__librarian__desk.md) | PASS | — | 1 |
| [`/dashboard/portals/librarian/holds`](pages/portals/portals__librarian__holds.md) | PASS | — | 1 |
| [`/dashboard/portals/librarian/members`](pages/portals/portals__librarian__members.md) | PASS | — | 1 |
| [`/dashboard/portals/librarian/members/[id]`](pages/portals/portals__librarian__members___id_.md) | PASS | — | 1 |
| [`/dashboard/portals/librarian/policies`](pages/portals/portals__librarian__policies.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/portals/librarian/reports`](pages/portals/portals__librarian__reports.md) | PASS | — | 1 |
| [`/dashboard/portals/librarian/stocktake`](pages/portals/portals__librarian__stocktake.md) | PASS | — | 1 |
| [`/dashboard/portals/librarian/transfers`](pages/portals/portals__librarian__transfers.md) | PASS | — | 1 |

### public-auth

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/`](pages/public-auth/root.md) | PASS | — | 1 |
| [`/invitations/[token]`](pages/public-auth/invitations___token_.md) | PASS | — | 1 |
| [`/login`](pages/public-auth/login.md) | PASS | — | 7 |
| [`/signup`](pages/public-auth/signup.md) | PASS | — | 1 |
| [`/verify-document`](pages/public-auth/verify-document.md) | PASS | — | 1 |
| [`/verify/card/[token]`](pages/public-auth/verify__card___token_.md) | PASS | — | 1 |
| [`/verify/certificate/[token]`](pages/public-auth/verify__certificate___token_.md) | PASS | — | 1 |

### public-site

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/[tenantSlug]`](pages/public-site/_tenantSlug_.md) | NEEDS FIX (P3) | S-55 | 3 |
| [`/[tenantSlug]/about`](pages/public-site/_tenantSlug___about.md) | NEEDS FIX (P3) | S-55 | 2 |
| [`/[tenantSlug]/contact`](pages/public-site/_tenantSlug___contact.md) | NEEDS FIX (P3) | S-55 | 2 |
| [`/[tenantSlug]/events`](pages/public-site/_tenantSlug___events.md) | NEEDS FIX (P3) | S-55 | 2 |
| [`/[tenantSlug]/faq`](pages/public-site/_tenantSlug___faq.md) | NEEDS FIX (P3) | S-55 | 2 |
| [`/[tenantSlug]/gallery`](pages/public-site/_tenantSlug___gallery.md) | NEEDS FIX (P3) | S-55 | 2 |
| [`/[tenantSlug]/news`](pages/public-site/_tenantSlug___news.md) | NEEDS FIX (P3) | S-55 | 2 |
| [`/[tenantSlug]/news/[slug]`](pages/public-site/_tenantSlug___news___slug_.md) | NEEDS FIX (P3) | S-55 | 3 |
| [`/[tenantSlug]/services`](pages/public-site/_tenantSlug___services.md) | NEEDS FIX (P3) | S-55 | 2 |

### receptionist

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/receptionist`](pages/receptionist/receptionist.md) | PASS | — | 1 |
| [`/dashboard/receptionist/appointments`](pages/receptionist/receptionist__appointments.md) | PASS | — | 1 |
| [`/dashboard/receptionist/handoffs`](pages/receptionist/receptionist__handoffs.md) | PASS | — | 1 |
| [`/dashboard/receptionist/inquiries`](pages/receptionist/receptionist__inquiries.md) | PASS | — | 1 |
| [`/dashboard/receptionist/pickups`](pages/receptionist/receptionist__pickups.md) | NEEDS FIX (P1) | S-8 | 1 |
| [`/dashboard/receptionist/visitors`](pages/receptionist/receptionist__visitors.md) | PASS | — | 1 |

### reports

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/reports`](pages/reports/reports.md) | PASS | — | 2 |
| [`/dashboard/reports/[key]`](pages/reports/reports___key_.md) | PASS | — | 2 |
| [`/dashboard/reports/admin`](pages/reports/reports__admin.md) | PASS | — | 2 |
| [`/dashboard/reports/runs`](pages/reports/reports__runs.md) | PASS | — | 2 |
| [`/dashboard/reports/schedules`](pages/reports/reports__schedules.md) | PASS | — | 2 |

### settings

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/settings`](pages/settings/settings.md) | NEEDS FIX (P1) | S-26, S-32 | 3 |
| [`/dashboard/settings/access-reset`](pages/settings/settings__access-reset.md) | PASS | — | 1 |
| [`/dashboard/settings/accounting-defaults`](pages/settings/settings__accounting-defaults.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/settings/attendance`](pages/settings/settings__attendance.md) | PASS | — | 1 |
| [`/dashboard/settings/audit-logs`](pages/settings/settings__audit-logs.md) | NEEDS FIX (P2) | S-23 | 1 |
| [`/dashboard/settings/branches`](pages/settings/settings__branches.md) | PASS | — | 2 |
| [`/dashboard/settings/cndp`](pages/settings/settings__cndp.md) | NEEDS FIX (P1) | S-18, S-32 | 1 |
| [`/dashboard/settings/custom-fields`](pages/settings/settings__custom-fields.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/settings/domain`](pages/settings/settings__domain.md) | PASS | — | 1 |
| [`/dashboard/settings/drafts`](pages/settings/settings__drafts.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/settings/entitlements`](pages/settings/settings__entitlements.md) | PASS | — | 1 |
| [`/dashboard/settings/exports`](pages/settings/settings__exports.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/settings/jobs`](pages/settings/settings__jobs.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/settings/live-classrooms`](pages/settings/settings__live-classrooms.md) | PASS | — | 2 |
| [`/dashboard/settings/migration`](pages/settings/settings__migration.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/settings/notifications`](pages/settings/settings__notifications.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/settings/numbering`](pages/settings/settings__numbering.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/settings/onboarding`](pages/settings/settings__onboarding.md) | NEEDS TRIAGE | — | 1 |
| [`/dashboard/settings/payment-methods`](pages/settings/settings__payment-methods.md) | PASS | — | 1 |
| [`/dashboard/settings/permissions`](pages/settings/settings__permissions.md) | NEEDS FIX (P3) | S-50 | 1 |
| [`/dashboard/settings/policies`](pages/settings/settings__policies.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/settings/providers`](pages/settings/settings__providers.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/settings/scanner-devices`](pages/settings/settings__scanner-devices.md) | PASS | — | 1 |
| [`/dashboard/settings/scheduled-jobs`](pages/settings/settings__scheduled-jobs.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/settings/security`](pages/settings/settings__security.md) | PASS | — | 1 |
| [`/dashboard/settings/security/2fa`](pages/settings/settings__security__2fa.md) | PASS | — | 1 |
| [`/dashboard/settings/security/login-events`](pages/settings/settings__security__login-events.md) | PASS | — | 1 |
| [`/dashboard/settings/staff`](pages/settings/settings__staff.md) | PASS | — | 1 |
| [`/dashboard/settings/subscription`](pages/settings/settings__subscription.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/settings/translations`](pages/settings/settings__translations.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/settings/users`](pages/settings/settings__users.md) | PASS | — | 1 |
| [`/dashboard/settings/values`](pages/settings/settings__values.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/settings/website`](pages/settings/settings__website.md) | PASS | — | 2 |
| [`/dashboard/settings/website/menu`](pages/settings/settings__website__menu.md) | PASS | — | 2 |
| [`/dashboard/settings/website/news`](pages/settings/settings__website__news.md) | PASS | — | 2 |
| [`/dashboard/settings/website/pages`](pages/settings/settings__website__pages.md) | PASS | — | 2 |

### student

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/student`](pages/student/student.md) | PASS | — | 1 |
| [`/dashboard/student/live-classes`](pages/student/student__live-classes.md) | PASS | — | 1 |

### students

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/students`](pages/students/students.md) | NEEDS FIX (P2) | S-24 | 8 |
| [`/dashboard/students/[id]`](pages/students/students___id_.md) | NEEDS FIX (P3) | S-57 | 3 |
| [`/dashboard/students/add`](pages/students/students__add.md) | PASS | — | 1 |
| [`/dashboard/students/admissions`](pages/students/students__admissions.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/students/admissions/new`](pages/students/students__admissions__new.md) | PASS | — | 1 |
| [`/dashboard/students/alumni`](pages/students/students__alumni.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/students/alumni-transition`](pages/students/students__alumni-transition.md) | PASS | — | 1 |
| [`/dashboard/students/alumni/events`](pages/students/students__alumni__events.md) | NEEDS FIX (P1) | S-32 | 1 |
| [`/dashboard/students/alumni/requests`](pages/students/students__alumni__requests.md) | NEEDS FIX (P1) | S-33, S-32 | 1 |
| [`/dashboard/students/import`](pages/students/students__import.md) | PASS | — | 1 |
| [`/dashboard/students/matricules`](pages/students/students__matricules.md) | NEEDS FIX (P1) | S-24, S-32 | 1 |
| [`/dashboard/students/parents`](pages/students/students__parents.md) | PASS | — | 2 |
| [`/dashboard/students/parents/[id]`](pages/students/students__parents___id_.md) | PASS | — | 3 |
| [`/dashboard/students/photos`](pages/students/students__photos.md) | NEEDS FIX (P1) | S-34, S-32 | 1 |
| [`/dashboard/students/promotions`](pages/students/students__promotions.md) | NEEDS FIX (P1) | S-9, S-32 | 1 |
| [`/dashboard/students/transfers`](pages/students/students__transfers.md) | PASS | — | 1 |

### super-admin

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/super-admin`](pages/super-admin/super-admin.md) | NEEDS FIX (P1) | S-39, S-40, S-49 | 2 |
| [`/dashboard/super-admin/domains`](pages/super-admin/super-admin__domains.md) | PASS | — | 2 |
| [`/dashboard/super-admin/reports`](pages/super-admin/super-admin__reports.md) | PASS | — | 2 |
| [`/dashboard/super-admin/schools`](pages/super-admin/super-admin__schools.md) | PASS | — | 2 |
| [`/dashboard/super-admin/schools/[id]`](pages/super-admin/super-admin__schools___id_.md) | PASS | — | 2 |
| [`/dashboard/super-admin/schools/create`](pages/super-admin/super-admin__schools__create.md) | PASS | — | 2 |
| [`/dashboard/super-admin/settings`](pages/super-admin/super-admin__settings.md) | PASS | — | 2 |
| [`/dashboard/super-admin/sms`](pages/super-admin/super-admin__sms.md) | PASS | — | 2 |
| [`/dashboard/super-admin/subscriptions`](pages/super-admin/super-admin__subscriptions.md) | PASS | — | 2 |
| [`/dashboard/super-admin/subscriptions/list`](pages/super-admin/super-admin__subscriptions__list.md) | PASS | — | 2 |
| [`/dashboard/super-admin/support`](pages/super-admin/super-admin__support.md) | PASS | — | 2 |
| [`/dashboard/super-admin/waitlist`](pages/super-admin/super-admin__waitlist.md) | PASS | — | 2 |

### support

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/support`](pages/support/support.md) | PASS | — | 1 |

### teacher

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/teacher`](pages/teacher/teacher.md) | NEEDS FIX (P3) | S-47 | 4 |

### teachers

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/teachers`](pages/teachers/teachers.md) | PASS | — | 1 |
| [`/dashboard/teachers/[id]`](pages/teachers/teachers___id_.md) | NEEDS FIX (P3) | S-57 | 2 |
| [`/dashboard/teachers/bulk-import`](pages/teachers/teachers__bulk-import.md) | PASS | — | 1 |
| [`/dashboard/teachers/manage`](pages/teachers/teachers__manage.md) | PASS | — | 1 |

### transport

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/transport`](pages/transport/transport.md) | PASS | — | 2 |
| [`/dashboard/transport/allocations`](pages/transport/transport__allocations.md) | NEEDS FIX (P3) | S-50 | 2 |
| [`/dashboard/transport/boarding`](pages/transport/transport__boarding.md) | PASS | — | 2 |
| [`/dashboard/transport/drivers`](pages/transport/transport__drivers.md) | PASS | — | 2 |
| [`/dashboard/transport/guardian`](pages/transport/transport__guardian.md) | PASS | — | 1 |
| [`/dashboard/transport/incidents`](pages/transport/transport__incidents.md) | PASS | — | 2 |
| [`/dashboard/transport/policies`](pages/transport/transport__policies.md) | PASS | — | 2 |
| [`/dashboard/transport/reports`](pages/transport/transport__reports.md) | PASS | — | 2 |
| [`/dashboard/transport/routes`](pages/transport/transport__routes.md) | PASS | — | 2 |
| [`/dashboard/transport/stops`](pages/transport/transport__stops.md) | PASS | — | 2 |
| [`/dashboard/transport/student`](pages/transport/transport__student.md) | PASS | — | 1 |
| [`/dashboard/transport/trips`](pages/transport/transport__trips.md) | PASS | — | 2 |
| [`/dashboard/transport/vehicles`](pages/transport/transport__vehicles.md) | PASS | — | 2 |

### workforce

| Page | Status | Findings | Shots |
|---|---|---|---|
| [`/dashboard/workforce`](pages/workforce/workforce.md) | PASS | — | 3 |
| [`/dashboard/workforce/advances`](pages/workforce/workforce__advances.md) | PASS | — | 3 |
| [`/dashboard/workforce/awards`](pages/workforce/workforce__awards.md) | PASS | — | 3 |
| [`/dashboard/workforce/leave`](pages/workforce/workforce__leave.md) | PASS | — | 3 |
| [`/dashboard/workforce/payroll/adjustments`](pages/workforce/workforce__payroll__adjustments.md) | PASS | — | 3 |
| [`/dashboard/workforce/payroll/assignments`](pages/workforce/workforce__payroll__assignments.md) | NEEDS FIX (P1) | S-32 | 3 |
| [`/dashboard/workforce/payroll/components`](pages/workforce/workforce__payroll__components.md) | NEEDS FIX (P1) | S-32 | 3 |
| [`/dashboard/workforce/payroll/payments`](pages/workforce/workforce__payroll__payments.md) | NEEDS FIX (P1) | S-32, S-53 | 3 |
| [`/dashboard/workforce/payroll/payslips`](pages/workforce/workforce__payroll__payslips.md) | PASS | — | 3 |
| [`/dashboard/workforce/payroll/regulations`](pages/workforce/workforce__payroll__regulations.md) | PASS | — | 3 |
| [`/dashboard/workforce/payroll/runs`](pages/workforce/workforce__payroll__runs.md) | NEEDS FIX (P2) | S-53, S-57 | 3 |
| [`/dashboard/workforce/payroll/runs/[id]`](pages/workforce/workforce__payroll__runs___id_.md) | NEEDS FIX (P2) | S-53 | 2 |
| [`/dashboard/workforce/payroll/settings`](pages/workforce/workforce__payroll__settings.md) | PASS | — | 3 |
| [`/dashboard/workforce/payroll/structures`](pages/workforce/workforce__payroll__structures.md) | PASS | — | 3 |
| [`/dashboard/workforce/timeclock`](pages/workforce/workforce__timeclock.md) | NEEDS FIX (P1) | S-32 | 3 |

## Needs triage

- [`/dashboard/settings/onboarding`](pages/settings/settings__onboarding.md): Pass A / school_admin: console: A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happe

## Swept URLs that match no current page

Pages removed or renamed since the sweep:

- `/dashboard/communication/forms`
- `/dashboard/communication/leads`
- `/dashboard/communication/milestones`
- `/dashboard/communication/segments`
- `/dashboard/communication/templates-automation`

## Re-running

```
AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs <role> <routes.txt> [out-dir]
NO_LOGIN=1 ... anonymous <routes.txt>        # public pages
TOTP_SECRET_FILE=<secret> ... super_admin <routes.txt>
```
