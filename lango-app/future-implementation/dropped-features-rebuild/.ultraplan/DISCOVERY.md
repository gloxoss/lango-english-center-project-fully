# UltraPlan Discovery

## Project Idea
Rebuild the 6 dropped/disclosed-as-fake feature areas across Élèves & Profils (Households/Tuteurs, Admission, Transfers) and Matières & Classes (Classes, Schedule, Question Bank) with real schema-backed logic and better UI/UX. See `.ultraplan/STATE.md` "Idea" section for the full pre-scoped brief and the 4 design decisions already locked in via AskUserQuestion before this plan started (household model = shared-student guardians, teaching-models dropped as a Mediums duplicate, transfers stay direct-action with no approval workflow, execution runs through /ultraplan).

## Codebase Context
Existing, actively-developed codebase: SchoolOS/Lango, Next.js 15 App Router + TypeScript + Drizzle ORM + PostgreSQL + Better Auth + Tailwind. Multi-tenant (`tenantId` scoping everywhere), established route convention (`requireRequestContext` → `requireTenant` → `requireCapability` → Zod `.strict()` → tenant-scoped query → `recordAudit()` → `apiErrorResponse()`). This exact repo has multiple prior completed `/ultraplan` runs this session/other sessions (admission-and-student-model, academic-management-enhancement) — precedent is condensed discovery (not the full 40-70) when the idea is already well-scoped by real codebase context and prior user decisions, which is the case here. Category coverage below stays complete per protocol, but question volume is scaled to genuinely open decisions rather than padded.

## Discovery Q&A

<!-- Categories: 9 total -->
<!-- Progress is tracked per category -->

### Category 1: Core Requirements — Households (batch 1/many)

**Q: Pickup authorization was dropped from Tuteurs & foyers and not covered by the pre-plan decisions — bring it back for real?**
A: Yes — real boolean/flag field on the `guardianStudents` link, marking who is authorized to pick up which student.

**Q: Who can be an emergency contact for a household?**
A: Any of the student's linked guardians (existing `guardianStudents` rows), with a real priority/order field added so front desk knows who to call first. No new contact table — stays inside the "no new households table" decision.

**Q: What communication preferences should be real/configurable?**
A: Email opt-in, SMS opt-in, and preferred language — real fields on the guardian record. SMS already has a real (simulated/logged) delivery path via `smsMessages`; this makes the channel opt-in/out real instead of always-on.

**Q: Should household payment history aggregate across all the guardian's linked students, or stay per-student?**
A: Aggregate across every student the guardian is linked to — a guardian with 3 kids sees all 3 kids' invoices/payments in one household view. Uses only the existing real `invoices`/`payments` tables.

### Category 1: Core Requirements — Classes & Schedule (batch 2/many)

**Q: What values should the real "cycle" field on classes hold?**
A: Maternelle / Primaire / Collège / Lycée — standard Moroccan school cycles, matching the ESchool/Moroccan business-logic reference already governing this app.

**Q: Main teacher / room assignment — class level or class-section level?**
A: Class-section level (e.g. "2nde A" gets its own homeroom teacher and home-base room) — matches `classSections` being the real enrollment unit everywhere else in the app.

**Q: Build schedule teacher-view/room-view now, or defer?**
A: Build both now — no new schema, same real `timetableSlots` data regrouped by `teacherId`/`roomId` instead of `classSectionId`.

**Q: Rebuild the drag-and-drop schedule grid?**
A: Skip it — keep the real day-list UI. Pure UX nicety over the same data, not worth the cost alongside the other 5 real feature builds in this plan.

### Category 1: Core Requirements — Question Bank & Admission (batch 3/many)

**Q: Question difficulty scale?**
A: Facile / Moyen / Difficile — simple 3-tier enum, French-labeled.

**Q: When a bank question is copied into an exam, independent copy or live-linked reference?**
A: Independent copy — inserts a new `onlineExamQuestions` row with its own options. Editing the bank original never silently changes exams that already used it (important once an exam is published/taken).

**Q: Admission interviews — one per applicant or multiple rounds?**
A: One interview per applicant — real interviewer/datetime/location fields on the applicant record via a new `admissionInterviews` table, single-stage.

**Q: Admission review checklist — fixed or per-tenant configurable?**
A: Fixed checklist items (small hardcoded set: pièces reçues, entretien fait, dossier complet, etc.) stored as checkable flags per applicant. No per-tenant configuration UI.

### Category 4: Edge Cases (batch 1/1)

**Q: Empty household — student with zero linked guardians, what should the view show?**
A: Honest empty state ("Aucun tuteur lié") with a real "Lier un tuteur" action — no fabricated placeholder. (Single-option case — stated directly rather than asked, since there was no genuine second choice.)

**Q: Admission comments thread — staff-only or also visible to applicant/guardian?**
A: Staff-only internal notes. Never shown to the applicant/guardian — matches internal admissions review-note conventions, avoids needing a new guardian-facing admission-status surface.

**Q: Transfers KPIs — what should the real numbers show?**
A: Transfers this month (count of transfer audit-log entries) + live students-per-branch headcount. No new schema — both come from existing `auditLogs`/`branches`/`user` tables.

### Category 5: Quality Attributes / Category 7: Preferences (batch 1/1)

**Q: Should scheduling an admission interview notify the guardian?**
A: No — internal staff record only, no automated messaging pipeline for this build.

**Q: Question bank tagging — real subject+cycle, or free-text tags?**
A: Real subject (existing subjects table) + the new cycle field — filterable, no typos, no drift into duplicate ad-hoc tags.

### Categories 2, 3, 6, 8, 9 — inherited, no new decision needed

- **Users & Context (2):** All 6 features are `school_admin`/staff-facing, same as every other module in this app. No new role introduced. Capability checks reuse existing granular capabilities per module (`students.*` for households/admission/transfers, `academics.*` for classes/schedule/question-bank) rather than inventing new capability strings — matches this app's existing convention exactly, not a new decision.
- **Integration Points (3):** No external systems. Pure extension of the existing Drizzle/PostgreSQL stack, reusing `auditLogs`, `smsMessages` (log-only), `invoices`/`payments`, `rooms`, `guardianStudents` as already decided above.
- **Existing Patterns (6):** Route convention (`requireRequestContext` → `requireTenant` → `requireCapability` → Zod `.strict()` → tenant-scoped query → `recordAudit()` → `apiErrorResponse()`) applies unchanged to every new route in this plan — same as every prior section this session.
- **Monetization (8):** N/A — internal school-admin tooling, no billing/pricing surface touched.
- **Visual & UX Vision (9):** No visual redesign. Same design system already governing this app (slate/blue palette, KPI banners, data-dense tables, inspector sidebars) — matches the existing pattern used for every other rebuilt page this session, not a new decision.

## Discovery Summary
- Total questions asked: 18 (across 5 focused batches, all "(Recommended)" options chosen — 0 "Other" custom answers)
- Categories fully covered: 1 (Core Requirements), 4 (Edge Cases)
- Categories covered via direct inheritance from established app conventions (no new decision required): 2, 3, 5, 6, 7, 8, 9
- Key themes: reuse-before-invent held throughout (no new household/emergency-contact table, no new payment-card storage, no config-per-tenant checklist); every genuinely new table is small and single-purpose (`admissionInterviews`, `admissionComments`, a reusable question-bank table); UX stays consistent with the existing design system, no new visual language.
