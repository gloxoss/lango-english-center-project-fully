# Agent Execution Prompts — SchoolOS Remediation

Four standalone, copy-pasteable prompts — one per part of the Execution Plan in `PRODUCT-REVIEW-AND-FIXES.md`. Each one is self-contained (full app context repeated in every prompt) so you can hand any single part to an agent on its own, in any order, in parallel sessions if you want.

Bucket 1 (already fixed / no action needed) isn't included — there's nothing to build.

---

## PART 1 — Quick, Safe Fixes (Bucket 2, ~25 items)

**Copy everything below this line into your agent:**

```
# App Context — SchoolOS

You are working in a real, partially-built production codebase: SchoolOS, an enterprise multi-tenant school-management SaaS.

**Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Drizzle ORM + Postgres, Better Auth. Runs via Docker Compose (services: schoolos-app, schoolos-db, schoolos-clamav, schoolos-app-migrate-1).

**Reference logic:** this app's business rules and DB schema are modeled on ESchool SaaS v1.6.0. Before touching any module, consult insperations/ESCHOOL_SAAS_DATABASE_SCHEMA.md, insperations/eschool_saas_full_schema.sql, and insperations/eschool-saas-codebase/ (PHP business logic & repositories) if you need reference business logic.

**Multi-tenant isolation is non-negotiable.** Every query, every API route, every page must filter by tenantId/school_id. Never write a query that could leak cross-tenant data.

**Layered feature architecture** for any feature folder under src/features/<module>/: model/types.ts (strict interfaces), data/ (fetch helpers), ui/ (rich stateful views using @/components/ui/ primitives — no static dummy placeholders), and app/api/<module>/ (route handlers).

**Standing API route convention** — every route handler follows this shape:
requireRequestContext(req, [allowedRoles]) → requireTenant(context) → requireCapability(context, 'module.action') → Zod .strict() schema validation → tenant-scoped Drizzle query → recordAudit() on any mutation → apiErrorResponse() as the catch-all.

**Standing page-guard convention** — every page component's first line:
requireServerPage(locale, { allowedRoles, requiredCapability? }) from src/libs/api/page-guard.ts. Several modules have their own thin wrapper (requireTransportPage, requireLibraryPage, requireLibrarySelfPage, requireLeadershipPage) — check the module's own ui/page-guard.ts first and reuse the wrapper if one exists.

**Design system** — slate/blue palette (#0066FF, #16212B, #D1F5E8), data-dense tables, KPI card banners at the top of list pages, quick inspector sidebars for record detail. Match this, don't introduce a new visual language.

**Honest-stub pattern** — if something genuinely isn't ready, use the shared ComingSoonView component (src/components/shared/coming-soon-view.tsx) rather than fake data. Never leave hardcoded/mock arrays behind.

**Migrations** — hand-written SQL only, wrapped idempotently: DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN null; END $$; . Always re-read migrations/meta/_journal.json fresh immediately before adding a new entry. Number sequentially. CRITICAL Postgres gotcha: drizzle-kit batches ALL pending migrations into ONE transaction on a fresh install — using an enum value in DML within the same transaction that added it via ALTER TYPE ... ADD VALUE throws a hard error; cast to ::text for any comparison against a freshly-added enum value in the same migration.

**Build verification — do not trust `tsc --noEmit` alone.** The authoritative check is `docker compose build app` (foreground). If you touched a migration, also run `docker compose build migrate` explicitly — it's a separate image (target: migrator) with its own build cache. After any rebuild, verify freshness by grepping the actual bundled output inside the running container (docker exec ... grep on .next/server/chunks/*.js) rather than trusting the build log; use --no-cache if in doubt.

**Never bypass compliance triggers.** 15 accounting/journal-related tables have BEFORE UPDATE OR DELETE triggers that unconditionally RAISE EXCEPTION (immutability by design, ERRCODE 55000) — never work around these without explicit authorization.

**Command discipline:** run `npx next build` after significant edits and get to 0 TypeScript/build errors. Never `cd`. For any long-running task, launch it and wait for a completion signal rather than polling.

**Read this first, every time:** `PRODUCT-REVIEW-AND-FIXES.md` in the project root is a full, code-verified audit — 135 items across 22 modules, each one built by actually opening the real screenshot and reading the real code, not guessed. Before starting each item below, open that file and read the exact numbered item — it already contains the confirmed root cause, the exact file(s)/line(s) involved, and a scope note. Implement against it, don't re-derive it. If what you find in the code doesn't match the doc, trust the code (something may have changed since the audit) but flag the mismatch back to the user rather than silently proceeding on a stale assumption.

**Ground rules for this pass:**
- Touch only what's listed below. Don't "improve" adjacent code or refactor modules you weren't asked about.
- Each item needs a verifiable "done" state — confirm it after.
- If an item turns out to need a product decision only the user can make, stop and ask rather than guessing.
- Never weaken multi-tenant isolation or the existing RBAC/capability model while fixing something else.

---

# Your task: Bucket 2 — Quick, Safe Fixes

These are one-route, one-query, or one-line fixes with a known, narrow root cause already traced in the review doc. Work through them in this order (independent — safe to reorder or parallelize across sessions if useful). For each: read the cited section in PRODUCT-REVIEW-AND-FIXES.md, implement the fix, verify, move on.

1. **§6.14** — Teacher affectation page shows raw IDs instead of subject names. Add `leftJoin(subjects, ...)` to `GET /api/academics/class-subjects`, return `subjects.name`.
2. **§6.15** — Promotion wizard "Section d'Origine" dropdown is always empty. Fetch `class_sections`/`class-offerings` directly instead of the sections-less `classes` response.
3. **§6.16** — Readiness dashboard shows an impossible 129/43 ratio. Use `countDistinct(classSubjects.id)` instead of `count()` in the readiness query.
4. **§2.6** — Matricule "Réserver le prochain" button permanently burns a real matricule on every click. Split into a true non-mutating preview vs. an explicit reserve action; move the mutating one off `GET`.
5. **§9.6 / §9.7** — Card & certificate PDF downloads fail with a generic error. Replace the seed script's placeholder `schemaJson`/`templateSchema` values with real pdfme-shaped schemas (or re-create the seeded templates through the real TemplateDesigner UI).
6. **§8.5** — Attendance excuses page is entirely mock data (`MOCK_EXCUSES`). Wire `attendance-excuses-view.tsx` to the already-working `/api/attendance/excuses` + `/document` routes instead of rebuilding it.
7. **§2.4** — Admission dossier KPI cards are hardcoded to `'—'`. Wire the 4 cards to real counts.
8. **§6.12** — Conflict errors are shown as a raw inline string, not a toast. Presentation-only change — same data already returned by the API.
9. **§10.6** — Épreuve UUID field. Swap the free-text UUID input for a searchable title dropdown, on both the roster tab and the schedule tab.
10. **§9.3 / §9.4 / §2.1** — Unbounded lists (card issuance x2, student directory). Add pagination — backend pagination already exists for students, needs adding for the two cards lists.
11. **§11.1** — Events dashboard: 3 of 4 stat cards are hardcoded literals (845 inscriptions, 5 campus, 4.8/5). Wire "Inscriptions totales" to a real sum of `registeredSeats`; drop or compute the other two.
12. **§12.4** — Attachment-type "Code" field is fully manual; archived types can't be seen or restored. Auto-slugify `Nom` → `Code` on the create form; add an archived-items filter + restore action reusing the existing `PUT` route.
13. **§13.2** — Aging Receivables "Relancer SMS" and "Exporter Excel" buttons are bare `alert()` calls with zero backend. Swap both for a real `smsMessages` insert and a real `exportToCsv` call (patterns already used elsewhere in the app).
14. **§13.4** — Create Invoice dialog has a raw student-ID text field; the "Enregistrer un paiement" → Collection Desk redirect loses all context. Swap the field for the existing student-search component; pass `?studentId=` through the redirect so Collection Desk auto-selects the right student.
15. **§13.7** — Chart of Accounts detail panel shows no transaction history. Wire the existing panel to the already-built `GET /api/finance/accounting/statements/drill-down?accountId=...` endpoint — zero new backend work.
16. **§13.8** — New-account dialog can't set a parent account. Add a parent-account combobox — the `parentAccountId` column and tree UI already exist.
17. **§13.11** — Encaissement/dépense forms require typing a journal/voucher-type code from memory. Replace both free-text inputs with `<select>`s populated from the existing journals/voucher-types endpoints.
18. **§15.2** — Broadcast module "doesn't work" for one tenant. Grant the `broadcast-messaging` addon entitlement to the affected tenant via the super-admin entitlement toggle (data fix, not code). Separately: make `BroadcastOverviewView` and its six sub-pages surface `error.code === 'ADDON_NOT_ACTIVATED'` as its own distinct, explained state instead of a generic loading-failure message.
19. **§17.9** — "Portail Employé" self-service link dead-ends for admins with no explanation. Gate the sidebar link (src/components/shared/sidebar.tsx) behind eligibility (same data the page guard already reads); pass a notice through the redirect so the landing page can explain why.
20. **§18.2** — Guard Portal: "Signaler un incident" button opens nothing (missing `setCreating(true)` call); closed incidents can't be reopened (missing UI button, backend `reopen` action already exists). Fix both in `guard-incidents-view.tsx`.
21. **§19.1** — Hostel "Ce soir" dashboard search box is dead (no `value`/`onChange`). Wire it up.
22. **§19.8** — Hostel roll-call list shows raw UUIDs instead of residence names. Same fix class as §6.14 — add the missing join to `hostels` in `listRollCalls()`.
23. **§19.10** — Hostel policy page's escalation-tier section is read-only while everything else on the page is editable. Add row-level edit controls for tier recipient/threshold/channel, reusing the `set()` helper already on the page.
24. **§19.11** — Hostel Reports page crashes with a generic "Une erreur interne est survenue" whenever the state filter defaults to `'all'` (invalid Postgres enum comparison). Special-case `'all'` the same way a sibling tab already does correctly (or guard it inside the shared service function for safety).
25. **§20.1** — Transport Règles & Politiques page is pure UI theater (local state only, `setTimeout` fake save, no API). Add the missing `GET/PUT /api/transport/policies` route wired to the already-existing, already-unused `transportPolicies` table; have the service layer read those persisted values instead of in-code defaults.

**When done:** run the full build verification, list what you fixed with a one-line confirmation per item, and flag anything where the code didn't match what the review doc said.
```

---

## PART 2 — Confirmed Real Bugs Needing More Work (Bucket 3, ~18 items)

**Copy everything below this line into your agent:**

```
# App Context — SchoolOS

[Use the identical "App Context" block from Part 1 above — stack, conventions, route/page-guard patterns, design system, migration discipline, build verification, compliance-trigger rule, command discipline, and the instruction to read PRODUCT-REVIEW-AND-FIXES.md for each item before implementing. Not repeated here for brevity — copy it verbatim from Part 1 if handing this to a fresh agent session that hasn't seen it.]

---

# Your task: Bucket 3 — Confirmed Real Bugs Needing More Work

These are real, root-caused bugs — but each needs more than a one-line fix (a new endpoint, a schema decision, or a small feature alongside the fix). Each is independently scoped; work through them in any order, but read the cited section first every time.

1. **§2.5** — Tutor/guardian form is missing fields that the profile page shows (occupation, address, email/SMS opt-in). Two separate gaps: add the fields to the admission wizard's inline "create tutor" mini-form, AND add them to the standalone Parents & Tuteurs page's Zod schema (`guardianCreateSchema` is currently `.strict()` and rejects them) plus its form.
2. **§6.9** — Question bank: can't click a question to view/edit it. For per-exam questions, the backend PUT route already exists — just wire a real edit modal to it. For bank items, there's no PUT route at all — build one, then the UI. Also add ownership enforcement (`createdById` check) to the delete route and the new PUT route, since any teacher can currently edit/delete any other teacher's questions.
3. **§7.2** — `/dashboard/teachers/[id]` (admin-only route) renders `TeacherProfile360View`, which is the teacher's own self-service component, not an admin view. Build a real, separate admin-facing teacher detail component covering documents, contract/salary, assigned classes, attendance history, leave status. Leave `TeacherProfile360View` untouched for the teacher's own portal — point the admin route at a new component instead.
4. **§10.2** — Any teacher can grade any other teacher's devoir; `grading.manage` is role-wide, not ownership-scoped. Add a `createdBy`/`assessmentDefinitions.createdBy === context.userId` check to the grade route for the `teacher` role specifically (admin/super_admin remain unrestricted as an override). Also introduce a narrower `grading.review` capability + a read-only "admin review" UI mode (view + comment, no score edit) — `school_admin` currently has the same edit rights as `teacher`, which isn't what's wanted.
5. **§8.6** — No way to send a new SMS from the attendance flag-detail page (guardian contact + SMS history are shown, but no compose/send action exists). Add a compose/send action reusing the existing `smsMessages` insert pattern already used for the history panel.
6. **§8.7** — Attendance "rappel" reminder is simulated only — inserts a row into `smsMessages` but the response literally says "mode simulation, aucun SMS réel envoyé." Wire a real SMS/notification provider. This fixes #5 above too — same underlying send path.
7. **§6.11** — Seeded/demo timetable data shows one teacher double-booked 4x at the same slot. Not a code bug (the create/update API already blocks this via `assertSlotIsValid`) — this is a data cleanup: reconcile or clear the 177 conflicting seed slots referenced in §6.12's Conflits page.
8. **§2.3** — The admission wizard's inline "add tutor" mini-form (3 fields: name/phone/email) is narrower than a richer "foyer familial" modal seen elsewhere in the raw walkthrough. First confirm where that richer modal actually lives today (check the standalone Parents & Tuteurs page) before deciding whether/how to reconcile the two.
9. **§12.5** — As admin, the sidebar shows the librarian's own operational checkout desk (`LibrarianPortalClient`) verbatim — same bug class as §7.2. Build a real admin-facing library management view (staffing, policy configuration, fines override, audit trail) separate from the operational desk component. Either add a role check that hides "Comptoir de prêt" from admins by default, or an explicit "Agir en tant que bibliothécaire" mode that's visually distinct.
10. **§12.7** — Library copies exist (`libraryCopies`, real rows) but have no active parent bibliographic record (`libraryBibliographicRecords`), so the Catalogue page shows 0 results while the operational desk shows real inventory. Backfill this tenant's orphaned copies with proper bibliographic records, and add a guard (DB constraint or application-level check) so a copy can never be created without an active parent record — this must not recur for future tenants.
11. **§13.5** — Two disconnected expense systems: the simple Office Accounting `expenses` table never touches the real double-entry ledger (`accountingDocuments`/`journalEntryLines`) used by `/api/finance/accounting/expenses`. This needs a product decision first (see "open questions" below) before implementing — either label Office Accounting clearly as petty-cash-only, or make its POST also create a real `accountingDocuments` entry with the submit→approve→post lifecycle the formal module already has.
12. **§15.1 / §15.3** — Three disconnected "send a message" systems in the codebase (SMS Communication's bare `smsTemplates`, Lead CRM's `inquiries`, Broadcast's multi-channel `communication_templates`). Consolidate the SMS Communication template studio into Broadcast's already-multi-channel `communication_templates` system (supports sms/email/whatsapp/telegram/messenger, versioning, draft→published already); retire the standalone `smsTemplates` table once migrated. Also fix the color-system deviation while you're in these files — SMS Communication and Pipeline CRM hardcode `#2487B8`/`#1B6C93` instead of the app's real `#0066FF`/`#16212B`/`#D1F5E8` tokens.
13. **§15.5** — Reminders page (`/dashboard/communication/reminders`) has a hardcoded `.slice(0, 6)` cap with zero filter parameters, and is SMS-only/simulated (shares the same real-provider gap as #6 above). Add a `classSectionId` query param + UI class-picker control, remove the hardcoded cap; wire a real SMS/notification provider (same fix as §8.7 — do these two together).
14. **§16.1** — Report Cards/Bulletins is one page, one student at a time, no batch mode, no real PDF (bare `window.print()` on the whole dashboard, no `@media print` stylesheet). Add a batch-generation endpoint that loops the existing (correct) per-student calculation over a whole class-section roster, plus a bulk UI. For the PDF: either add a scoped print stylesheet (cheap, still not a storable PDF) or properly integrate report cards into the existing `documentTemplates`/pdfme pipeline as a 4th document type alongside `student_id`/`employee_id`/`admit_card` (the better long-term answer, since it gives batch issuance + audit trail for free). Also fix the hardcoded `coefficient: 1` in `GET /api/students/report-card` — no per-subject weighting is actually applied today.
15. **§17.3** — Employee detail page (`/dashboard/hr/employees/[id]`) has no Finance/Attendance tabs despite real payroll and time-clock systems existing. Before adding the tabs: resolve the schema-level gap — `payslips`/`workforcePunchEvents` are keyed to `user.id` (login account), while the employee page is keyed to `employeeProfiles.id` (HR record). Decide: join through the nullable `employeeProfiles.userId` (accepting "Sans compte" employees show nothing), or add proper `employeeId` columns to the payroll/punch tables. Then add the two tabs.
16. **§17.5** — Départements page shows 0 employees for all departments while Postes & fonctions correctly shows 20. Query logic on both pages looks correct — first run a direct DB check (group employees by `departmentId`) to confirm whether this is duplicate/orphaned department seed rows before writing any code fix.
17. **§17.6** — `accountant` role passes the `allowedRoles` check on `/dashboard/workforce` but has no `payroll.review` capability by default, so it fails the capability check and gets redirected home — the route looks half-wired. Needs a decision (see open questions) before fixing: grant `payroll.review` (and maybe `payroll.sensitive.read`) to `accountant`, or drop `'accountant'` from `allowedRoles` if that was never the intended scope.
18. **§17.8** — Payroll hub: 6 of 12 sub-pages (Composantes salariales, Structures salariales, Affectations salariales, Ajustements, Réglementation, Paramètres) render through one shared component that does `GET` + `JSON.stringify()` into a `<pre>` block — no create/edit UI at all, even though the backend (`POST /api/workforce/payroll/config` + a lifecycle-action route) already supports it. This is the largest item in this bucket: build real list/create/edit UI for all six — component type/rate/formula pickers, a structure-template builder, a per-employee assignment picker, an adjustment request form with an approval flow — and wire the existing "not juridiquement certifiée" compliance banner to a real publish/version-approval action instead of a silent dump.

**Open questions to raise with the user before starting #11 and #17 specifically** (don't guess on these):
- Should the Office Accounting expense log stay as labeled petty-cash logging, or should it feed the real double-entry ledger?
- Should accountants be able to review payroll, or was `accountant` listed in `/dashboard/workforce`'s allowed roles by mistake?

**When done:** run the full build verification, list what you fixed with a one-line confirmation per item, and flag anything where the code didn't match what the review doc said.
```

---

## PART 3 — Genuine Unbuilt Features (Bucket 4, ~40 items across 13 module groups)

**Copy everything below this line into your agent:**

```
# App Context — SchoolOS

[Use the identical "App Context" block from Part 1 above. Not repeated here for brevity — copy it verbatim if handing this to a fresh agent session.]

---

# Your task: Bucket 4 — Genuine Unbuilt Features

Nothing below is a bug — every item is real, net-new work, already scoped (small/medium/large) in PRODUCT-REVIEW-AND-FIXES.md. This bucket is too large and too heterogeneous to build in one pass — treat each module group below as its own mini-project. Work through the groups in the order given (roughly cheapest/highest-value first), and inside each group, read every cited section before starting. Confirm scope with the user before starting any group marked ⚠️ — those have an open product decision baked into the item itself, not just a technical one.

### Super Admin
- **§1.3** — consolidate the school-detail page, the "Plans & Modules" catalog, and the subscriptions list into one unified "manage this school" screen; add real per-plan-tier limits (max students/storage/features) — today plan tier is just a label, nothing enforces it.
- **§1.4** — pick any of the 4 stubbed platform pages (SMS Platform, Support Platform, Rapports Plateforme, Santé & Infrastructure) and build it into a real page, following the same shape as the already-fixed waitlist page.
- **§1.5** ⚠️ — the Portail direction's "IGP" composite score (/100) has no documented formula. Needs the user to define what feeds it (attendance? fees? grades? what weighting?) before it can be built honestly.

### Students / Alumni
- **§2.7** — student photo gallery: today it's a single `photoUrl` field per student, not a collection. Needs a real data-model change (a photo-collection table) plus bulk upload.
- **§2.9** ⚠️ — automatic grade-threshold promotion. Needs the user to define what "passing" means (a configurable threshold? per-subject minimums? school-level policy?) and what happens to borderline/failing students before this can be built.
- **§3.1** — automatic alumni-transition trigger tied to "student's last class/year ended." The transition logic itself is already solid — this is purely about triggering it on a schedule instead of manually. Needs a decision on what "last class ended" means in this system's academic-year model.

### Events / Requests
- **§4.1 / §11.4** — build a full admin event-detail page covering the 7 backend sub-resource areas that already have real API routes but zero UI: venues, tasks, incidents, feedback, communications, reports, check-ins/waitlist. This is the destination the (currently broken) "Gérer l'événement" button should open.
- **§5.1** ⚠️ — kanban multi-stage pipeline for alumni records requests (received → accepted → preparing → ready → taken/refused), replacing the current binary pending/approved/rejected status. Confirm scope with the user first: is this alumni-requests-only, or a broader student-services demand queue for currently-enrolled students?

### Academics (the biggest cluster — consider splitting further if working solo)
- **§6.1** — at class-creation time: select number of sections to auto-create, assign teachers inline, teacher-availability suggestions (no availability data model exists yet — build one), inline weekly-calendar preview. Bundles 3 features — don't treat as one small tweak.
- **§6.5** — per-class period-mode selection (semester/trimester/month), replacing the current tenant-wide-only `includeSemesters` boolean; downstream grade/timetable/analytics screens need to correctly branch on whichever granularity a class uses.
- **§6.6** — filière (stream) structure: today it's just a name. Add a linked subject list with coefficients, an official Bac filière code (for Massar/CNDP exports), and a cycle restriction (nothing stops attaching a Lycée-only filière to a Collège class today).
- **§6.9** — auto-generate exam variations from the question bank + auto-compose-by-difficulty (pull N questions per difficulty bucket so hard questions aren't over-concentrated). Difficulty categorization itself already exists — this is the assembly logic on top.
- **§6.10** — a real scheduling/constraint-solver feature: auto-assign classes × sections × teachers × rooms × times respecting the existing `assertSlotIsValid` conflict rules. Large, standalone project.
- **§6.12** — an auto-fix suggestion engine for timetable conflicts (e.g. "move this slot to the next open room/slot, here's the diff") — today "Résoudre" just deep-links to manual editing.
- **§6.13** — full, editable JSON preview of a session-copy operation before applying it. Check what the existing "Aperçu de la copie" response already returns before scoping the UI work.
- **§6.14** — substitute-teacher workflow: `class_teachers.role` already supports a `'substitute'` value in the schema, but no UI/API creates, displays, or activates one. Probably needs to hook into whatever tracks teacher absences elsewhere in the app.
- **§6.16** — drill-down + historical trend on the academic-readiness dashboard (clicking a card should deep-link to the underlying unresolved items; add a week-over-week trend).

### Personnel
- **§7.3** ⚠️ — expand the old teacher add/edit form to a real employment record (hire date, CIN, address, salary, documents). Before building this: note that §17.2's newer HR employee wizard already does this well — consider retiring/consolidating the old teacher form instead of duplicating the work. Raise this with the user first.

### Attendance
- **§8.1** — surface bulk badge issuance (`/api/identity-badges/bulk-issue` exists but isn't in the UI) for onboarding a whole class/cohort at once.
- **§8.3** — camera-based QR scanning for the kiosk (net-new — no `getUserMedia`/barcode-decode library exists today; only physical USB scanners work). This is a prerequisite for Bucket 5's kiosk design variations A and B.

### Documents (Cards & Convocations)
- **§9.1** — class/section grouping in card-issuance/batch-creation flows (today it's a flat student list with name/matricule search only); an auto-émission trigger tied to a real event (e.g. enrollment confirmed); an issuance entry point directly on a student/employee's own profile page.
- **§9.5** — class/section bulk-select specifically for convocation issuance — same underlying gap as §9.1, applied to exam convocations.

### Examinations
- **§10.1** — turn the ungated 3-tab exam-master flow into a sequential/numbered flow (Salles & Sessions → Planifier → Noter) with earlier steps required before later ones unlock.
- **§10.3** — a reusable teacher question bank for devoirs (today every devoir is authored from scratch; no bank exists anywhere in the codebase for this feature — distinct from the academics question bank in §6.9).
- **§10.4** — bulk-fill/keyboard-driven (Tab/Enter) grade entry on the marksheet grid, plus live-computed mention while typing (the "Mention Automatique" UI column exists but isn't wired to the input).
- **§10.5** — a shared physical room/facility registry that exam halls could pull from, instead of each exam hall being a free-typed, exam-specific-only record.

### Library
- **§12.1** — pure naming/labeling fix: rename one of the two "Bibliothèque[...]" sidebar entries so they read as clearly different tools (document library vs. book circulation). No logic change.

### Finance / Inventory
- **§13.3** — surface the existing bulk-billing engine (`/dashboard/finance/allocations`) from the main Invoices page with a visible "Facturation groupée" entry point — the engine is real, this is a discoverability fix, not new backend.
- **§14.3** — reorder-point / auto-purchase-suggestion automation for Inventory. Low-stock *detection* already exists; the *action* on it (draft a purchase order automatically) doesn't. Needs a reorder-point field on the product record, a scheduled/event-triggered check, and a draft-PO generator.

### Broadcast
- **§15.4** ⚠️ — only build a kanban view for Broadcast Campaigns if actually wanted — today it's a flat table, which is a legitimate design on its own. Confirm with the user before building; the status enum/lifecycle already exists if you do build it.

### Hostel
- **§19.2 / §19.3 / §19.5** — a "quick-start" wizard for bulk zone/room/bed creation (e.g. "create N floors × M rooms × K beds in one step"), and beds auto-generated from a room category's already-existing `defaultCapacity`. All layered cleanly on already-working single-entity CRUD APIs — no backend rework needed, just new orchestration + UI.

### Reports & Settings
- **§21.1** — small resilience pass on the report-run engine: crash recovery for a run stuck at `status: 'running'` after a server restart (currently in-process, fire-and-forget, no persistent job queue). Not urgent at current scale.
- **§22.6** ⚠️ — the school-level "Modules & Licences" entitlements-catalog page likely still rides the hardcoded addon registry already flagged in §1.3 (a TypeScript array, not database-driven). Confirm this is still true, then fix together with §1.3 rather than separately.

**When done with each group:** run the full build verification, confirm the "done" state matches the scope note, and report back before moving to the next group.
```

---

## PART 4 — Deferred Design-Exploration Briefs (Bucket 5, 4 items)

**Copy everything below this line into your agent:**

```
# App Context — SchoolOS

[Use the identical "App Context" block from Part 1 above for the technical conventions and design-system palette. Not repeated here — copy it verbatim if handing this to a fresh agent session.]

**Important difference from Parts 1–3: this is a UI/UX design-exploration task, not a feature-build task.** For each item below, the user wants 3 no-backend-logic "playground" variations of an existing page — different layouts/interaction models to compare, sitting on top of already-working data and APIs. Do not wire new business logic, do not touch the backend. If a frontend-design or UI/UX-focused workflow is available in your environment, prefer it for this task. Build each variation as a real, clickable page (reusing the existing API calls for real data) so the user can actually click through and compare — not a static mockup.

---

# Your task: Bucket 5 — Design-Exploration Briefs

Read the cited section in PRODUCT-REVIEW-AND-FIXES.md for each — it already contains the specific brief (what each of the 3 variations needs to solve for).

1. **§2.8** — Student transfer form. Current: a single flat form (search student → pick branch → pick class) with no guidance. Build 3 variations exploring better guided flows for this exact operation.

2. **§6.10 / §6.15** — Timetable builder (§6.10) and Promotion & Re-enrollment wizard (§6.15), 3 variations each. Read both briefs carefully — §6.10's variations need to solve for building a weekly grid fast for a whole school, surfacing conflict info inline, and making draft-vs-published state obvious. §6.15's variations need a working section picker (⚠️ blocked on the bug fixed in Part 1, item §6.15 of that list — confirm it's already fixed before starting this one), a usable bulk decision-matrix for a large class, and a more prominent capacity-check banner.

3. **§7.4** — Personnel page, 3 variations (directory-first evolution of the current layout; a card/grid roster; a workflow/compliance-first layout leading with document-compliance status). Each variation must resolve the same underlying gaps documented at §7.1–§7.3 (short form, no document upload, broken profile link) — the variation is about layout/emphasis, not which gaps get fixed.

4. **§8.3** — Kiosk scanner, 3 variations (kiosk/tablet mode; teacher-handheld mode; reception/security-desk mode). ⚠️ Variations A and B specifically depend on the camera-scanning capability from Bucket 4's §8.3 item — confirm that's built first, or scope these two variations to work with the existing physical-scanner input path as a fallback if camera support isn't ready yet.

**When done:** present all variations for the user to compare side by side (e.g. distinct routes like `/dashboard/<page>/variation-a`, `/variation-b`, `/variation-c`), and don't merge or pick a winner — that decision is the user's.
```

---

---

## PART 5 — Cleanup Sweep (Parts 1–3 Loose Ends) + Full Part 4 Execution

**Added after `EXECUTION-AUDIT-VERIFIED.md` found:** 21 of 43 Parts 1–2 items code-confirmed fixed, but 2 confirmed still broken, 1 confirmed incomplete, and 19 never independently re-checked. Part 4 (Bucket 5) was confirmed **0% started** — no variation routes exist anywhere in the app. This part does both: close out what's left from Parts 1–3, then build all of Part 4 properly.

**Copy everything below this line into your agent:**

```
# App Context — SchoolOS

[Use the identical "App Context" block from Part 1 above — stack, conventions, route/page-guard patterns, design system, migration discipline, Docker build-verification gotchas, compliance-trigger rule, command discipline. Not repeated here for brevity — copy it verbatim if handing this to a fresh agent session that hasn't seen it.]

**Read these three files first, in this order, before touching any code:**
1. `PRODUCT-REVIEW-AND-FIXES.md` — the ground-truth findings for every item cited below (root cause, exact file/line, scope note).
2. `EXECUTION-AUDIT-VERIFIED.md` — what's already been code-verified as fixed, broken, or unchecked. Trust this over any commit message or prior agent's self-report — it's the only status in this repo backed by direct code reads, not claims.
3. `AGENT-EXECUTION-PROMPTS.md` Part 4 (Bucket 5) below in this same file — the design-exploration brief you'll execute in Section C.

**Ground rules, same as every other part:** touch only what's listed. Don't refactor adjacent code. Every item needs a verifiable "done" state. If something needs a product decision only the user can make, stop and ask. Never weaken multi-tenant isolation or the RBAC/capability model.

---

# Section A — Fix the 3 confirmed-open items from EXECUTION-AUDIT-VERIFIED.md

These have exact, already-diagnosed causes. No investigation needed — implement the fix directly.

1. **§19.11** — Hostel Reports page crashes with a generic error whenever the "Affectations" filter defaults to `state=all`. Root cause confirmed at `hostel-reports-view.tsx` line 69: `allocState` is sent into the query string unconditionally, and the backend compares it against a Postgres enum column that doesn't have `'all'` as a member. Fix: special-case `'all'` the same way the Allocations tab in `allocation-workspace-view.tsx` already does correctly (or guard it inside the shared `listAllocations()` service function itself, which protects every future caller).

2. **§2.5** — Tutor/guardian form is still missing `occupation`, `address`, `emailOptIn`, `smsOptIn`. Confirmed absent from `parents-guardians-client.tsx` (address exists only as a read-only display value with a hardcoded default). Two separate gaps to close: (a) the admission wizard's inline "create tutor" mini-form needs these fields added; (b) the standalone Parents & Tuteurs page's `guardianCreateSchema` (in `validation.ts`) is `.strict()` and will reject them even if the UI sends them — add the fields to the schema AND the form.

3. **§15.2 (UI half)** — Broadcast module still collapses every load failure into one generic message. Confirmed: no reference to `ADDON_NOT_ACTIVATED` anywhere in `broadcast-overview-view.tsx`. Fix: branch on `error.code === 'ADDON_NOT_ACTIVATED'` and show a specific "this module isn't enabled for your school" state instead of the generic failure message, across the overview and its six sub-pages (Connexions/Segments/Modèles/Campagnes/Rapports/Automations). Separately, confirm (don't assume) whether the `broadcast-messaging` entitlement has actually been granted to the Groupe Scolaire Atlas tenant yet — if not, that's a one-click super-admin fix, not a code change.

# Section B — Re-verify the 19 previously-unchecked items

`EXECUTION-AUDIT-VERIFIED.md` never claimed these were fixed OR broken — they were simply not checked. For each, read the cited `PRODUCT-REVIEW-AND-FIXES.md` section, check the current code, and either (a) confirm it's already fixed and move on, or (b) implement the fix if it's genuinely still open. Update `EXECUTION-AUDIT-VERIFIED.md` with your findings for each as you go (move it from "Not checked" into "Confirmed Fixed" or "Confirmed Still Open" with the same evidence-citation format already used in that file).

- §2.3 — wizard's inline tutor form vs. the richer "foyer familial" modal (confirm where the richer modal actually lives before deciding whether to reconcile)
- §6.11 — data cleanup only (177 seeded conflicting timetable slots) — not a code fix, just run `scripts/reconcile-timetable-conflicts.sql` if it hasn't been run yet
- §8.7 — confirm a real SMS/notification provider is actually wired now (the old "mode simulation" text is gone from `attendance-audit-view.tsx`, but that alone doesn't prove a real send path exists — trace it)
- §12.4 — attachment-type "Code" field auto-slug + archived-items restore UI
- §12.7 — data backfill only (orphaned library copies) — check whether `migrations/0122_library_orphaned_copies_backfill.sql` (already found in the repo) actually ran and fixed this tenant's data
- §13.2 — Aging Receivables `alert()` calls replaced with real `smsMessages` insert + `exportToCsv`
- §13.5 — needs a product decision first (ask the user: should Office Accounting stay petty-cash-only, or feed the real ledger?) before implementing either direction
- §13.7 — Chart of Accounts detail panel wired to the existing `drill-down?accountId=` endpoint
- §13.11 — Encaissement/dépense forms: free-text journal/voucher-type codes replaced with dropdowns
- §15.1/§15.3 — SMS Communication template studio consolidated into Broadcast's `communication_templates`; Pipeline CRM kanban given real drag-and-drop
- §16.1 — batch generation confirmed added (`batchCards` state found in `report-card-generator-view.tsx`) — verify the real-PDF half of this item (print stylesheet or pdfme integration) is also done, not just batch mode
- §17.5 — needs a live DB check (group employees by `departmentId`) to confirm whether the Départements-vs-Postes count mismatch is duplicate seed rows, not a code bug
- §17.6 — needs a product decision first (ask the user: should `accountant` get `payroll.review`, or should it be dropped from `/dashboard/workforce`'s allowed roles?)
- §17.9 — self-service sidebar link gated by eligibility; redirect passes a notice through
- §19.1 — Hostel "Ce soir" dashboard search box wired up
- §19.10 — Hostel policy page's escalation-tier section given real edit controls

Also finish **§17.8**: only the "Paramètres" sub-page was confirmed to have gotten a real form. Check the other 5 (Composantes salariales, Structures salariales, Affectations salariales, Ajustements, Réglementation) — build real list/create/edit UI for whichever are still raw `JSON.stringify()` dumps.

# Section C — Execute Part 4 (Bucket 5) fully

Confirmed **0% started** — no `variation-a`/`variation-b`/`variation-c` (or equivalent) routes exist anywhere in `src/app`. This is a UI/UX design-exploration task, not a feature-build task: for each item, build 3 real, clickable "playground" variations of an existing page — different layouts/interaction models, sitting on top of already-working data and APIs. Do not wire new business logic, do not touch the backend beyond what already exists. If a frontend-design or UI/UX-focused workflow is available in your environment, prefer it for this task.

Start with the 3 that have no blockers, do §8.3 last (it depends on Bucket 4's camera-scanning capability, confirmed not yet built — `getUserMedia`/`BarcodeDetector` found nowhere in the codebase):

1. **§2.8** — Student transfer form. Current: single flat form (search student → pick branch → pick class), no guidance. Build 3 variations exploring better guided flows.
2. **§6.15** — Promotion & Re-enrollment wizard. Section-picker bug already fixed (confirmed) — build 3 variations solving for: a working section picker, a usable bulk decision-matrix for a large class (not one dropdown per student), and a more prominent capacity-check banner shown earlier in the flow.
3. **§7.4** — Personnel page. Build 3 variations (directory-first evolution of the current layout; a card/grid roster; a workflow/compliance-first layout leading with document-compliance status). Each must resolve the same underlying gaps at §7.1–§7.3 (short form, no document upload, broken profile link) — the variation is about layout/emphasis, not which gaps get fixed.
4. **§6.10** — Timetable builder. Build 3 variations solving for: building a weekly grid fast for a whole school (today one class/teacher/room at a time), surfacing conflict info inline, and making draft-vs-published state visually obvious.
5. **§8.3** — Kiosk scanner. Build 3 variations (kiosk/tablet mode; teacher-handheld mode; reception/security-desk mode). If the camera-scanning capability still isn't built when you reach this item, scope variations A and B to work with the existing physical-scanner input path as a fallback rather than blocking on it — note clearly in your write-up that camera support is the one piece still missing.

**When done with Section C:** present all variations for the user to compare side by side (distinct routes like `/dashboard/<page>/variation-a`, `/variation-b`, `/variation-c`). Don't merge variations or pick a winner — that decision is the user's.

---

**When the whole prompt is done:** run the full build verification (`docker compose build app`, plus `docker compose build migrate` if you added any migrations), update `EXECUTION-AUDIT-VERIFIED.md` and `APP-STATUS-REPORT.md` with the new state, and report back a clear summary: what moved from "unverified" to "fixed," what's still genuinely open, and which of the two product-decision items (§13.5, §17.6) are still waiting on the user.
```

---

**How to use this file:** each part above is self-contained — copy the fenced block under "Copy everything below this line" and paste it directly as your agent's starting prompt. Parts 1–3 can run in parallel in separate sessions since their item lists don't overlap. Part 4 should probably wait until the Bucket 4 dependencies it references (§8.3's camera capability, §6.15's section-picker bug) are actually done — Part 5 supersedes this concern by building the camera capability's fallback path itself and confirming §6.15 is already clear. Part 5 is the one to hand off now if you want a single agent to close out everything open at once: it starts with the known-broken items (fast wins), re-verifies everything uncertain, and only then moves on to the net-new Part 4 design work.
