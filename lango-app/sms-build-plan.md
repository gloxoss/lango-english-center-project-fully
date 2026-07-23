# Lango SMS Build Plan — The Application Layer

## Goal
Build the full School Management System (SMS) logic — CRUDs, Attendance, Finance, Data Tables — on top of the Frappe-ported database schemas. This plan picks up **after** the Frankenstein Pivot (Steps 1–7) is complete and the foundation is stable.

> **IMPORTANT:** This is **STEP 8** of the Lango OSS Pivot. It cannot be cloned from open-source because Frappe's frontend is Python/Vue and is incompatible with our Next.js/React stack. We must build it ourselves, guided by Frappe's domain logic and the `pre-dev/` specifications.

---

## Governing Principles

### From @karpathy-guidelines
- **Simplicity First.** Each CRUD is: 1 Server Action file, 1 Data Table component, 1 Form component. No speculative abstractions.
- **Surgical Changes.** Each sprint touches only its own module folder. No "improving" unrelated pages.
- **Goal-Driven.** Every task has a `Verify:` check. If it doesn't pass, loop until it does.

### From @lango-sms-context (Dynamic-First)
- **No hardcoded data in JSX.** All data flows from Server Components -> Drizzle queries -> Dumb UI components via props.
- **Tenant isolation.** Every query must filter by `tenantId`. No exceptions.
- **Server Components by default.** Client components only for interactive islands (forms, toggles, modals).

### From @lango-oss-pivot (Gloxoss-Go Gate)
- Each sprint below is a **gated step**. Stop at the end of each sprint, present results to Zakio, and wait for **"gloxoss-go"** before proceeding.

---

## Skills to Use Per Sprint

| Sprint | Skills to Apply |
|--------|----------------|
| All | `next-best-practices`, `supabase-postgres-best-practices`, `karpathy-guidelines` |
| Database | `database-design` (indexing, FK strategy) |
| UI Tables | `react-ui-patterns` (loading states, error boundaries) |
| Forms | `react-best-practices` (Server Actions, progressive enhancement) |
| Design | `design-orchestrator` -> `premium` + `sleek` (Apple-level data tables) |
| Security | `privacy-by-design`, `better-auth-best-practices` |
| i18n | Pre-installed `next-intl` + `OmitRTL` component |

---

## STEP 8A: ERP Core — Student and Academic CRUDs

### 8A.1: Extend Database Schema
- [ ] Add missing columns to existing tables: students profile fields (phone, DOB, gender, address, guardian info, photo URL, national ID) -> Verify: `drizzle-kit generate` shows new columns
- [ ] Add `attendance` table (studentId, studentGroupId, date, status [present/absent/late/excused], markedById) -> Verify: migration succeeds
- [ ] Add composite indexes: `(tenantId, date)` on attendance, `(tenantId, status)` on enrollments -> Verify: `drizzle-kit push` clean

### 8A.2: Server Actions (Backend Logic)
- [ ] `src/actions/students.ts` — `listStudents(tenantId, filters)`, `getStudent(id)`, `createStudent(data)`, `updateStudent(id, data)`, `deleteStudent(id)` -> Verify: call from a test page, see DB rows change
- [ ] `src/actions/programs.ts` — CRUD for Programs -> Verify: seed data appears
- [ ] `src/actions/courses.ts` — CRUD for Courses (scoped to programId) -> Verify: courses linked to program
- [ ] `src/actions/student-groups.ts` — CRUD for Batches -> Verify: group linked to course + academic year
- [ ] `src/actions/enrollments.ts` — `enrollStudent(studentId, groupId)`, `dropStudent(enrollmentId)`, `listByGroup(groupId)` -> Verify: enrollment count changes

### 8A.3: Data Tables UI (Frontend)
- [ ] `src/components/data-table/` — Reusable DataTable with sorting, filtering, pagination (Server-side) -> Verify: renders 50+ rows without lag
- [ ] `/dashboard/students` page — Student Directory with search, filter by status, bulk export CSV -> Verify: lists all seeded students with working filters
- [ ] `/dashboard/students/[id]` page — Student 360 Profile (tabs: Info, Academics, Enrollments, Timeline) -> Verify: all tabs render real data
- [ ] `/dashboard/academics/programs` page — Programs table + Create/Edit modal -> Verify: CRUD works end-to-end
- [ ] `/dashboard/academics/courses` page — Courses table scoped to selected program -> Verify: switching programs filters courses
- [ ] `/dashboard/academics/groups` page — Student Groups table -> Verify: shows capacity vs enrolled count

### Gate: Does the Student Directory list real DB data with working CRUD? Stop and wait for "gloxoss-go".

---

## STEP 8B: Attendance Module

### 8B.1: Attendance Server Actions
- [ ] `src/actions/attendance.ts` — `markAttendance(groupId, date, records[])`, `getAttendance(groupId, date)`, `getStudentAttendanceHistory(studentId, dateRange)` -> Verify: bulk mark 20 students in one call

### 8B.2: Attendance UI
- [ ] `/dashboard/attendance` page — Date picker + Group selector -> Fast-toggle grid (rows = students, columns = status buttons) -> Verify: teacher can mark all students in under 30 seconds
- [ ] Attendance summary stats component — % present/absent per day, per week -> Verify: numbers match DB records
- [ ] Student 360 Profile: Attendance tab — Calendar heatmap showing attendance history -> Verify: colored dots match DB

### Gate: Can a teacher mark attendance for an entire class in one screen? Stop and wait for "gloxoss-go".

---

## STEP 8C: Finance and Billing [COMPLETED]

### 8C.1: Finance Database Schema
- [x] Add tables: `fee_structures` (tenantId, name, amount, frequency, programId), `invoices` (tenantId, studentId, feeStructureId, amount, dueDate, status [pending/paid/partial/overdue]), `payments` (invoiceId, amount, method, paidAt, receiptNo), `expenses` (tenantId, category, amount, date, description, attachmentUrl) -> Verify: `drizzle-kit push` clean

### 8C.2: Finance Server Actions
- [x] `src/actions/fee-structures.ts` — CRUD for fee templates -> Verify: create a "Monthly Tuition" fee
- [x] `src/actions/invoices.ts` — `generateInvoices(groupId, feeStructureId)` (bulk), `getInvoice(id)`, `listInvoices(filters)` -> Verify: generates invoices for all students in a group
- [x] `src/actions/payments.ts` — `recordPayment(invoiceId, amount, method)`, partial payment tracking -> Verify: invoice status updates to "partial" or "paid"
- [x] `src/actions/expenses.ts` — CRUD for expenses -> Verify: expense appears in list

### 8C.3: Finance UI
- [x] `/dashboard/finance/fees` page — Fee Structures table + Create modal -> Verify: CRUD works
- [x] `/dashboard/finance/invoices` page — Invoices table with status badges (paid/pending/overdue), filter by student/status -> Verify: bulk generation populates table
- [x] `/dashboard/finance/invoices/[id]` page — Invoice detail + Payment recording form -> Verify: recording payment updates status
- [x] `/dashboard/finance/expenses` page — Expense tracker with category filters -> Verify: add/edit/delete works
- [x] `/dashboard/finance` overview page — Revenue summary cards (total collected, outstanding, expenses this month) -> Verify: numbers match DB aggregation

### Gate: Can admin generate invoices for a class and record payments? Stop and wait for "gloxoss-go".

---

## STEP 8D: Timetable and Class Scheduling

### 8D.1: Timetable Database Schema
- [ ] Add tables: `timetable_slots` (tenantId, studentGroupId, dayOfWeek, startTime, endTime, teacherId, room) -> Verify: migration clean

### 8D.2: Timetable Server Actions
- [ ] `src/actions/timetable.ts` — CRUD for slots, `getWeeklySchedule(groupId)`, `getTeacherSchedule(teacherId)` -> Verify: returns structured weekly grid

### 8D.3: Timetable UI
- [ ] `/dashboard/academics/timetable` page — Weekly calendar grid (rows = time slots, columns = days), drag-to-assign -> Verify: teacher can see their weekly schedule
- [ ] Conflict detection — Warn if same teacher/room is double-booked -> Verify: error toast on overlap

### Gate: Does the timetable render a weekly grid with real slot data? Stop and wait for "gloxoss-go".

---

## STEP 8E: Assessments and Grading [COMPLETED]

### 8E.1: Assessments Schema
- [x] Add tables: `grading_scales` (tenantId, name, grades JSON), `assessment_plans` (tenantId, name, courseId, groupId, maxScore), `assessment_results` (tenantId, planId, studentId, score, grade, remarks)

### 8E.2: Assessments Server Actions
- [x] `src/actions/assessments.ts` — CRUD for grading scales, plans, and results. Bulk record results for a group.

### 8E.3: Assessments UI
- [ ] `/dashboard/academics/assessments/[id]` — Spreadsheet-like grid to enter scores for all students in the group.

### Gate: Can a teacher enter grades for an assessment and see calculated grades? Stop and wait for "gloxoss-go".

---

## STEP 8F: Student Leaves

### 8F.1: Leaves Schema
- [ ] Add table: `student_leaves` (tenantId, studentId, startDate, endDate, reason, status [pending/approved/rejected])

### 8F.2: Leaves Server Actions
- [ ] `src/actions/student-leaves.ts` — Submit leave, approve/reject leave.

### 8F.3: Leaves UI
- [ ] `/dashboard/students/leaves` — List of all leave requests. Admin can approve/reject.
- [ ] Integrates with Attendance: Approved leaves automatically mark student as 'excused' in the attendance grid.

### Gate: Can a leave be approved and reflect in attendance? Stop and wait for "gloxoss-go".

---

## STEP 8G: Student Discipline [COMPLETED]

### 8G.1: Discipline Schema
- [x] Add table: `student_discipline` (tenantId, studentId, date, infraction, actionTaken, reportedById)

### 8G.2: Discipline UI
- [x] `/dashboard/students/[id]` (Student 360) — Add a "Discipline" tab to record and view behavioral incidents.

### Gate: Can an admin record a disciplinary action on a student's profile? Stop and wait for "gloxoss-go".

---

## STEP 8H: Certificates

### 8H.1: Certificates Schema
- [ ] Add table: `certificates` (tenantId, studentId, courseId, issueDate, templateName)

### 8H.2: Certificates UI
- [ ] `/dashboard/academics/certificates` — Generate and view course completion certificates for students.

### Gate: Can an admin generate a certificate? Stop and wait for "gloxoss-go".

---

## Done When
- [ ] Student Directory lists real students with working Create/Edit/Delete
- [ ] Attendance grid allows bulk marking per class per day
- [ ] Finance module generates invoices and records payments
- [ ] Timetable shows weekly schedule with conflict detection
- [ ] Assessments, Leaves, Discipline, and Certificates are fully functional
- [ ] All pages use Server Components + Drizzle queries (no mocked data)
- [ ] All queries filter by `tenantId` (multi-tenant safe)
- [ ] RTL layout works on all new pages (Arabic)

## Notes
- Each "Step 8X" sprint should take ~2-4 hours of focused AI-assisted development.
- The order (A -> H) is deliberate: Core entities must exist before edge features.
- We do NOT build CRM, LMS video hosting, WhatsApp, or AI modules in this plan. Those are separate future phases per `pre-dev/PROGRESS.md` (Phases 4-5).
