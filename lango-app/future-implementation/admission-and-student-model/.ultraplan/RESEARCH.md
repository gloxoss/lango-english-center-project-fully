# UltraPlan Research

Direct schema/route verification against the live codebase — no subagents
spawned (fixed stack, doc already specifies target architecture, matches
this repo's established `/ultraplan` precedent).

## Confirmed real (verified by reading the actual files, not assumed)

- `user.gender` (`Schema.ts:476`) — real column, unused today.
- `user.photoUrl` (`Schema.ts:481`) — real column, already read/written by the student-photos feature.
- `academicYears` table (`Schema.ts:446`) — real, has `name`/`startDate`/`endDate`/`isActive`.
- `guardians`/`guardianStudents` tables — real, with a working search-and-link UI precedent in `parents-guardians-view.tsx`.
- `src/app/api/students/documents/route.ts` — real, GET/POST, but **only accepts a `studentId` referencing an existing `user` row with `role: 'student'`** — see conflict below.
- `applicants` table (`Schema.ts:590`) — real, flat `guardianName`/`guardianPhone`/`guardianEmail` text columns exactly as the source doc describes, no gender/nationality/motherTongue/city/bloodGroup columns yet.
- `account` table (`Schema.ts:545`) — real Better Auth table, has a `password` column. `emailAndPassword` is enabled in `src/libs/auth.ts:33`.
- `schoolSettings` table (`Schema.ts:1799`) — real, good place for a school-wide login-mechanism toggle.

## Conflict found (Phase 2 Step 2.4) — resolved with user

**Conflict:** The source doc frames document-upload-at-admission-time as "a wiring gap, not a missing capability" — implying the existing `students/documents` route just needs a form wired to it. In fact that route's own schema strictly requires a real, already-enrolled `user` row (`role: 'student'`), which does not exist until Step 4 approval. "Upload immediately" as literally described is not buildable against the existing route.

**Resolution (user confirmed, see DISCOVERY.md):** Build a small parallel `applicantDocuments` table (same shape as `studentDocuments`: id/tenantId/applicantId/documentType/fileExt/uploadedAt) with its own GET/POST route pair, used only during the wizard while there's still just an `applicants` row. At approval time, copy each uploaded file from the applicant's storage path to the student's storage path and insert matching `studentDocuments` rows, then the applicant-side rows/files can be left in place (harmless leftover, not deleted — deleting isn't necessary and adds risk of deleting something still referenced).

## Second real bug found (not in the source doc — found while reading the approval transaction)

`PUT /api/students/admissions` (`route.ts:~113`), inside the approval transaction, generates the new student's matricule as:
```ts
const matricule = `M-${Math.floor(1000 + Math.random() * 9000)}`;
```
This is a **random, non-sequential, wrong-format matricule** — it doesn't match the real `STD-{year}-####` format the rest of the app uses (see `GET /api/students/matricules`, the real naming-series reservation endpoint, and the real Matricules page verified working earlier this session). It also has zero collision protection beyond luck (`namingSeries` exists specifically to prevent this). This is the same class of bug as the already-fixed client-side `Math.random()` matricule bug in `students-list-view.tsx` from an earlier remediation pass — except this one is server-side, in the approval transaction itself, and has never been caught. Folding this into Wave 1 ("real bug fixes") since it's directly in the same transaction Wave 1 already touches, and it's a genuine data-integrity bug, not new scope.

## Login-access generation — technical approach

No existing precedent in this codebase for programmatic account creation (grepped for `createUser`/`signUpEmail`/reset-code patterns — none found; the previously-planned "access-reset" feature for guardians was never built). Better Auth's server API (`auth.api.*`) is the mechanism — `auth.api.signUpEmail` (or equivalent create-user server method) is the standard Better Auth pattern for server-side account creation with a password. Exact call signature should be re-verified against the installed Better Auth version at implementation time (this is why the login-generation section is rated **yellow risk**, not green).

Two mechanisms, one school-wide `schoolSettings` toggle (per Discovery):
- **Invite-link**: generate a random one-time token, store it (new small table or reuse a pattern like the old access-reset doc's `resetCode`/`resetCodeExpiresAt` idea, but scoped to first-login-setup, not password reset), deliver via the existing log-only `smsMessages` convention. No real SMS gateway exists, so this stays honest about being simulated, same as every other "delivery" feature in this app.
- **Temp password**: generate a random password, create the Better Auth account with it directly, display it once in the approval response for the admin to relay manually.

## No conflicts beyond the one resolved above

Everything else in the source doc (field list, exclusions, curated Mother Tongue list, free-text Nationality, search-before-create guardian flow) matches the real schema and existing UI conventions with no contradiction found.
