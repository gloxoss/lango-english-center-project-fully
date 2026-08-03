# 05 — Role Portals Prompt Pack

## Shared portal contract

Create one responsive portal shell driven by a server-generated manifest. It includes identity/role/tenant context, scoped search, notifications, language switcher, accessible navigation, profile/security, offline indicator where supported, and session-expiry recovery. Each portal consumes shared domain APIs with narrower permissions. Never duplicate business logic or expose admin navigation by hiding it only in CSS.

## RP-01 — Teacher portal

**Routes:** `/portal/teacher`, `/today`, `/classes`, `/classes/[id]`, `/attendance`, `/homework`, `/marks`, `/schedule`, `/messages`. **Objective:** make today’s teaching work reachable in one or two taps. **Dashboard layout:** next lesson, missing registers, homework needing review, mark deadlines, announcements. **Core pages:** class roster with privacy-safe learner context; rapid attendance; homework composer/submissions; mark-entry grid; personal published schedule; scoped messaging. **Actions:** start class attendance, publish work, return/grade submission, enter/submit marks, message allowed audiences. **States:** no assignment, schedule changed, offline draft, locked term, forbidden learner record. **Acceptance:** teacher limited to effective assignments and approved student fields. **Exclude:** tenant-wide finance or guardian custody details.

## RP-02 — Student portal

**Routes:** `/portal/student`, `/schedule`, `/homework`, `/homework/[id]`, `/attendance`, `/results`, `/fees`, `/resources`, `/exams`, `/messages`, `/profile`. **Objective:** clearly answer “What do I need to do, what changed, and how am I doing?” **Dashboard:** today timeline, due work, recent feedback, attendance notice, fee notice if policy permits. **Actions:** submit work, join live class, take exam, download resource/result, ask scoped question. **States:** no work, overdue, result not published, restricted financial view, offline pending upload. **Acceptance:** accessible mobile-first experience, child-safe privacy, no comparison/rank unless policy enables it. **Exclude:** changing official identity data directly.

## RP-03 — Parent/guardian portal

**Routes:** `/portal/parent`, `/children/[id]`, `/attendance`, `/homework`, `/results`, `/invoices`, `/payments`, `/consents`, `/messages`. **Objective:** switch safely between linked children and complete common family tasks. **Dashboard:** child switcher, alerts, attendance, assignments, announcements, balances. **Actions:** submit excuse, pay invoice, download receipt, acknowledge consent, update permitted contact preference, message school. **States:** relationship pending, limited custody scope, payment pending, no linked child. **Acceptance:** every child query checks active guardianship; payer permissions separate from educational visibility. **Exclude:** showing one child’s data while another child is selected.

## RP-04 — Accountant portal

**Routes:** `/portal/accountant`, `/cashier`, `/receivables`, `/payments`, `/reconciliation`, `/expenses`, `/close`, `/reports`. **Objective:** focus finance staff on queues, controls, and traceability. **Dashboard:** collection today, overdue aging, unmatched payments, approval tasks, cash variance, close blockers. **Actions:** collect, reconcile, issue copy, draft voucher, approve within segregation policy, run statements. **States:** provider degraded, closed period, unbalanced draft, approval conflict. **Acceptance:** finance capability matrix and branch restrictions enforced. **Exclude:** academic editing.

## RP-05 — Receptionist portal

**Routes:** `/portal/reception`, `/leads`, `/admissions`, `/appointments`, `/visitors`, `/directory`, `/messages`. **Objective:** handle front-desk intake quickly without broad record access. **Dashboard:** expected visitors, appointments, new leads, incomplete applications, pickup alerts. **Actions:** capture inquiry, book appointment, check visitor in/out, find authorized contact, start admission. **States:** duplicate applicant, restricted contact, late visitor checkout, emergency notice. **Acceptance:** masked data until purpose/access confirmed; visitor retention policy. **Exclude:** grades, detailed finance, HR files.

## RP-06 — Librarian portal

**Routes:** `/portal/librarian`, `/circulation`, `/catalog`, `/members`, `/overdues`, `/stocktake`, `/reports`. **Objective:** support barcode/keyboard-efficient circulation and inventory. **Dashboard:** due today, overdue, reservations ready, stocktake variance. **Actions:** issue, return, renew, reserve, collect fine through finance handoff, mark lost/damaged, scan stock. **States:** member blocked, item unavailable, duplicate scan, fine pending. **Acceptance:** circulation transaction atomic and borrower scope safe. **Exclude:** collecting unposted cash outside finance.

## RP-07 — Employee self-service portal

**Routes:** `/portal/employee`, `/attendance`, `/leave`, `/advances`, `/payslips`, `/profile`, `/documents`, `/awards`. **Objective:** let staff manage personal workforce tasks. **Dashboard:** attendance anomaly, leave balance, request status, latest payslip. **Actions:** request correction/leave/advance, download own payslip, update permitted profile fields. **States:** insufficient balance, payroll locked, approval pending, restricted document. **Acceptance:** employee sees own records only unless managerial scope. **Exclude:** editing salary assignments.

## RP-08 — Guard/security portal

**Routes:** `/portal/guard`, `/visitors`, `/pickup`, `/incidents`, `/emergency`. **Objective:** provide a low-distraction, mobile/tablet queue for authorized entry, pickup, and incidents. **Actions:** verify pass, check in/out, confirm authorized pickup, escalate incident. **States:** expired/invalid pass, pickup not authorized, offline verification cache expired, emergency mode. **Acceptance:** minimum PII, prominent timestamp/photo if consented, full audit, no bulk browsing. **Exclude:** academic/finance access and facial recognition.

## RP-09 — Leadership portal

**Routes:** `/portal/leadership`, `/academics`, `/attendance`, `/finance`, `/workforce`, `/operations`, `/risks`. **Objective:** show trustworthy exceptions and trends with drill-through to authorized evidence. **Dashboard:** freshness-stamped KPIs, target comparisons, unresolved control exceptions, upcoming decisions. **Actions:** filter branch/period, open governed report, assign follow-up, acknowledge risk. **States:** stale/incomplete data, permission-limited metric, no baseline. **Acceptance:** every metric links to definition/source and never fabricates empty values. **Exclude:** vanity metrics and individual surveillance leaderboards.

## RP-10 — Alumni portal

**Routes:** `/portal/alumni`, `/profile`, `/directory`, `/events`, `/documents`, `/privacy`. **Objective:** maintain opt-in alumni relationships and verified document access. **Actions:** update profile, control directory visibility, RSVP, request certificate, withdraw consent. **States:** verification pending, hidden profile, expired document link. **Acceptance:** explicit consent and minimal public fields. **Exclude:** automatic public directory enrollment.

## Verification prompt

For every portal, test direct URL denial, object scope, role switching, child switching, stale membership, revoked session, mobile/desktop, Arabic RTL, keyboard/screen reader, loading/empty/error/offline states, notification deep links, and parity with shared domain services.
