# Section 04: Real Guardian Search-and-Link

## Overview
Implements the PRD's "Real parent/guardian linking" requirement — the single most important change in the source doc. Reworks wizard Step 2 to search the real `guardians` table first (reusing the already-working search in `GET /api/students/parents?search=`), only falling back to "create new guardian" when no match exists. At approval, the student gets properly linked via the real `guardianStudents` table instead of carrying flat duplicate text.

## Risk: yellow - real behavior change for admin users, plus more transaction logic
The search-vs-create UX is a genuine workflow change (see PRD Risk #3), and the approval transaction (already touched by Section 03) gets more complex: it now has two paths (link existing vs create-then-link) instead of one.

## Dependencies
- **Depends on:** section-03 (approval-transaction-fixes) — same function, edited sequentially to avoid two sections independently modifying the same transaction at once
- **Blocks:** section-05 (login-access-generation)
- **Parallel batch:** 3

## TDD Test Stubs
- Test: Searching Step 2 for an existing guardian's name or phone returns real matches from the guardians table, not fabricated results.
- Test: Selecting an existing guardian from search results and completing the wizard links that exact guardian to the new student via guardianStudents — no new guardian row is created.
- Test: Searching with no match shown, then filling the "create new guardian" fallback form and completing the wizard, creates exactly one new guardian row and links it.
- Test: Two separate admissions for two siblings, both selecting the same existing guardian via search, both link to the same guardian row — no duplicate guardian created.
- Test: Approving an applicant with neither a selected guardian nor fallback fields filled still succeeds — guardian linking remains optional, matching today's behavior where guardian fields are optional on the schema.

## Tasks

<task type="auto" id="04-01">
  <name>Add guardianId to applicants table</name>
  <files>src/models/Schema.ts, migrations/{NEXT}_add_applicant_guardian_id.sql, migrations/meta/_journal.json</files>
  <action>
    Add `guardianId: uuid('guardian_id')` (nullable) to the `applicants` table definition with a foreign key to `guardians.id`, `.onDelete('set null')`. Add an index on `guardianId` — it's queried at approval time. Re-check the true highest migration idx at execution time (same caveat as every prior migration task in this plan). Write the corresponding `ALTER TABLE applicants ADD COLUMN IF NOT EXISTS guardian_id uuid` plus the FK constraint (wrapped in the duplicate-object-safe DO block pattern) and the index, and the journal entry.
  </action>
  <verify>Apply via psql, confirm via `\d applicants` that guardian_id exists with its foreign key to guardians(id).</verify>
  <done>applicants.guardianId exists in both Schema.ts and the real database, nullable, FK to guardians.</done>
</task>

<task type="auto" id="04-02">
  <name>Extend applicant PATCH to accept guardianId</name>
  <files>src/app/api/students/admissions/route.ts, src/libs/api/validation.ts</files>
  <action>
    Add `guardianId: z.string().uuid().optional()` to the PATCH schema Section 01/02 built. When guardianId is provided, validate it references a real guardian for the current tenant before saving (same tenant-check pattern already used in the existing /api/students/parents/link POST handler). Setting guardianId does not require clearing guardianName/Phone/Email — the wizard UI (Task 04-04) decides which set of fields to send based on whether the admin picked an existing guardian or filled the fallback form.
  </action>
  <verify>PATCH a real applicant with a valid guardianId, confirm it saves. PATCH with a guardianId from a different tenant, confirm it's rejected.</verify>
  <done>The applicant PATCH endpoint accepts and validates a real guardianId reference.</done>
</task>

<task type="auto" id="04-03">
  <name>Link (or create-then-link) the guardian inside the approval transaction</name>
  <files>src/app/api/students/admissions/route.ts</files>
  <action>
    In the same approval transaction Section 03 already extended, after the student row is created: if `applicant.guardianId` is set, insert a `guardianStudents` row (tenantId, guardianId, studentId, relationshipType default 'Parent') directly using `tx`, mirroring the existing POST /api/students/parents/link logic but inlined since it must be part of this same atomic transaction, not a separate HTTP call. If `guardianId` is not set but `applicant.guardianName` is present (the fallback-form path), first insert a new `guardians` row from the flat guardianName/guardianPhone/guardianEmail fields (split guardianName into firstName/lastName the same way `students/parents/route.ts`'s `splitName` helper already does — reuse that exact function, don't reimplement it), then insert the guardianStudents link row using the newly created guardian's id. If neither is present, skip guardian linking entirely — it stays optional, matching current behavior.
  </action>
  <verify>Approve an applicant with a real guardianId set, confirm a guardianStudents row now links the new student to that exact existing guardian, confirm no new guardian row was created. Approve a second applicant with only flat guardian text set, confirm exactly one new guardian row was created and linked.</verify>
  <done>Approval links a real guardian to the new student either by reusing an existing one or creating exactly one new one, never both, never a duplicate.</done>
</task>

<task type="auto" id="04-04">
  <name>Rework wizard Step 2 to search-first</name>
  <files>src/features/students/ui/student-admission-view.tsx</files>
  <action>
    Replace Step 2's guardian name/phone/email text inputs with: a search input that queries GET /api/students/parents?search={query} as the admin types (debounced ~300ms), a loading indicator while the search request is in flight, a results list showing matching real guardians (name, phone, relation), and a "Sélectionner" action per result that sets the wizard's `guardianId` state and shows the selected guardian's details read-only with a "Changer" action to search again. If the search request itself fails (network error), show an inline retry message rather than an empty silent result list — an empty list must only ever mean "no matches," never "the request failed." Below the search, show "Aucun tuteur trouvé ? Créer un nouveau tuteur" which reveals the original name/phone/email/relation fields as a fallback form — only reachable after a search has been attempted, matching the Discovery decision "search-first, always". The search input has an associated label for screen readers, and results are reachable via keyboard (native buttons, not click-only divs). On Step 4 submit (Task 01-07's PATCH call), send `guardianId` if one was selected, otherwise send the fallback form's guardianName/guardianPhone/guardianEmail exactly as today.
  </action>
  <verify>Search for a real existing guardian by name, select them, complete the wizard, confirm the applicant's guardianId matches. Search with no results, use the fallback form instead, complete the wizard, confirm the applicant's flat guardian fields are set and guardianId is null.</verify>
  <done>Step 2 requires searching real guardians before creating a new one, matching the working pattern already used in the parents-guardians page.</done>
</task>
