# Complete Feature Inventory

Machine-readable version with status/confidence/evidence: `feature-status-matrix.csv`. This document adds business purpose, roles, and access instructions per module — the fields the CSV doesn't carry well. Status definitions match the request's own taxonomy (Complete and verified / Complete but insufficiently tested / Partially complete / UI only / Backend only / Planned only / Blocked / Broken / Deprecated).

For every module, "how to access" assumes a running dev server (`npm run dev`) and a seeded tenant (the Atlas tenant, per `seed-full.ts`, is the richest demo dataset in the repo).

---

## 1. Super Admin
**Purpose:** platform operator's control plane — manage schools/tenants, addon entitlements, subscriptions, plan limits.
**Roles:** `super_admin` only.
**Access:** `/[locale]/dashboard/super-admin` — requires a super-admin account (not tenant-scoped).
**Status:** Complete but insufficiently tested. School-detail consolidation (§1.3) and plan-limits enforcement (`plan-limits-service.ts`) confirmed real this session. Santé & Infrastructure page remains a `ComingSoonView` stub.

## 2. Students
**Purpose:** student directory, admissions pipeline, matricule management, guardians, promotions.
**Roles:** `school_admin`, `teacher` (read access to directory).
**Access:** `/dashboard/students`.
**Status:** Complete but insufficiently tested. Directory has real pagination + sticky detail panel (fixed this session); no row-level action buttons yet; photo management is single-photo-per-student only, no gallery.

## 3. Alumni
**Purpose:** manage former students, alumni self-service portal, records requests.
**Roles:** `school_admin` (admin side), `alumni` (self-service portal).
**Access:** `/dashboard/students/alumni` (admin), alumni self-service via their own login.
**Status:** Partially complete. Transition logic and the request kanban (5-stage: received/accepted/preparing/ready/taken-or-refused) are real; the transition itself remains fully manual, no scheduled trigger.

## 4. Events
**Purpose:** school event calendar, RSVP/attendance, communications.
**Roles:** `school_admin` creates/manages; all roles can view per audience targeting.
**Access:** `/dashboard/events`.
**Status:** Partially complete, **with active build errors**. Edit capability was recently added but has 2 unresolved TypeScript errors as of this audit (see `07-testing-results.md`) — do not demo the edit flow until fixed.

## 6. Academics
**Purpose:** classes, sections, subjects, timetable, promotions, question bank, readiness dashboard.
**Roles:** `school_admin`, `teacher`.
**Access:** `/dashboard/academics/*`.
**Status:** Partially complete. This is the largest module by feature count and has the most confirmed-open items — see `feature-status-matrix.csv` row 6 and the backlog CSV's Academics rows (7 of the ~25 total remaining items are here).

## 7. Personnel / HR (teacher directory — the older module)
**Purpose:** teacher directory and profile management. Largely superseded in practice by module 17 (the newer HR module), but still the route `/dashboard/teachers/manage` in active use.
**Roles:** `school_admin`.
**Access:** `/dashboard/teachers/manage`.
**Status:** Complete and verified. The admin-vs-self-service routing bug (admins seeing the teacher's own dashboard instead of an admin view) is confirmed fixed via a new `teacher-admin-detail-view.tsx`.

## 8. Attendance
**Purpose:** daily attendance, QR badge check-in, excuse justification, flags/alerts, teacher time-clock.
**Roles:** `school_admin`, `teacher`.
**Access:** `/dashboard/attendance/*`.
**Status:** Complete but insufficiently tested. The kiosk scanner now has real camera-based scanning (`getUserMedia`), confirmed this session — a genuinely large, previously-missing capability.

## 9. Documents — Cards & Convocations
**Purpose:** ID card and exam-convocation issuance for students and staff.
**Roles:** `school_admin`.
**Access:** `/dashboard/cards/*`.
**Status:** Partially complete. Core issuance/verification/revocation pipeline is real; PDF-render bug confirmed fixed (`normalizeBasePdf()`); no profile-page issuance entry point or auto-issuance trigger yet.

## 10. Examinations / Assessment
**Purpose:** exam halls, seat allocation, scheduling, marksheet entry, homework/devoir grading.
**Roles:** `school_admin`, `teacher`.
**Access:** `/dashboard/academics/assessment/*`.
**Status:** Partially complete, **with an active build error** in `homework-service.ts` (invalid `leftJoin` import — see `07-testing-results.md`). The UUID-based épreuve picker was confirmed replaced with real dropdowns (`exam-planning-client.tsx`, `evaluations-client.tsx`) this session.

## 12. Library / Bibliothèque
**Purpose:** two systems under one sidebar area — a document/resource library and a physical book circulation system.
**Roles:** `school_admin`, `librarian` (circulation desk).
**Access:** `/dashboard/content/library` (resources), `/dashboard/portals/librarian` (circulation).
**Status:** Partially complete. Naming collision resolved (renamed to "Médiathèque"); resource records still cannot be edited after creation (no PUT/PATCH route exists).

## 13. Finance
**Purpose:** the largest single module — cashier/collection, invoicing, the double-entry accounting subledger, fee structures, and (via a separate deep-rebuild plan) the full Student Accounting lifecycle.
**Roles:** `school_admin`, `accountant`.
**Access:** `/dashboard/finance/*`.
**Status:** Complete but insufficiently tested. The accounting subledger (ledger, statements, periods, student-accounting mappings) is confirmed some of the most solid code in the repo. **One unresolved architectural issue**: Office Accounting's simple expense log is still disconnected from the real GL ledger, and a prior claim that this was fixed was independently found false this session — see `13-risks-security-and-technical-debt.md`.

## 14. Inventory & School-Shop Addon
**Purpose:** supplies, purchases, school-shop sales to students, equipment loans.
**Roles:** `school_admin`, `accountant`.
**Access:** `/dashboard/inventory/*`.
**Status:** Complete and verified, per the original 2026-08 review; no regressions found this session.

## 15. Broadcast / Communication
**Purpose:** SMS/email/WhatsApp campaigns, lead-CRM inquiries pipeline.
**Roles:** `school_admin`.
**Access:** `/dashboard/communication/*`, `/dashboard/broadcast/*`.
**Status:** Complete but insufficiently tested. The "generic error" UX bug is confirmed fixed (now surfaces a distinct "addon not activated" state).

## 16. Report Cards / Bulletins
**Purpose:** Moroccan-scale student report card generation.
**Roles:** `school_admin`, `teacher`.
**Access:** `/dashboard/documents/generator`.
**Status:** Complete but insufficiently tested. Real batch-generation and a scoped print stylesheet are confirmed added this session's window — this was previously the thinnest single feature in the whole app.

## 17. HR / Personnel — Payroll & Self-Service
**Purpose:** the newer, richer HR module — employee directory, Moroccan payroll (CNSS/AMO/IR), leave, self-service portal.
**Roles:** `school_admin`, `accountant` (payroll review only), employees (self-service).
**Access:** `/dashboard/hr/*`, `/dashboard/workforce/*`, self-service at `/dashboard/hr/self-service`.
**Status:** Complete but insufficiently tested. 5 of 6 flagged raw-JSON payroll sub-pages now have real forms per this session's verification.

## 18. Sécurité & Gardiens (Guard Portal)
**Purpose:** visitor check-in, student pickup/dismissal, security incidents, emergency mode.
**Roles:** `guard`.
**Access:** `/dashboard/portals/guard/*`.
**Status:** Complete but insufficiently tested. Both confirmed bugs (incident-create dialog, reopen-closed-incident) fixed this session.

## 19. Hostel / Internat
**Purpose:** boarding-school residence management — allocations, roll call, leave passes, policies.
**Roles:** `school_admin`.
**Access:** `/dashboard/hostel/*`.
**Status:** Complete but insufficiently tested. Historically the cleanest module in the whole app (its own regression test suite existed before this audit). The one persistent bug (`state=all` crash on the reports page) is self-reported fixed as of 2026-08-24 by a concurrent agent — **not independently re-verified this specific audit pass**, flagged accordingly.

## 20. Transport
**Purpose:** bus routes, stops, vehicles, driver crew, student allocations, boarding scans.
**Roles:** `school_admin`.
**Access:** `/dashboard/transport/*`.
**Status:** Complete and verified. The one confirmed-mock page (Règles & Politiques) now has a real API route. Two new pages (`guardian/`, `student/` — self-service portals) appeared in the 2026-08-24 commit and were not independently audited this session.

## 21. Reports & Analytics
**Purpose:** a governed, cross-module report catalog with async generation, scheduling, and an admin console.
**Roles:** `school_admin`, `super_admin`.
**Access:** `/dashboard/reports/*`.
**Status:** Complete and verified — one of the most mature modules in the codebase per the original review.

## 22. Settings
**Purpose:** the platform's own configuration surface — 30 sub-pages covering everything from users/roles to website CMS.
**Roles:** `school_admin` (most pages), `super_admin` (some).
**Access:** `/dashboard/settings/*`.
**Status:** Complete and verified. All 30 pages confirmed real and guarded; the addon catalog is now confirmed DB-driven, closing the last open item from the original review.

## 23. Student Accounting (separate deep-rebuild plan)
**Purpose:** the fee/receivables subledger specifically — fee types, structures, allocation runs, invoice lifecycle, payments, reversals/refunds, fine policies, reminders, payment gateways.
**Roles:** `school_admin`, `accountant`.
**Access:** overlaps with module 13's Finance routes.
**Status:** Complete but insufficiently tested. **Self-reported** by the same working process this audit is reviewing — Phases A through H are claimed complete, with migrations 0118-0127 as supporting evidence and 4 real vitest test files present. Not independently re-verified line-by-line this pass; confidence marked Low specifically because of that, not because anything found was wrong.
