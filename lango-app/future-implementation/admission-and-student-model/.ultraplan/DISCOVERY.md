# UltraPlan Discovery

## Project Idea
Implement `future-implementation/admission-and-student-model/ADMISSION-AND-STUDENT-MODEL-ENHANCEMENT.md` — closing gaps in the admission wizard and real student record: fix the decorative document-upload step, add fields (gender, academic year, profile picture, nationality, mother tongue, city, blood group), route guardian entry through the real `guardians`/`guardianStudents` tables instead of flat duplicate text, and generate real student/guardian login access at approval.

## Codebase Detection
- Codebase found: Yes
- Stack: Next.js 16 App Router, TypeScript, Drizzle ORM, PostgreSQL, Better Auth, Tailwind v4, Docker Compose (app/migrate/db services)
- Patterns: `requireRequestContext` → `requireTenant` → `requireCapability` → Zod `.strict()` → tenant-scoped Drizzle query → `recordAudit()` → `apiErrorResponse()`; `src/libs/api/uploads.ts` shared upload helper (used by student/teacher photos); `guardians`/`guardianStudents` real tables with a working link flow in `parents-guardians-view.tsx`; `smsMessages` log-only simulated-delivery convention used throughout for anything that would otherwise need a real SMS/email gateway
- Condensed discovery: this repo has an established `/ultraplan` precedent (see repo-root `.ultraplan/STATE.md`, academic-management-enhancement plan) of asking a small number of targeted questions instead of the full 40-70 when a detailed source doc + existing codebase already answer most categories. The source doc here already makes explicit, reasoned decisions on: fields to add, fields excluded (with reasoning), page-by-page UI plan, and schema additions. Following the same condensed approach.

## Discovery Q&A

### Batch 1 — Open decisions the source doc left unresolved

**Q: Document upload timing — immediate vs deferred?**
A: Upload immediately, saved against the applicant record as soon as picked. Matches how documents already work for enrolled students; nothing lost if the wizard is abandoned.

**Q: Login-access generation mechanism at approval?**
A: Both invite-link (log-only SMS) and temp-password-shown-once should exist.
Follow-up — is the choice per-school or per-approval? **A: Per-school setting** (one Settings toggle decides the mechanism for the whole school; not a per-approval decision).

**Q: Should guardian search be required before "create new" is available in Step 2?**
A: Yes — search-first, always. "Create new guardian" only becomes available after a search comes back with no match. Prevents duplicate guardian records for siblings.

### Batch 2 — Field values, rollout order, backfill

**Q: Is the Mother Tongue curated list (Arabic/French/Tamazight/English/Other) correct?**
A: Yes, use as-is.

**Q: Nationality — free text or curated country dropdown?**
A: Free text. Matches existing free-text pattern for secondary fields (guardian occupation/address); avoids a full country-list component for a field the source doc itself treats as secondary.

**Q: Rollout order — one combined release or phased?**
A: Phased. Wave 1 = real bug fixes (document upload) + 6 new fields (gender, academic year, nationality, mother tongue, city, blood group). Wave 2 = guardian-linking rework + login-generation (bigger behavior changes, higher risk, ships second).

**Q: Backfill existing students/applicants with the new fields?**
A: No — going forward only. Real dev dataset is tiny (3 students); nothing to backfill, and inventing backfill data isn't warranted.

## Discovery Summary
- Total questions asked: 7 (6 initial + 1 follow-up), condensed per this repo's established `/ultraplan` precedent (existing detailed source doc + existing codebase — see repo-root `.ultraplan/STATE.md`)
- All categories relevant to open decisions covered: scope/phasing (Category 1), integration/login (Category 3), edge cases/data-integrity (Category 4, guardian dedup), existing patterns (Category 6, free-text field convention, log-only SMS convention)
- Categories not separately interrogated: Users & Context (already fully specified — school staff filling admission wizard, no new user type), Quality Attributes (inherits this app's existing multi-tenant/security conventions, no new attribute introduced), Monetization (not applicable — internal school-ops feature, no billing surface), Visual & UX Vision (extends the existing 4-step wizard's existing visual language, no new screen design needed)
- Key themes identified: phased rollout by risk (fields first, behavior-changing guardian/login second); prefer this app's existing conventions (free text, log-only SMS, search-before-create) over inventing new UI patterns; going-forward-only avoids fabricating backfill data for a tiny real dataset

