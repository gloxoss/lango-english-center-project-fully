# UltraPlan Summary — Admission Flow & Student Model Enhancement

## What We're Building
Fixing and completing SchoolOS's admission wizard: real document upload (currently decorative), 6 new admission fields (gender, academic year, nationality, mother tongue, city, blood group), real parent/guardian linking through the existing guardians system instead of flat text, and real login-access generation the moment a student is approved.

## Key Features
- Real document upload during admission, saved against a new `applicantDocuments` table since no student record exists yet at that point in the wizard
- 6 new fields collected in Step 1 and carried onto the real student record at approval
- A real bug fix found during research: approved students were getting random, wrong-format ID numbers instead of the school's real sequential ones
- Guardian search-before-create in Step 2, preventing duplicate guardian records for siblings
- School-wide choice between invite-link (SMS, log-only simulated delivery) and temp-password login access, generated automatically at approval
- A regenerate-access action for when the original delivery never reaches the guardian (added during Review)

## Tech Stack
Next.js 16 App Router, Drizzle ORM, PostgreSQL, Better Auth — no new framework or library. One genuinely new mechanism: programmatic Better Auth account creation (nothing like it exists in this codebase yet, which is why Section 05 is rated red risk and ends in a mandatory user-verified checkpoint).

## Risk Areas
- [red] Section 05 (Login Access Generation) — new territory for this codebase, security-sensitive, must be verified end-to-end with the user before considered done
- [yellow] Section 03 (Approval Transaction Fixes) — every later section extends this same transaction
- [yellow] Section 04 (Guardian Search-and-Link) — real workflow change for admin staff, not just a new field
- [green] Section 01 (Applicant Documents) — structural copy of an already-working pattern
- [green] Section 02 (Student New Fields) — plain schema and form additions

## Plan Structure
- 5 sections, 26 total tasks
- 4 batches: sections 01+02 in parallel, then 03 → 04 → 05 strictly sequential (all three extend the same approval transaction)
- Wave 1 (ship first): sections 01, 02, 03 — real bug fixes + new fields
- Wave 2 (ship second): sections 04, 05 — bigger behavior changes

## Known collision risk in this repo
As of this plan, `migrations/0044_pf03_organisation_identity.sql` exists on disk unjournaled, while the journal references a missing `0053_waitlist_leads.sql` — a concurrent session's in-progress migration state. Every migration task in this plan re-checks the true highest number at execution time rather than trusting a number written anywhere in these documents.

## How to Execute This Plan
1. Open any AI coding tool (Claude Code, Cursor, etc.)
2. Share the `future-implementation/admission-and-student-model/.ultraplan/` folder
3. Say: "Read future-implementation/admission-and-student-model/.ultraplan/sections/index.md and execute section 1"
4. Sections 01 and 02 can run in parallel. After both finish, execute 03, then 04, then 05 — strictly in order, since each extends the same approval transaction the last one just touched.
5. Do not consider Section 05 done until its checkpoint task (05-07) has been walked through and confirmed working by a human.

## How to Update This Plan
This isolated plan doesn't use the repo-root `/ultraplan update` command (that targets the repo-root `.ultraplan/`, a different, completed plan). To change this plan, re-open this conversation and describe what changed — only the affected section files should be touched, not a full regeneration.
