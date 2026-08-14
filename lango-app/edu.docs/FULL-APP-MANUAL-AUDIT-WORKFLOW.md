# SchoolOS — Full Application Manual Audit Workflow

Local app: `http://localhost:3000` (redirects to `/fr`). Login: `http://localhost:3000/fr/login`.
Password for every account below: **`Admin123!`**

> A parallel automated Playwright audit (screenshots + console/network inspection per role) is running in the background alongside this manual pass — see the note at the bottom.

---

## 1. Login credentials

| Role | Email | Tenant | Notes |
|---|---|---|---|
| Super Admin | `superadmin@schoolos.ma` | — (platform-wide) | **2FA is ON** for this account (could not disable — blocked by permission policy). On the OTP screen, click "Recevoir un code par e-mail", then ask me to look up the code (I can read it from `two_factor_otps`, read-only). |
| School Admin | `y.elamrani@atlas.ma` | Groupe Scolaire Atlas | |
| School Admin | `admin@lango.ma` | Lango Center | Use this + Atlas admin together to test cross-tenant isolation |
| Teacher | `prof.01@atlas.ma` | Atlas | |
| Teacher | `sara.bennis@lango.ma` | Lango | |
| Accountant | `accountant@atlas.ma` | Atlas | |
| Accountant | `accountant@lango.ma` | Lango | |
| Student | `etudiant.0001@atlas.ma` | Atlas | |
| Parent | `parent.001@atlas.ma` | Atlas | |
| Receptionist | `rec-lango-user@placeholder.local` | Lango | |
| Guard | `guard.demo@atlas.ma` | Atlas | Newly created this session |
| Librarian | `librarian.demo@atlas.ma` | Atlas | Newly created this session |
| Alumni | — | — | **No account exists.** `alumni` role has zero seeded users; would need a fresh one created + an `alumni_transitioned_at` record to test properly. Flag to me if you want this created. |

**Two-tenant testing**: Atlas (`admin@lango.ma`... wait, use `y.elamrani@atlas.ma`) and Lango (`admin@lango.ma`) school-admin accounts exist specifically so you can confirm one tenant never sees another's data — this is the single most important thing to break if you can.

---

## 2. Page inventory by role

Every URL below is relative to `http://localhost:3000/fr/dashboard/`. A page listed under one role may also be reachable (with reduced/different capability) by `school_admin`/`super_admin` per this app's oversight convention — test the primary role first, then confirm the oversight role sees appropriately scoped data, not a leak.

### Super Admin only (`super-admin/*`)
```
super-admin                          (landing)
super-admin/schools
super-admin/schools/create
super-admin/schools/[id]
super-admin/domains
super-admin/subscriptions
super-admin/subscriptions/list
super-admin/settings
super-admin/sms
super-admin/reports
super-admin/support
```
**Just fixed this session**: these 11 pages plus 7 guard pages had *zero* server-side role gating until a few minutes ago — any logged-in user of any role could reach them directly by URL. Worth specifically re-testing: log in as `prof.01@atlas.ma` (teacher) and try navigating directly to `http://localhost:3000/fr/dashboard/super-admin` — it must now redirect you away, not render.

### School Admin (core management — `school_admin` + `super_admin`)
```
academics/mediums, academics/sections, academics/subjects, academics/semesters,
academics/streams, academics/shifts, academics/optional-subjects,
academics/classes, academics/classes/[id], academics/class-subjects,
academics/class-section-teachers, academics/rooms, academics/schedule,
academics/conflicts, academics/teacher-schedule, academics/session-copy,
academics/promotions, academics/readiness, academics/results,
academics/grading/policies, academics/question-bank, academics/syllabus,
academics/assessment/exam-master, academics/assessment/homework,
academics/assessment/online-exams, academics/grades/entry,
academics/evaluations, academics/exams, academics/assignments,
academics/calendar, academics/live-class, academics/live-class/[id],
academics/live-class/new, academics/live-class-reports

students, students/[id], students/add, students/admissions,
students/admissions/new, students/import, students/matricules,
students/parents, students/parents/[id], students/photos,
students/promotions, students/transfers, students/alumni,
students/alumni-transition, students/alumni/events, students/alumni/requests

teachers/manage, teachers/[id], teachers/bulk-import

attendance, attendance/audit, attendance/badges, attendance/excuses,
attendance/flags, attendance/flags/[id], attendance/qr-reports, attendance/scanner

finance/*  (see Accountant section — school_admin has full oversight access)
hr/*, workforce/*  (see HR/Payroll section)
inventory/*  (see Inventory section)
hostel/*, transport/*, library/*  (see respective addon sections)
events, cards/*, certificates/*, broadcast/*, communication/*
content/library, content/types, documents/generator
reports/*, analytics

settings, settings/access-reset, settings/accounting-defaults,
settings/attendance, settings/audit-logs, settings/branches, settings/cndp,
settings/custom-fields, settings/domain, settings/drafts,
settings/entitlements, settings/exports, settings/jobs,
settings/live-classrooms, settings/migration, settings/notifications,
settings/numbering, settings/onboarding, settings/payment-methods,
settings/permissions, settings/policies, settings/providers,
settings/scanner-devices, settings/scheduled-jobs, settings/security,
settings/security/2fa, settings/security/login-events, settings/staff,
settings/subscription, settings/translations, settings/users, settings/values,
settings/website, settings/website/menu, settings/website/news, settings/website/pages
```

### Accountant (`accountant` + `school_admin`)
```
accountant                                       (landing)
finance, finance/invoices, finance/invoices/[id], finance/payments,
finance/payments/new, finance/receivables, finance/reminders,
finance/refunds, finance/credit-notes, finance/fee-types,
finance/fee-structures, finance/fee-assignments, finance/fine-policies,
finance/allocation, finance/collection-desk, finance/online-payments,
finance/reports, finance/reconciliation, finance/bank-reconciliation,
finance/approvals, finance/journal, finance/chart-of-accounts,
finance/expenses, finance/expenses/new, finance/office-accounting,
finance/accounting/accounts, finance/accounting/transactions,
finance/accounting/statements, finance/accounting/periods,
finance/accounting/voucher-types, finance/accounting/expenses,
finance/accounting/deposits/new, finance/accounting/student-accounting
```

### Teacher (`teacher`)
```
teacher                       (landing / self-service workspace)
```
Teachers also use several `academics/*` pages listed above (grade entry, live classes, homework) depending on capability.

### Student (`student`)
```
student                       (landing)
student/live-classes
homework, homework/submissions
library/me
hostel/me
transport/student
```

### Parent (`parent`)
```
parent                        (landing)
parent/attendance
parent/communication
parent/finance
parent/live-classes
parent/requests
parent/settings
hostel/guardian
transport/guardian
```

### Receptionist (`receptionist` + `school_admin`)
```
receptionist                  (landing)
receptionist/appointments
receptionist/handoffs
receptionist/inquiries
receptionist/pickups
receptionist/visitors
```

### Guard (`guard` + `school_admin`) — just fixed the missing gate this session
```
portals/guard                 (landing)
portals/guard/config
portals/guard/emergency
portals/guard/incidents
portals/guard/pickups
portals/guard/scanner
portals/guard/visitors
```

### Librarian (`librarian` + `school_admin`)
```
portals/librarian              (landing)
portals/librarian/catalog... (library/catalog, library/catalog/[id], library/categories — shared with school_admin)
portals/librarian/charges
portals/librarian/copies
portals/librarian/desk
portals/librarian/holds
portals/librarian/members
portals/librarian/policies
portals/librarian/reports
portals/librarian/stocktake
portals/librarian/transfers
```

### School Leadership (delegated scope — `school_admin` implicit, others via granted scope)
```
portals/leadership              (landing)
portals/leadership/admin
portals/leadership/approvals
portals/leadership/exceptions
```

### HR / Payroll (`school_admin`, employee self-service for any staff role)
```
hr                              (landing)
hr/overview, hr/departments, hr/designations, hr/employees, hr/employees/[id],
hr/employees/new, hr/access, hr/leave, hr/leave-management, hr/advances, hr/awards
hr/self-service                 (any authenticated staff — employee-self-service-portal)

workforce                       (landing)
workforce/leave, workforce/advances, workforce/awards, workforce/timeclock
workforce/payroll/runs, workforce/payroll/runs/[id], workforce/payroll/payslips,
workforce/payroll/payments, workforce/payroll/components, workforce/payroll/structures,
workforce/payroll/assignments, workforce/payroll/adjustments,
workforce/payroll/regulations, workforce/payroll/settings
```

### Addon modules (school_admin-owned, some with self-service sub-views)
```
inventory, inventory/products, inventory/categories, inventory/stock,
inventory/stores, inventory/suppliers, inventory/purchases, inventory/sales,
inventory/issues, inventory/adjustments, inventory/transfers,
inventory/units, inventory/overview

hostel, hostel/hostels, hostel/hostels/[id], hostel/zones, hostel/rooms,
hostel/categories, hostel/allocations, hostel/allocations/[id],
hostel/applications, hostel/board, hostel/roll-call, hostel/leave-passes,
hostel/policies, hostel/reports

transport, transport/routes, transport/stops, transport/vehicles,
transport/drivers, transport/allocations, transport/trips, transport/boarding,
transport/incidents, transport/policies, transport/reports

events (event-management)
cards, cards/students, cards/employees, cards/admit-cards, cards/templates,
cards/templates/[id]/edit, cards/issued, cards/jobs
certificates, certificates/definitions, certificates/definitions/[id],
certificates/issue/students, certificates/issue/employees, certificates/issued,
certificates/issued/[id], certificates/jobs, certificates/requests,
certificates/templates, certificates/templates/[id]/edit, certificates/settings

broadcast, broadcast/campaigns, broadcast/campaigns/[id], broadcast/templates,
broadcast/segments, broadcast/connections, broadcast/automations, broadcast/reports
communication/crm, communication/leads, communication/broadcast,
communication/campaign-composer, communication/templates,
communication/templates-automation, communication/segments,
communication/events, communication/forms, communication/milestones,
communication/reminders, communication/delivery-reports

content/library, content/types, documents/generator
reports, reports/[key], reports/admin, reports/runs, reports/schedules
```

### Public site (school-website-cms — no login required)
```
http://localhost:3000/fr/<tenant-slug>              (e.g. /fr/atlas or /fr/lango)
/fr/<tenant-slug>/about, /gallery, /faq, /contact, /services, /news, /news/[slug]
```
Confirm the reverse: a tenant with **no** theme configured shows a safe "coming soon" state, never another tenant's content, and that image URLs don't leak across tenant slugs.

---

## 3. What to check per page (the checklist from your message, structured)

1. **Renders without error** — no white screen, no unhandled exception overlay.
2. **Data is real and role-correct** — not hardcoded/mock, not another tenant's or another role's data.
3. **Every button/input does what it says** — creates/edits/deletes the right thing, shows a real success/error state (French copy, per this app's convention), no dead buttons.
4. **Console tab**: zero uncaught errors/warnings on normal use. Red flags: React hydration mismatches, failed fetches, exposed stack traces.
5. **Network tab**:
   - Every API response is scoped to the logged-in tenant/role — try changing an `id` in a request URL to something from the *other* tenant and confirm 403/404, never 200 with data.
   - No secrets (passwords, tokens, internal IDs beyond what's needed) in response bodies.
   - Try resubmitting a form's POST/PATCH request from DevTools with a tampered body (e.g. a different `tenantId`, a negative amount, a role field) — must be rejected server-side, not just hidden client-side.
   - Try basic injection payloads in text inputs (`' OR '1'='1`, `<script>alert(1)</script>`, long strings) in search boxes and free-text fields — must be safely escaped/rejected, never reflected unescaped or causing a 500.
6. **Rate/spam**: rapid repeated submits (e.g. double-click a "create" button) must not create duplicates — this app uses idempotency/CAS patterns in several places; worth deliberately double-submitting invoices, registrations, and payments.

---

## 4. Known open items (don't re-report these — already tracked)

- Two build-blocking / hardening items were actively being fixed as this doc was written: a Turbopack workspace-root panic, and 15 previously-unguarded super-admin/guard pages (fix in progress/just applied). If you hit a page that 500s or doesn't redirect correctly for the wrong role, tell me — it's possible you caught something mid-fix.
- `online-examinations` addon is intentionally not wired (documented decision, not a bug) — `academics/assessment/online-exams` uses the older, live path; a separate `OnlineExamService` was found dead/unwired and its fate was being resolved as this doc was written.
- Live-classrooms: RTL/logical-CSS-property gaps are known and app-wide (not fixed this session, not unique to one feature).

---

## 5. Automated audit (running in parallel)

I'm launching background Playwright agents to do the same pass programmatically — screenshot every page per role, capture console/network output, and flag anomalies. Given the page count (~250 routes × ~10 roles), this runs in waves rather than instantly; I'll report findings as they land. Your manual pass and mine should surface different things — you'll catch UX/logic issues I'd miss, the automated pass is better at exhaustively hitting every route and catching console/network-level issues at scale.
