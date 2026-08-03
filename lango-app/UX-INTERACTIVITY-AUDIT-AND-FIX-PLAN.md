# UX Interactivity Audit: Tables, Filters, Pagination, Buttons, Cards

**Audited 2026-07-31.** Scope: not data-reality (already fully audited/fixed across the earlier V2 passes) — this is specifically about controls that render but don't do the right thing when clicked: decorative pagination, filters that don't filter, dead buttons, cards that don't deep-link where they visually promise to.

**Important context:** while auditing, I found evidence that another agent/tool has been actively working on this exact codebase concurrently (a new shared `src/components/shared/data-table.tsx` component, edits to `cndp-view.tsx`/`audit-logs-view.tsx`/`uploads.ts` mid-session). That component is genuinely well-built — real client-side pagination, page-size control, CSV export, loading/empty states — and has already fixed several of the pages below. **Adoption is partial: only 6 of ~35 table-bearing pages use it so far.** This plan's main job is finishing that rollout and fixing the handful of things it doesn't cover.

**Recommendation before starting:** confirm no other agent/tool is mid-edit on these files right now — concurrent edits to the same files is how things get silently reverted or conflict.

---

## Section A — 🔴 High severity (real, live bugs)

### A1. Header search box is completely dead — affects every page in the app
- **File:** `src/components/shared/header.tsx:78-83`
- **Finding:** the global search `<input placeholder="Rechercher élèves, classes, factures...">` has no `value`, `onChange`, `onKeyDown`, or `onSubmit` — it's fully decorative. Renders on every dashboard page via the shared `Header`.
- **Fix:** this is already scoped as Section 34.6 in `V2-ROADMAP.md` ("global cross-module search" — `GET /api/search?q=` + wiring the header to it). Per the independent audit in `V2-INDEPENDENT-AUDIT.md`, a `/api/search` route may already exist from that concurrent work — **check `src/app/api/search/route.ts` first** before building a new one; if it exists, this task is just wiring the header input to it (controlled input, debounced fetch, a results dropdown).
- **Verify:** type a real student's name in the header search from any page, confirm real matching results appear and clicking one navigates to that record.

### A2. `dashboard/settings/users` — pagination is 100% fake
- **File:** `src/features/auth/ui/users-manage-view.tsx:304-311`
- **Finding:** `<button>1</button>` is hardcoded with no `onClick`; Previous/Next buttons have no `onClick` at all; the table always renders every row in `filteredUsers` regardless of "page" — there is no slicing logic anywhere in the file. This is the exact bug class the new `DataTable` component (see intro) was built to fix, but this file hasn't been migrated to it yet.
- **Fix:** replace the manual `<table>` + fake pagination block with `<DataTable data={filteredUsers} columns={...} exportFilename="utilisateurs" onRowClick={...} />`, matching the pattern already proven in `students-list-view.tsx`/`teachers-manage-view.tsx`/`audit-logs-view.tsx`.
- **Verify:** seed or create 15+ users for a test tenant, confirm the page actually paginates (page 2 shows different rows), confirm page-size selector changes rows-per-page, confirm CSV export produces all rows not just the visible page.

### A3. `users-roles-view.tsx` — a brand-new, 100% fake page (currently dead, but a real risk)
- **File:** `src/features/settings/ui/users-roles-view.tsx` (215 lines)
- **Finding:** entirely fabricated data — `usersList` array with invented names/emails/2FA status, a fake "Rôles" tab with a static `modulesPermissions` list, zero `fetch` calls anywhere. **Currently unreachable** — grepped the whole `src/` tree, nothing imports `UsersRolesView` and no `page.tsx` renders it. It appears to be in-progress/abandoned work from the concurrent agent.
- **Fix — pick one:**
  - **(a) Recommended:** delete it. `users-manage-view.tsx` (once A2 is fixed) already covers the "users" half; a "roles" permission-matrix page is new scope not covered anywhere in `V2-ROADMAP.md` — if that's wanted, it should be scoped deliberately (real schema for role→module permission matrix), not left as a fake orphan that might get wired up by accident later.
  - **(b) If genuinely wanted:** treat as new scope, design a real `rolePermissions` table + route before building any UI, matching this app's established pattern (schema → route → UI, never UI-first).
- **Verify:** `grep -rn "UsersRolesView\|users-roles-view" src/` returns only the file's own definition (confirms still dead) before deciding; if deleted, confirm `npx tsc --noEmit` stays clean.

### A4. `dashboard/documents/generator` (report cards) — still 100% fake, never touched
- **File:** `src/features/academics/ui/report-card-generator-view.tsx`
- **Finding:** zero `fetch` calls, confirmed unchanged since the very first audit this session. Every button (Générer PDF, Envoyer aux parents, Aperçu) is inert. This was explicitly flagged as depending on real grade data, which has existed since Section 9/14 — it was never revisited.
- **Fix:** now that `assessmentResults`/`class-results` are real, build a real report-card data route (`GET /api/academics/report-card?studentId=&semesterId=` — pulls real grades via the same grading-engine helpers as `class-results`) and wire the generator UI to it. PDF export: reuse the `window.print()` pattern already used for invoices (Section 13) — no new PDF library.
- **Verify:** generate a real report card for a real student with real entered grades, confirm the displayed grades match what was actually entered via grade-entry, confirm a student with zero grades shows an honest empty state, not a blank template pretending to be real.

---

## Section B — 🟡 Medium severity (real but narrower impact)

### B1. Dashboard "at-risk student" cards and "Relancer Tuteur" button don't deep-link
- **File:** `src/features/dashboard/ui/dashboard-view.tsx`
- **Finding:** the at-risk-student alert cards (~line 423) and the "Relancer Tuteur" button (~line 620) are all wired to `handleCardClick(name, '/${locale}/dashboard/students')` — a single generic URL regardless of which of the 3+ different students was clicked. The button's label promises a specific action (follow up with that guardian) but performs a generic list navigation instead.
- **Fix:** pass the real `studentId` through and route to `dashboard/students/${studentId}` (the real profile page, already built); for "Relancer Tuteur" specifically, consider deep-linking into the Section 18 access-reset flow or the Phase 4 announcements/SMS reminder flow for that specific guardian instead of just the directory.
- **Verify:** click 3 different at-risk cards, confirm each lands on that specific student's own profile, not the same directory page three times.

### B2. Dashboard recent-payment rows don't deep-link
- **File:** `src/features/dashboard/ui/dashboard-view.tsx` (~line 516)
- **Finding:** payment rows are `cursor-pointer` with hover states but all route to the generic `/finance/payments` list, not the specific invoice/payment clicked.
- **Fix:** route to `dashboard/finance/invoices/${invoiceId}` (real page, already built) using the real ID already present in the row data.
- **Verify:** click 2 different payment rows, confirm each opens its own specific invoice.

### B3. Invoices list "Download" button is a redundant dead-end, not a download
- **File:** `src/features/finance/ui/invoices-view.tsx` (~line 258, `title="Imprimer / PDF"`)
- **Finding:** wrapped in the identical `Link` as the adjacent "view" (Eye) button — clicking it just navigates to the invoice detail page a second way, doesn't trigger anything print/download-specific itself.
- **Fix:** either remove the redundant button (the real print button already exists ON the invoice detail page per Section 13), or make it actually call `window.print()` directly via a route param like `?print=1` that auto-triggers print on load.
- **Verify:** click Download, confirm either it's gone (simplification) or a print dialog actually opens without an extra click on the detail page.

### B4. Pagination coverage gap on genuinely large-dataset tables
- **Files (raw `<table>`, no pagination at all — not broken, just missing for tables that can realistically grow past one screen):**
  `parents-guardians-view.tsx`, `student-transfers-view.tsx`, `promotions-view.tsx`, `matricules-view.tsx`, `staff-view.tsx` (settings), `class-detail-view.tsx` (class roster), `grade-entry-view.tsx` (grading roster), `evaluations-view.tsx`, `class-results-view.tsx`, `sms-reminders-view.tsx`.
- **Finding:** none of these have fake controls (no dead buttons found) — they simply render every row unpaginated. Fine for a 20-student class roster; not fine once a tenant has hundreds of students/guardians/transfers.
- **Fix:** migrate each to `<DataTable>` following the same pattern as A2 — this is mechanical once A2 establishes the reference implementation for a filtered-then-paginated page.
- **Verify:** for at least the 2-3 highest-traffic ones (parents-guardians, staff, matricules), seed 30+ rows and confirm real pagination.

### B5. Super-admin schools list has no status/plan filter despite showing the badges
- **File:** `src/features/super-admin/ui/super-admin-schools-view.tsx`
- **Finding:** `PLAN_LABELS`/`STATUS_LABELS` are defined and badges render per-row, but there's no filter dropdown to actually filter by plan tier or subscription status — search-by-name is the only filter (confirmed working).
- **Fix:** add a plan-tier and status `Select`, client-side filter against the already-fetched `schools` array (same pattern as every other working filter in this app).
- **Verify:** filter to "Suspendu" schools only, confirm only matching rows show.

---

## Section C — 🟢 Low severity / cleanup

### C1. Confirm `class-section-teachers-view.tsx` and any other reference-data page without an obvious search box actually doesn't need one (small tenant-scale reference data) rather than being an oversight — quick per-file confirmation, not a rebuild.

### C2. Once A2/B4 land, re-run a `grep -rn "Affichage de\|>1</button>" src/features` sweep to confirm zero decorative-pagination patterns remain anywhere in the app — this exact grep found only 1 offender (A2) this pass; use it as the regression check going forward.

---

## Suggested execution order

1. **A2 → B4** first (same fix, same reference component, mechanical once A2 is done) — biggest real bug, clears the most ground.
2. **A3** (delete or properly scope the dead fake page) — five minutes, removes a landmine.
3. **A1** (header search) — high visibility, check for an existing `/api/search` route from the concurrent work before building one.
4. **B1 → B2 → B3** (dashboard/invoice deep-links) — small, isolated, high polish value.
5. **A4** (report-card generator) — the biggest single task in this plan, do last since it's the least mechanical (needs real PDF/print design work, not just a component swap).

## Verify (whole plan)

`npx tsc --noEmit` clean; `docker compose build app` (and `migrate` if A4 adds any schema); live-click through every fixed page as both a school_admin and, where relevant, confirm tenant isolation holds (a second tenant's pagination/filtering never shows the first tenant's rows — should already be true since these are UI-only fixes on top of already-tenant-scoped data, but confirm, don't assume).
