# User & Admin Guide — by Role

Only roles actually found gated in code this session are covered. Nothing here is invented. Navigation paths assume the app is running and the reader is signed in with an account of the stated role, against a seeded tenant.

## Signing in (all roles)

Navigate to `/[locale]/login` (e.g. `/fr/login`). Enter email + password. On success, you land on `/dashboard`, which redirects per-role to that role's landing page (a capability-driven redirect, confirmed real for the Accountant role at minimum — commit `6c52742`, 2026-08-05).

---

## `super_admin`

**Access:** the entire platform across all tenants, plus `/dashboard/super-admin/*`.
**Navigation:** Super Admin section in the sidebar — Schools, Waitlist, Subscriptions, Plans & Modules, SMS, Support, Reports, Settings.
**Key workflow — manage a school:** Super Admin → Schools → select a school → the consolidated detail view covers plan tier, subscription status, activate/deactivate, per-addon entitlement toggles, and license/payment history in one screen (consolidated this audit period, per §1.3 of the underlying review).
**Common errors:** none specifically documented; if a school's addon toggle doesn't take effect, check `plan-limits-service.ts`'s capacity enforcement first.

## `school_admin`

**Access:** everything within their own tenant — the broadest single role.
**Navigation:** full sidebar — Students, Academics, Attendance, Finance, HR/Workforce, Library, Hostel, Transport, Cards, Events, Settings, Reports.
**Key workflow — admit a student:** Students → Demandes Admission → review → interview scheduling (real) → checklist → Approuver, which atomically reserves a matricule, creates the student record, links the guardian, and issues login access.
**Key workflow — collect a payment:** Finance → Guichet de Caisse → open a cashier session → search the student → select outstanding invoices → collect → a receipt is generated.
**Common errors:** "no matricule available" should not occur (auto-reserved on creation); if it does, check `matricule.ts`'s `reserveMatricule()` path directly.

## `teacher`

**Access:** their assigned classes/subjects — attendance recording, grading, homework.
**Navigation:** Présence, Devoirs & Évaluations, Emploi du temps enseignant, "Mes classes" on their own portal home.
**Key workflow — grade a devoir:** Academics → Devoirs & Évaluations → select a devoir → grade individual submissions. **As of this audit, only the teacher who created the devoir can grade it** (ownership check confirmed real, commit-verified this session) — a school_admin can still grade any devoir as an override.
**Common errors:** "Vous ne pouvez noter que vos propres devoirs" (403) if attempting to grade a colleague's devoir — this is intentional, not a bug.

## `accountant`

**Access:** finance-specific — invoices, payments, the accounting ledger, receivables, and (as of this audit period) read-only payroll review.
**Navigation:** the dedicated Accountant Portal — this is the most thoroughly self-audited module in the repo (two documented internal audit-and-fix rounds, 2026-08-05).
**Key workflow — close a cashier session:** Finance → Guichet de Caisse → close session → reconciliation is enforced (cashier-session enforcement was one of "3 disclosed gaps" explicitly closed on 2026-08-05).
**Common errors:** if payroll pages appear inaccessible, check that the `payroll.review` capability is actually granted to the account — this repo's own audit found one genuine role/capability mismatch here (accountant listed in `allowedRoles` for `/dashboard/workforce` but not always granted the matching capability) which was subsequently fixed.

## `receptionist`

**Access:** students/guardians/admissions — front-desk workflows.
**Navigation:** Students directory, Admissions, Parents & Tuteurs.
**Key workflow:** front-desk data entry and lookup for admissions and guardian contact management.

## `librarian`

**Access:** the physical-book circulation system specifically (distinct from the general "resource library" area, which is `school_admin`-managed).
**Navigation:** `/dashboard/portals/librarian` — Comptoir de prêt (checkout desk), Catalogue.
**Key workflow — checkout/return:** Comptoir de prêt → search a member → checkout or process a return. Renewal is blocked if another member has an active hold on the same copy (real business rule, confirmed in code). Late returns, lost copies, and damaged copies each trigger the correct real fine/state-change.
**Common errors:** if the Catalogue shows 0 results while the desk shows real inventory, this was a known, real data-integrity bug (orphaned copies with no bibliographic record) — a backfill migration (`0122`) exists for it.

## `guard`

**Access:** the Sécurité & Gardiens portal only.
**Navigation:** `/dashboard/portals/guard/*` — Accueil, Kiosque Gardien (badge scanner), Visiteurs, Sorties, Incidents, Urgence, Configuration.
**Key workflow — report an incident:** Incidents → "Signaler un incident" (confirmed fixed this session — this button previously did nothing). Closed incidents can now be reopened via a "Réouvrir" button (also fixed this session).
**Common errors:** scan/dismissal actions are blocked until the guard has clocked into an active shift — this is intentional, not a bug.

## `parent` / `student`

**Access:** self-service portals for their own/their child's data.
**Navigation:** role-specific dashboards (`a67bb28`, 2026-08-03) — not independently re-audited this session beyond confirming the routes are guarded.

## Employee self-service (any role with a linked `employeeProfiles` record)

**Access:** `/dashboard/hr/self-service` — gated by having an actual employee record, **not by role**. An admin account with no employee profile will be redirected home; this is correct, documented behavior, not a bug (confirmed and the sidebar link now correctly hides itself from ineligible accounts as of this audit period).
**Key workflow:** view own payslips, punch history, leave balance.

---

## Gaps in this guide

Some roles' workflows (student, parent, teacher's non-grading flows) were not re-walked end-to-end this specific session — their entries above are based on the underlying route/permission structure being confirmed real, not a fresh click-through. Recommend a dedicated QA pass to produce screenshots and exact field-level validation messages for each role before this becomes a customer-facing document.
