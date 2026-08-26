# Agent Execution Prompts — Round 2 (Remaining Open Items)

Six standalone, copy-pasteable prompts covering every item confirmed still open after a full block-by-block re-audit of your original raw notes against live code (see `EXECUTION-AUDIT-VERIFIED.md` and the conversation history for the evidence trail). Everything else from the original 135-item review is confirmed fixed — this file is the actual remaining surface area.

**Suggested use:** run these in parallel across separate agent sessions (they don't touch overlapping files, except Part 3/Part 4 which both touch Academics — run those two sequentially if using one session, or in parallel across two). When all six are done, that's the natural point to stop, do your own fresh manual review, and move to full app design.

---

## PART 1 — Super Admin & Dashboard (3 items)

**Copy everything below this line into your agent:**

```
# App Context — SchoolOS

You are working in a real, partially-built production codebase: SchoolOS, an enterprise multi-tenant school-management SaaS.

**Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Drizzle ORM + Postgres, Better Auth. Runs via Docker Compose.

**Multi-tenant isolation is non-negotiable.** Every query, every API route, every page must filter by tenantId/school_id.

**Layered feature architecture** for any feature folder under src/features/<module>/: model/types.ts, data/, ui/, and app/api/<module>/ route handlers.

**Standing API route convention:** requireRequestContext(req, [allowedRoles]) → requireTenant(context) → requireCapability(context, 'module.action') → Zod .strict() schema → tenant-scoped Drizzle query → recordAudit() on mutations → apiErrorResponse() catch-all.

**Standing page-guard convention:** requireServerPage(locale, { allowedRoles, requiredCapability? }) from src/libs/api/page-guard.ts as the page component's first line.

**Design system:** slate/blue palette (#0066FF, #16212B, #D1F5E8), KPI card banners, data-dense tables, inspector sidebars. Match it.

**Honest-stub pattern:** src/components/shared/coming-soon-view.tsx for anything genuinely not ready. Never fake data.

**Build verification:** `docker compose build app` is authoritative, not `tsc --noEmit` alone. Run `docker compose build migrate` too if you add a migration (separate image, separate cache).

**Command discipline:** `npx next build` after significant edits, 0 errors. Never `cd`. Touch only what's listed below — no adjacent refactors.

---

# Your tasks

1. **Addon catalog: no create UI.** `src/libs/api/addon-catalog.ts` already reads from a real `addonDefinitions` DB table (falls back to the static `src/addons/registry.ts` array only if the table is empty — a comment there literally says "Adding a module now needs a DB row, not a code change"). But there's no confirmed super-admin UI or API route to actually INSERT a new row into `addonDefinitions`. Build one: a `POST /api/super-admin/addon-definitions` route (id, name, description, enabled, requires[]) and a simple form in the Super Admin → "Plans & Modules" area to create a new addon type without touching code or the database directly.

2. **Santé & Infrastructure page.** `src/features/super-admin/ui/super-admin-settings-view.tsx` is still a bare `ComingSoonView` stub (5 lines). The sibling pages (SMS, Support, Rapports) were already built out into real, API-backed views — use those as your pattern reference (`super-admin-sms-view.tsx`, `super-admin-support-view.tsx` are ~400+ lines each with real `/api/super-admin/*` routes). Scope Santé & Infrastructure as: platform-wide technical settings (feature flags, maintenance mode, system health indicators) and basic infrastructure monitoring (DB connection status, background job health, storage usage). Build a real `/api/super-admin/health` route and a matching view, following the same shape as SMS/Support.

3. **Super Admin dashboard: drill-down + alerting.** `src/features/super-admin/ui/super-admin-dashboard-view.tsx` (172 lines) is real and solid but static — no click-through from any KPI tile to the underlying schools/records, and no real alerting (e.g. a tenant with subscription issues, an addon entitlement about to expire). Add: (a) click-through from at least the "Recent Client Schools" list and any count tile to a filtered view of `super-admin/schools`, (b) a real alerts panel surfacing tenants with `subscriptionStatus !== 'active'` or expiring entitlements (`super-admin/entitlements` already has expiry-date data per the original review — reuse it, don't rebuild).

**When done:** run the build, report what you built with file paths, and confirm no existing Super Admin page regressed.
```

---

## PART 2 — Students, Alumni & Events (4 items)

**Copy everything below this line into your agent:**

```
# App Context — SchoolOS

[Use the identical "App Context" block from Part 1 above. Not repeated here — copy it verbatim if handing this to a fresh agent session.]

---

# Your tasks

1. **Students Directory: no row-level action buttons.** `src/features/students/ui/students-list-client.tsx` — Modifier/Supprimer currently only live in the right-hand inspector panel for whichever student is selected. Add inline action buttons (at minimum Edit + Delete, following whatever confirmation pattern the inspector panel already uses for delete) directly on each table row, so acting on a student doesn't require first selecting them into the side panel.

2. **Student Photos: no gallery, no multi-view.** `src/features/students/ui/student-photos-view.tsx` — clicking a student currently opens a file picker directly; there's no photo history/gallery view, only one layout, no bulk upload. This needs a real data-model change: today a student has a single `photoUrl` field, not a photo collection. Add a `studentPhotos` table (id, tenantId, studentId, url, uploadedAt, uploadedBy), a real gallery component (lightbox-style, shown on click instead of immediately opening the uploader), and a bulk-upload flow (multi-file select → assign each to a student). Keep the existing single `photoUrl` as the "current/profile" photo, now sourced from the most recent gallery entry or an explicit "set as profile photo" action.

3. **Alumni: no auto-transition trigger.** The transition logic itself (`src/libs/services/alumni-transition.ts` per the original review) is solid and already used by both single and bulk manual transition. Add a scheduled trigger: a job (follow the existing `scheduled-jobs-service.ts` / `settings-worker.ts` pattern already used elsewhere in this app for autonomous background jobs) that runs periodically, finds students whose academic year/final class has ended (define "ended" as: enrolled in the terminal grade level for the tenant's academic structure, and the current academic year/session has passed its end date), and calls the existing transition function automatically. Add a per-tenant setting to enable/disable this (default off, since this changes login access — a destructive-ish action that should be opt-in).

4. **Events: no edit capability, no attachments, no public-site consumer.** This is the largest item in this batch. In `src/features/events/**` and `src/app/api/addons/events/**`:
   - Add a real `PATCH /api/addons/events/[id]` route for the core event record (title, description, schedule, timezone, venue, online link) — currently only `publish`/`cancel` exist as mutations.
   - Wire the "Gérer l'événement & les billets" button in `events-calendar-client.tsx` (currently has no `onClick` at all) to open a real edit form using the new route.
   - The `eventAttachments` table already exists in the schema but has zero API routes and zero UI — add `POST/GET/DELETE /api/addons/events/[id]/attachments` and a simple attach-file UI in the edit form.
   - Build a public-facing route (e.g. `/api/public/events/[tenantSlug]` + a page) that lists only `visibility: 'public'` events — there is currently no consumer anywhere for that visibility flag despite it existing in the schema and being enforced server-side.
   - Also fix the 3 hardcoded stat cards on the Events dashboard flagged in the original review if not already done — check `events-calendar-client.tsx` for "845"/"5 campus"/"4,8/5" literals before assuming this is done, since only "Inscriptions totales" was confirmed fixed.

**When done:** run the build, report what you built with file paths and new routes, confirm no existing Students/Alumni/Events page regressed.
```

---

## PART 3 — Academics: Class Setup & Structure (3 items)

**Copy everything below this line into your agent:**

```
# App Context — SchoolOS

[Use the identical "App Context" block from Part 1 above. Not repeated here — copy it verbatim if handing this to a fresh agent session.]

---

# Your tasks

This is the largest single bundle in the whole remaining list — treat each of the 3 items as its own sub-project, in this order (each builds toward the next):

1. **Inline section creation.** `src/features/academics/ui/classes-client.tsx` (and wherever else a section needs to be picked — class detail, teacher affectation) currently forces a trip to a separate `/dashboard/academics/sections` settings page to create a new section. Add a combobox-with-create-option pattern (search existing sections, or type a new name and create it inline without leaving the current form) reusable across those 2-3 call sites. No schema change needed — `sections` is already a bare, tenant-wide table decoupled from classes.

2. **Class creation: bulk section count + inline teacher assignment + weekly calendar preview.** The "Nouvelle classe" form (`classes-client.tsx`) currently only has 5 fields (Nom, Médium, Shift, Filière, Cycle). Add:
   - A "Nombre de sections" field that, on submit, auto-creates that many sections (reusing the inline-create pattern from task 1) and links them via `class_sections`.
   - An inline teacher-assignment step right in the same form (reuse whatever teacher-picker component the existing `teacher-affectation` page uses).
   - A **teacher-availability data model** — this doesn't exist yet anywhere in the codebase. Add a minimal `teacherAvailability` table (teacherId, dayOfWeek, startTime, endTime, tenantId) and a settings page for teachers/admins to set it. Use it to power availability-based suggestions in the assignment step (don't build a full solver — just filter/rank candidate teachers by whether they're marked available at the class's likely time slots).
   - An inline weekly-calendar preview showing when each section meets, once timetable slots exist for them (read-only preview, reusing the existing timetable-slots data).

3. **Per-class period-mode (semester/trimester/month).** Today `classes.includeSemesters` is a single tenant-wide boolean; `semesters` is a flexible but ungoverned table (any number of periods, arbitrary month ranges). Add a `periodType` enum (`semester` | `trimester` | `month`) scoped per-class (or per a class-grouping concept if that's cleaner — your call, but it must allow Class A on trimesters and Class B on semesters in the same tenant simultaneously). Wire this into: the class-creation form (task 2, above), the timetable/emploi-du-temps period selector, and the grade-calculation period selector. This is a real modeling change — expect to touch `Schema.ts`, a migration, and every screen that currently assumes one tenant-wide period scheme.

**When done:** run the build, report what you built with file paths, new tables/migrations, and confirm no existing Academics page regressed. Flag clearly if task 3 turned out to need a bigger schema change than scoped here — it's the riskiest item in this list.
```

---

## PART 4 — Academics: Automation & Intelligence (6 items)

**Copy everything below this line into your agent:**

```
# App Context — SchoolOS

[Use the identical "App Context" block from Part 1 above. Not repeated here — copy it verbatim if handing this to a fresh agent session.]

**Note:** Part 3 (a separate prompt) covers class-setup/structure changes to this same module. If both are running, coordinate or run sequentially to avoid touching the same files at once — this part focuses on automation/intelligence layers on top of what already exists, not the base data model.

---

# Your tasks (each is independent, work through in any order)

1. **Question bank: auto-build exam variations + difficulty-capped auto-composition.** `src/features/academics/ui/question-bank-view.tsx` already has real difficulty categorization (Facile/Moyen/Difficile) on both per-exam questions and bank items. Add: (a) an "auto-build exam" flow — pick a target question count + a difficulty distribution (e.g. 40% facile / 40% moyen / 20% difficile) → pulls that many questions from the bank matching subject/cycle filters, respecting the cap so hard questions aren't over-represented; (b) shuffle/variation generation — given one assembled exam, produce N variants with the same questions in randomized order (and randomized option order for QCM), each getting its own `onlineExam` row.

2. **Timetable: auto-generate a full-year plan.** No solver exists today (`assertSlotIsValid` only validates one slot at a time on manual entry). Build a real constraint-based generator: given all class-sections, their assigned teachers/subjects (from `class_subjects`/`class_teachers`), and available rooms/shifts, auto-assign weekly time slots respecting the same conflict rules `assertSlotIsValid` already enforces (no teacher/room/section double-booking). A simple greedy/backtracking algorithm is fine — this doesn't need to be optimal, just valid and editable afterward. Surface it as a "Générer automatiquement" action on the schedule page that populates a new draft `timetable_versions` row, leaving the existing manual editor to adjust it afterward.

3. **Timetable conflicts: auto-fix suggestions.** `src/features/academics/ui/conflicts-view.tsx` — "Résoudre" currently just deep-links to manual editing. Add a suggestion engine: for each conflict, compute 1-3 candidate fixes (e.g. "move this slot to the next open room at the same time," "move to the next open time slot for this room/teacher") and show them as selectable options with a preview of the resulting change before the user confirms. Reuse `assertSlotIsValid` to verify each suggestion is actually conflict-free before presenting it.

4. **Session copy: full editable JSON preview.** `src/features/academics/ui/session-copy-view.tsx` — check what the existing "Aperçu de la copie" response from `/api/academics/class-offerings/copy` (preview mode) actually returns first. Then build a real preview UI showing the full payload of what will be copied, as an editable JSON/structured view, letting the user make small edits before confirming the actual copy operation.

5. **Substitute-teacher workflow.** `src/features/academics/ui/assignment-workspace-view.tsx` — `class_teachers.role` already supports a `'substitute'` enum value in the schema, unused. Build: an "Affecter un remplaçant" action on a class-subject row (separate from the primary "Affecter" action), which creates a `class_teachers` row with `role: 'substitute'`, and updates the affectation-workspace UI to show both primary and substitute per row. If a teacher-absence tracking system exists elsewhere in the app (check the HR/Payroll leave-request tables), tie substitute activation to an approved leave/absence record for the primary teacher on that day; if not, keep it manual (admin explicitly marks "cover for X on Y date") rather than inventing an absence system as a side effect of this task.

6. **Readiness dashboard: drill-down + historical trend.** `src/features/academics/ui/academic-readiness-view.tsx` — each of the 6 compliance cards should deep-link to the underlying unresolved items (e.g. "0/12 Titulaires" → the teacher-affectation page, filtered to the 12 uncovered classes). Add that click-through for all 6 cards. For the trend: store a weekly (or on-demand) snapshot of the readiness score (a simple `academicReadinessSnapshots` table: tenantId, capturedAt, overallScore, per-check breakdown as JSON) and render a small trend line on the dashboard once at least 2 snapshots exist.

**When done:** run the build, report what you built per item with file paths, and confirm no existing Academics page regressed. These are all genuinely large — if you only get through some of the 6, report clearly which ones and why.
```

---

## PART 5 — Documents, Examinations & Attendance (5 items)

**Copy everything below this line into your agent:**

```
# App Context — SchoolOS

[Use the identical "App Context" block from Part 1 above. Not repeated here — copy it verbatim if handing this to a fresh agent session.]

---

# Your tasks

1. **Card/certificate issuance: no entry point on a student/employee's own profile page.** Add an "Émettre une carte" action to `student-profile-view.tsx` (and the equivalent employee profile view) that, when the cards addon is active for the tenant, opens the existing issuance flow (`issueDocument()` service, already used by the flat issuance lists) pre-filled with that student/employee's ID. No new backend logic — this is a new UI entry point onto an already-working service.

2. **Cards: no simple auto-émission trigger.** Add a per-school setting (e.g. "auto-issue student ID card on admission approval") and a trigger point in the admission-approval flow (`src/features/students/**` admission approval logic) that calls the existing `issueDocument()` service automatically using the tenant's default published template for that document type, when the setting is enabled. Default off.

3. **Convocations: no class/section bulk-select.** `src/app/[locale]/(dashboard)/dashboard/cards/admit-cards/page.client.tsx` — currently a flat student list with name/matricule search only. Add a class/section picker above the list that pre-checks all students in the chosen class/section (reuse the existing `/api/students?classSectionId=` pattern already used elsewhere in the app), on top of the existing multi-select-by-checkbox mechanism (don't replace it, add to it).

4. **Homework correction sidebar: its own infinite scroll.** `src/app/[locale]/(dashboard)/dashboard/academics/assessment/homework/page.client.tsx` — the current right-side slide-over shows one student's submission at a time with no structured way to move between many respondents. Replace with a compact left-hand roster list (submitted/graded status badges, paginated or virtualized for large classes) next to a fixed correction panel — inbox + reading-pane layout. No backend change needed.

5. **Devoir creation: no teacher question bank.** `src/app/[locale]/(dashboard)/dashboard/academics/assessment/homework/page.client.tsx`'s "Créer un Devoir" dialog already supports one PDF/image attachment. Add a genuinely new capability: a reusable per-teacher question/exercise bank (new table: `teacherQuestionBankItems` — id, tenantId, createdById, title, content, attachmentUrl, tags) with basic CRUD, plus a picker inside the devoir-creation dialog to pull from it instead of writing consignes from scratch each time. This is distinct from the Academics question-bank (§6.9, exam questions) — keep them separate, this one is devoir/homework-specific.

**When done:** run the build, report what you built with file paths, confirm no existing Documents/Examinations/Attendance page regressed.
```

---

## PART 6 — Library, Finance, Guard Portal & Hostel (7 items)

**Copy everything below this line into your agent:**

```
# App Context — SchoolOS

[Use the identical "App Context" block from Part 1 above. Not repeated here — copy it verbatim if handing this to a fresh agent session.]

---

# Your tasks

1. **Library resource: no edit capability.** `src/app/api/content/assets/[id]/route.ts` only has `GET`. Add a real `PUT`/`PATCH` (title, description, tags, targets — the fields the inspector already displays but can't modify), and wire the resource inspector UI (`content/library` page) to a real edit form using it.

2. **New Resource dialog: check for missing tags/expiry.** Verify whether `content/library`'s "New Resource" creation form has a tags input and an expiry/visibility-window field. If not (original finding: it didn't), add both — `tags` already exists on the data model per the schema, just needs a UI input; expiry needs a new nullable `expiresAt` field + migration if it doesn't already exist.

3. **⚠️ Office Accounting ↔ real ledger — needs a decision before you build anything.** Two disconnected expense pipelines exist: the simple `expenses` table used by `office-accounting/page.client.tsx` (posts to `/api/accountant/me/office-accounting`, no GL link), and a separate, unused `/api/finance/expenses` route that DOES call the real double-entry `tryPostExpenseGLEntry` helper. **Ask the user first:** should Office Accounting stay a labeled petty-cash log (in which case: just add a clear UI label distinguishing it from the formal ledger, no wiring), or should it feed the real ledger (in which case: point `office-accounting/page.client.tsx` at the already-working `/api/finance/expenses` route instead of the old one, and retire or clearly deprecate `/api/accountant/me/office-accounting`)? Do not guess — this changes how money gets tracked in production.

4. **Office Accounting expense dialog: no receipt upload.** The `receiptUrl` field already exists in the API response type but nothing in the "Nouvelle Dépense" form can ever set it. Add a file-upload input (reuse whatever file-storage helper the document-cards module already uses) and wire it to save the uploaded file's URL into `receiptUrl` on submit.

5. **Collection Desk: class/section filter + playground variations.** `src/app/[locale]/(dashboard)/dashboard/finance/collection-desk/page.client.tsx` — currently name/matricule/email search only via `/api/search`, no class-browse option. This was flagged as a design-exploration ask (build 3 variations, similar to the already-completed Part 4 playgrounds) rather than a single fix — build: (a) current search kept as-is, (b) a class/section picker → roster grid variation (reuse `/api/students?classSectionId=` for real data, same as elsewhere in this app), (c) a "today's due/overdue" queue variation reusing the Aging Receivables data as the entry point instead of search. Follow the same in-page tab-switcher pattern already used by the 5 existing playground components (`*-playground.tsx` files in `src/features/**/ui/`) for consistency.

6. **Guard Portal: Urgence needs a prominent sidebar shortcut.** In `src/components/shared/sidebar.tsx`, "Urgence" (`/dashboard/portals/guard/emergency`) currently has the same visual weight as its sibling nav items. Add a persistent, high-visibility entry (red accent, always visible even when the "Sécurité & Gardiens" group is collapsed) that deep-links straight there. Small, UI-only.

7. **Hostel Reports: fix the persistent `state=all` crash.** `src/features/hostel/ui/hostel-reports-view.tsx` — the "Affectations" tab defaults `allocState` to `'all'` and sends it unconditionally into `?state=${allocState}`, which the backend compares against a Postgres enum (throws, surfaces as a generic "Une erreur interne est survenue"). This exact bug has survived multiple fix rounds — fix it now: either special-case `'all'` on the frontend before appending it to the query string (the sibling Allocations tab in `allocation-workspace-view.tsx` already does this correctly — copy that pattern), or guard it inside the shared `listAllocations()` service function itself for a safer, caller-proof fix. This is small and the cause is fully known — don't spend time re-diagnosing it.

**When done:** run the build, report what you built with file paths, and confirm no existing Library/Finance/Guard/Hostel page regressed. For item 3, report back what the user decided before implementing — do not proceed on your own judgment.
```

---

**When all six parts are done:** update `EXECUTION-AUDIT-VERIFIED.md` and `APP-STATUS-REPORT.md` with what landed, then this is a clean point for a fresh manual review pass before moving into full app design work.
