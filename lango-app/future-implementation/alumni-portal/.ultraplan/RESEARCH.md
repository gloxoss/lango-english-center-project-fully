# UltraPlan Research: Alumni Portal

> Generated: 2026-08-06
> Phase: 2/6 - RESEARCH
> Subagents deployed: 1 (Codebase only — no new external tech/libraries needed, pure extension of the existing stack)

---

## Codebase Analysis

### Existing decorative alumni portal — must be rebuilt, not extended
`src/features/crm/ui/alumni-portal-view.tsx` (rendered by `src/app/[locale]/(dashboard)/dashboard/portals/alumni/page.tsx`) is a 100% fake client component: hardcoded mock arrays (`ALUMNI_MEMBERS`, `ALUMNI_EVENTS`, `MENTORSHIP_OPPORTUNITIES`, `ALUMNI_JOBS`, `SCHOOL_NEWS_ALUMNI`), no API calls, no auth, no DB. It even has a "Cotisation & dons" (dues/donations) card — the source doc explicitly defers donations, so this card is dropped, not rebuilt. This page gets fully replaced by this plan's real admin-side alumni management, not extended.

### Role model — three touch points beyond the DB enum, one silently breaks logins if missed
- `role` pgEnum (`Schema.ts:27`): `['super_admin', 'school_admin', 'teacher', 'accountant', 'student', 'parent', 'receptionist', 'guard']`. Adding `alumni` uses the exact idiom already established in `migrations/0003_add_accountant_role.sql`: a bare `ALTER TYPE "role" ADD VALUE IF NOT EXISTS 'alumni' AFTER 'student';` (no `DO` wrapper needed — `ADD VALUE IF NOT EXISTS` is already idempotent since PG 12).
- **`src/libs/api/context.ts`'s `APP_ROLES` array is a separate, hardcoded literal list, NOT derived from the DB enum.** `requireRequestContext` rejects any role not in this list with `403 ROLE_NOT_ALLOWED`. **Adding the Postgres enum value alone does nothing — an alumni user would be rejected on every request until `'alumni'` is added here.** This is the single most important, easy-to-miss touch point.
- `src/libs/api/permissions.ts`'s `DEFAULT_ROLE_PERMISSIONS: Record<AppRole, readonly PermissionKey[]>` is exhaustive over `AppRole` — the compiler forces adding an `alumni` entry once `AppRole` (which is `typeof APP_ROLES[number]`) includes it. Real forcing function, no risk of silently forgetting this one.
- `src/models/userMapping.ts`'s `ROLE_TO_UI` is derived from the DB enum (auto type-errors, forces a French label) but `ROLE_TO_DB` (the reverse map) is `Record<string, Role>`, **not exhaustive** — easy to forget, no compiler help.

### Role changes have zero precedent in this codebase
`grep -rn "set({ role"` across `src/` returns **zero matches** — every existing role is only ever set at row-creation time. The alumni transition endpoint (flipping `role: 'student'` → `role: 'alumni'` on an existing row) will be the **first code path in this app that ever changes a user's role post-creation**. No existing pattern to copy for this specific operation — needs to be built carefully as new, real logic (real transaction: disable old credentials, set role, then issue new alumni credentials via the reused admission-invite pattern).

### A different, adjacent "graduate" concept already exists — naming collision risk
`promotionDecisionType` enum already includes `'graduate'`, and `POST /api/students/promotions` already handles a `'graduate'` decision via `closeStudentPlacement()` — but that only closes the student's `studentPlacements` row (`status: 'graduated'`), it does **not** touch `user.role`/`userStatus`/`classSectionId`. Today a "graduated" student via that flow stays fully logged in as a student. This plan's alumni transition is a deliberately separate, manual admin action (per the discovery decision) — but naming must avoid confusion with this existing promotions concept (e.g. don't reuse the word "graduate" for the new endpoint/button).

### Login-credential issuance — fully reusable pattern, confirmed
The admission-approval transaction (`src/app/api/students/admissions/route.ts` PUT handler) already does exactly what alumni invitation needs: temp-password path (`hashPassword` + direct `account` insert, `providerId: 'credential'`) or invite-link path (`accountSetupTokens` table, 7-day expiry token, delivered via a real `smsMessages` row), branching on `schoolSettings.loginAccessMethod`. Directly reusable, same shape.

### Document storage/verification — real gap found, needs a new table (not reuse)
`studentDocuments`/`applicantDocuments` both have `unique(personId, documentType)` — **one row per document type per person, overwritten on reissue, no issuance history.** The discovery decision ("old verification code revoked on reissue, only the new one verifies") is a real security property that **requires keeping issuance history** — this cannot be built on the existing overwrite-only shape. A new `alumniDocuments` table is needed, allowing multiple historical rows per (alumnus, documentType), each with its own verification code and a `supersededAt` timestamp. `src/libs/api/uploads.ts`'s tenant-namespaced storage helper (`saveUploadedFile`/`readUploadedFile`) is still directly reusable for the file itself.

### Graduation cohort reference — an existing landmine to avoid repeating
`user.academicYearId` and `applicants.academicYearId` both already (incorrectly) FK into the **dead** `academicYears` table (part of the unused LMS chain, per `AGENT-HANDOFF.md`), not the real, live `sessionYears` table. This plan's alumni record should reference `sessionYears` for graduation cohort/year — the correct table — rather than copying the existing app's own pre-existing mistake.

### Verification-code generation — reusable counter mechanism, needs one added safeguard
`namingSeries` (prefix PK, tenantId, currentVal) is the exact mechanism already used for matricules (`reserveMatricule()` in `src/libs/services/matricule.ts`) and is directly reusable for a verification-code series (e.g. prefix `VER-${year}-`). One real gap: `reserveMatricule()` has no row lock, so it's not safe under concurrent calls for the same prefix+tenant — acceptable for matricules (low concurrency, low stakes on a rare collision) but a verification code is a security-relevant identifier where a collision would let one document's code be mistaken for another's. `src/libs/services/student-placement.ts:125` already uses `pg_advisory_xact_lock` for an analogous race elsewhere in this app — the same pattern should be applied to alumni verification-code generation, not the unlocked `reserveMatricule` shape as-is.

### Public (no-auth) endpoint precedent — fully reusable
`src/app/api/public/inquiries/[tenantSlug]/route.ts` is the real, live public endpoint pattern: no `requireRequestContext`, `checkRateLimit()` (a simple in-memory sliding-window limiter, `src/libs/api/rate-limit.ts` — no Redis, resets on restart, doesn't share state across instances; an honest existing limitation, not something to fix as part of this plan), a Zod `.strict()` schema with a honeypot field, tenant resolved by slug + active check. Directly reusable for the public document-verification page.

### Migrations
Highest file on disk: `0059_advanced_reporting_addon.sql` (from the concurrent session). Next migration: **`0061`**. Enum-creation idiom already established (`DO $$ BEGIN CREATE TYPE ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`) — same style to follow for any new enums this plan needs.

---

## Conflicts Found

| # | Discovery Decision | Research Shows | Recommendation | Resolution |
|---|-----------|---------------|----------------|---------------|
| 1 | Alumni is same user row, role flips to a new value | `APP_ROLES` in `context.ts` is a separate hardcoded array, not DB-enum-derived — must be updated or alumni logins are rejected outright | Add `'alumni'` to `APP_ROLES`, `DEFAULT_ROLE_PERMISSIONS`, and `ROLE_TO_UI`/`ROLE_TO_DB` as one atomic schema-adjacent task, not an afterthought | Adopted — folded into the schema-foundation section as a required task, not optional |
| 2 | Old verification code revoked when a document is reissued | `studentDocuments`/`applicantDocuments`' overwrite-only, one-row-per-type shape cannot hold issuance history | Build a new `alumniDocuments` table with real issuance history (one row per issuance, `supersededAt` on old rows) instead of reusing the existing shape | Adopted — no scope change, same discovery decision, just the correct table shape to actually satisfy it |
| 3 | (Implicit — not a stated discovery decision) Graduation cohort reference | `user`/`applicants` already incorrectly reference the dead `academicYears` table instead of the real `sessionYears` | Alumni's cohort/graduation-year reference should FK into `sessionYears`, not repeat the existing app's own landmine | Adopted — correcting course rather than following flawed precedent, no user decision needed |
| 4 | (Implicit) Verification codes are security-relevant identifiers | `namingSeries`'s only existing consumer (`reserveMatricule`) has no row lock, real (if rare) collision risk | Use `pg_advisory_xact_lock` (already proven elsewhere in this app) when generating alumni verification codes | Adopted — matches an existing proven pattern, not a new mechanism |

No conflicts required a fresh user decision — all four are engineering refinements that either satisfy a discovery decision correctly (a security property that was stated but needed the right table shape) or correct an existing flaw rather than repeat it, consistent with this session's "reuse before invent" and "get it right, not just working" discipline.

---

## Summary and Recommendations

### Key Architecture Decisions
1. Real new `alumni` role value — with all three non-DB touch points (`context.ts`, `permissions.ts`, `userMapping.ts`) updated in the same task, since missing any one silently breaks logins or compiles into an incomplete permission set.
2. A genuinely new, small set of tables for what doesn't already exist: `alumniDocuments` (with issuance history), `alumniEvents` + `alumniEventRsvps`, `alumniDirectoryConsent` (per-field opt-in), `alumniMentorListings`, `alumniRequests` (correction/reissue/deletion, one real request-queue table with a `type` discriminator). Everything else (login credentials, file storage, SMS notification, verification-code counter) reuses already-real mechanisms.
3. The existing fake `alumni-portal-view.tsx` is fully replaced, not extended — its "Cotisation & dons" card is dropped per the explicit donations deferral.

### Risks Identified in Research
1. The role-change operation (student → alumni) has no existing precedent in this codebase to copy — it's new, careful, first-of-its-kind logic (disable old credentials, flip role, issue new credentials, all in one real transaction) and deserves the "yellow" risk rating, not "green."
2. `checkRateLimit`'s in-memory-only limiter (no cross-instance/restart persistence) is an existing, accepted limitation being inherited by the public verification page — not a new gap introduced by this plan, but worth stating plainly so it isn't mistaken for an oversight later.

---

**User Review Status:** Approved
**User Feedback:** Confirmed all 4 refinements — recommended option chosen.
**Proceed to Planning:** Yes
