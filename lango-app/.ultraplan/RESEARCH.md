# UltraPlan Research — Data-Wiring Remediation

## Method
No greenfield tech-stack comparison needed (existing codebase, stack is fixed). "Research" here means the codebase audit — a dedicated Explore agent surveyed the app for hardcoded/mock data versus real backend wiring, verifying against current source rather than trusting the repo's own stale audit docs (`V2-INDEPENDENT-AUDIT.md`, `FULL-APP-AUDIT.md`, `UX-INTERACTIVITY-AUDIT-AND-FIX-PLAN.md`, `AGENT-HANDOFF.md` — all confirmed out of date, some by less than 48 hours).

## Findings Summary

| Category | Count | Detail |
|---|---|---|
| BROKEN (compile errors) | 1 | `homework-submission-view.tsx` |
| MOCK, needs new backend | 9 | exam-planning, rooms, entitlements-catalog, homework-submissions, assessment-policies, report-cards, header-search, reminders-statements, fee-allocation |
| MOCK, backend already exists unused | 19 | classes, schedule, class-subjects, class-section-teachers, syllabus (placeholder instead), attendance, attendance-excuses, bank-reconciliation, journal-explorer, chart-of-accounts, online-payments, pricing-structures, parents-guardians, inquiries-kanban, admission-requests, financial-reports (partial), homework-view (partial), student-transfers, users-pagination (frontend-only, no "backend" needed) |
| MOCK-ADJACENT (real reads, fake actions) | 3 | jobs-audit, providers, migration-readiness |
| REAL, verified | 7 | security-sessions, translations-custom-fields, users-roles, accounting-defaults, organization, header (non-search parts), users-manage (CRUD parts) |
| NOT CHECKED | ~45 | fetch/useSWR/useQuery present, contents not read — Section 19 verification pass, not assumed broken |

## Why No External Research Was Needed
Every "new backend" section has a close, already-proven analog inside this same codebase to copy from (e.g. exam-sessions copies assessment-sessions' shape; rooms copies mediums' shape; grading-policy reuses the existing gradingScales tables). This is deliberate — inventing a new pattern when a proven one already exists in the same repo would be the wrong kind of "research."

## Conflicts With User Preferences
None detected. The codebase audit and the user's Phase 1 answers were consistent throughout — no case where research suggested a different approach than what was decided in Discovery.
