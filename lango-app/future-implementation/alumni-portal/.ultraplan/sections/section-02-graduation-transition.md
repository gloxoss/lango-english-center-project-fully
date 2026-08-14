# Section 02: Graduation Transition

## Overview
Implements the PRD's "Graduation transition" and the re-admission edge case. This is the single riskiest piece of logic in the whole plan: the first code path in this app that ever changes a `user.role` after creation. Reuses the admission-approval credential-issuance pattern (temp-password or invite-link, branching on `schoolSettings.loginAccessMethod`) for issuing the new alumni account, and disables the old student credentials in the same transaction.

## Risk: yellow - novel operation, no existing precedent to copy for the role-flip itself
The credential-issuance half is a direct, proven reuse of the admission-approval pattern. The genuinely new part — flipping `role` on an existing row, disabling old credentials, AND killing any already-active session (not just future login attempts) without breaking any FK/session assumption elsewhere in the app — has no precedent, so extra care and a real regression check (does every other student-scoped feature still behave correctly for a student who has NOT transitioned) are non-negotiable before this section is done.

## Dependencies
- **Depends on:** section-01
- **Blocks:** section-03 (alumni need a real account to log into the portal shell), section-05 (requests need a real transitioned alumnus to test against)
- **Parallel batch:** 2

## TDD Test Stubs (updated during Phase 4 review — bulk transition added per refinement question)
- Test: Transitioning a real student sets `role='alumni'`, `alumniTransitionedAt`, `alumniTransitionedBy` on the same user row — no new row created, no data lost.
- Test: The old student's `account` credential row is disabled/invalidated such that a login attempt with the old password fails after transition.
- Test: A new real alumni credential (temp password or invite link, per `schoolSettings.loginAccessMethod`) is issued and actually works for login.
- Test: Attempting to transition a student under 18 succeeds (transition itself isn't blocked by age — only directory/mentoring visibility is, per the discovery decision), but the resulting alumni record is correctly excluded from directory/mentoring elsewhere.
- Test: Re-admitting a former alumnus as a new student flips `role` back to `student` and suspends (not deletes) their alumni-only access.
- Test: A non-transitioned student's existing features (attendance, grades, guardian links) are completely unaffected by this section's changes.
- Test: Selecting 30 real students and confirming once transitions all 30 correctly, each with their own real independent credential issuance — one student's failure (e.g. a data issue) doesn't silently abort or half-apply the others.

## Tasks

<task type="auto" id="02-01">
  <name>Build the graduation-transition endpoint</name>
  <files>src/app/api/students/[id]/transition-to-alumni/route.ts</files>
  <action>
    New file. POST handler, role `school_admin`, cap `admissions.manage` (reuse — this is a decision-of-similar-weight to an admission approval, not worth a new capability string per this plan's "no unnecessary permission growth" discipline unless review finds otherwise). Confirmed via research: a real `session` table exists (`Schema.ts:1899`, keyed by `userId`, `token`, `expiresAt`) — an active, already-logged-in student session would otherwise keep working after this transition even though their password stops working, unless explicitly deleted. Inside a `db.transaction`: (1) update the `user` row with a real WHERE clause that includes `role = 'student'` (e.g. `.where(and(eq(user.id, id), eq(user.tenantId, tenantId), eq(user.role, 'student')))`) so a concurrent double-transition attempt naturally affects 0 rows on the losing request instead of racing — check the returned row count and throw a real 409 if it's 0 (means the student wasn't in a transitionable state, possibly a concurrent transition just won); set `role: 'alumni'`, `alumniTransitionedAt: now()`, `alumniTransitionedBy: context.userId`, optionally `graduationCohortSessionYearId` from the request body; (2) invalidate the student's existing `account` credential row(s) (delete or set an unusable sentinel password) AND `db.delete(session).where(eq(session.userId, id))` to kill every active session row for this user, so an already-logged-in session is killed too, not just future password attempts; (3) issue new alumni credentials using the exact same branch-on-`schoolSettings.loginAccessMethod` logic as the admission-approval transaction (temp password via `hashPassword` + direct `account` insert, or invite-link via `accountSetupTokens` + `smsMessages`). Return the same shape the admission endpoint returns (`tempPassword` or `loginAccessDeliveryStatus`) so the UI can reuse its existing result-display pattern.
  </action>
  <verify>Transition a real test student via curl. Confirm via psql: `role='alumni'` on the user row, old `account` row invalidated, new `account`/`accountSetupTokens` row present. Attempt login with the OLD password — must fail. If the student had an active session before transition, confirm that session is also dead (a request using the old session token/cookie must fail, not just fresh login attempts). Complete login with the NEW credential — must succeed. Fire two transition requests for the same student concurrently — confirm exactly one succeeds and the other gets a real 409, never two alumni-credential-issuance side effects for one student.</verify>
  <done>A real, transactional, race-safe graduation-transition endpoint exists: kills old credentials AND active sessions, flips role, issues new real alumni credentials.</done>
</task>

<task type="auto" id="02-02">
  <name>Build the bulk-transition endpoint</name>
  <files>src/app/api/students/bulk-transition-to-alumni/route.ts</files>
  <action>
    New file. POST, same role/cap as task 02-01. Zod `.strict()` schema `{studentIds: string[].min(1).max(200)}` (real upper bound — a sane cap on one batch, not unlimited). For each ID, run task 02-01's exact same real per-student transaction (extract 02-01's core logic into a shared function both routes call, don't duplicate it) — but each student's transition is its own independent transaction, so one student's failure (already-alumni, concurrent race loss, etc.) doesn't roll back or block the others. Collect and return a real per-student result array (`{studentId, success, tempPassword?, loginAccessDeliveryStatus?, error?}`), mirroring the `insertedCount`/`errorCount`/`results[]` shape already established in this app's bulk student-import endpoint.
  </action>
  <verify>Select 5 real test students (mix of valid and one already-alumni to test partial failure), submit as one bulk request, confirm 4 succeed with real new credentials and 1 reports a real per-item error, without affecting the other 4.</verify>
  <done>A real bulk-transition endpoint exists, reusing the exact per-student transition logic independently per item, with honest partial-failure reporting.</done>
</task>

<task type="auto" id="02-03">
  <name>Build the re-admission (alumni-to-student) endpoint</name>
  <files>src/app/api/students/[id]/reinstate-from-alumni/route.ts</files>
  <action>
    New file. POST handler, role `school_admin`, cap `admissions.manage`. Validate the target user belongs to the tenant and has `role='alumni'`. Inside a transaction: set `role: 'student'`, clear `alumniTransitionedAt`/`alumniTransitionedBy` to null (or keep them as historical fact and add a separate `alumniAccessSuspended` concept — prefer keeping the historical timestamps and just relying on `role !== 'alumni'` to naturally suspend alumni-only access everywhere else, since every alumni-facing route in later sections checks `role === 'alumni'` already, so no separate suspension flag is needed). Do NOT touch their `alumniDocuments`/`alumniDirectoryConsent`/`alumniMentorListings` rows — history stays, access is what's gated by role.
  </action>
  <verify>Re-admit a real transitioned-alumni test user via curl. Confirm `role='student'` via psql. Confirm a subsequent call to any alumni-only route (once section 03+ exist) correctly rejects them by role, while their historical `alumniDocuments` rows are untouched in the database.</verify>
  <done>A real re-admission endpoint exists, correctly reversing role without deleting alumni history.</done>
</task>

<task type="auto" id="02-04">
  <name>Wire the transition action into the admin student detail page and a bulk cohort action</name>
  <files>src/features/students/ui/student-detail-view.tsx, src/features/students/ui/bulk-alumni-transition-view.tsx, src/app/api/students/route.ts</files>
  <action>
    First, in `src/app/api/students/route.ts`'s `getStudentDetail()`: relax the single-id lookup's WHERE clause from `role='student'` to `role IN ('student','alumni')` (scoped only to this function, not the list query elsewhere in the file), and add `role` to its returned object — discovered during execution that the existing detail page hard-filters to students only, which would 404 for any already-transitioned alumnus. Then, in `student-detail-view.tsx` (built earlier this session, has Profil/Documents/Tuteurs/Académique/Finance tabs): add a real "Marquer comme ancien(ne) élève" action (visible only for `role='student'` users, gated by `can('admissions.manage')`), with a real confirmation dialog (per the discovery decision: "a real deliberate confirmation step") warning that the student's login will stop working immediately. On confirm, call task 02-01's endpoint and show the same temp-password/invite-link result UI pattern already used in `admission-requests-client.tsx`'s decision result. For an `alumni`-role user viewed on this same page, show a "Réintégrer comme élève" action instead, wired to task 02-03. New `bulk-alumni-transition-view.tsx` (linked from the students list/directory): a real class-section or manual multi-select of real students, one real confirmation step naming the count, calling task 02-02's bulk endpoint, and a real per-student result list (success/error) after submission — matches the "select multiple, confirm once" decision, not one dialog per student.
  </action>
  <verify>In the browser: transition a real student from the detail page, confirm the dialog warns correctly, confirm the result shows a real temp password/invite status. Reload — the same student now shows alumni state and the reinstate action instead. Separately, select 5 real students in the bulk view, confirm once, confirm all 5 real per-student results display correctly.</verify>
  <done>Staff can trigger a real, confirmed graduation transition (single or bulk) or reversal from real admin UI.</done>
</task>
