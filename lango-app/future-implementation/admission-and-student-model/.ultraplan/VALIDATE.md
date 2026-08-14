# Traceability Matrix

## Summary
- Total requirements traced (source doc + Discovery + Review refinements): 24
- Requirements fully covered: 24
- Requirements excluded by design (source doc's own explicit exclusions): 7, all correctly reflected as absence-of-task, not silently dropped
- Tasks added beyond a directly-stated requirement (justified architectural enablers): 4 (all disclosed below, none unexplained)

## Requirement-to-Task Mapping

| # | Requirement | PRD Section | Plan Section | Task IDs | Status |
|---|---|---|---|---|---|
| 1 | Fix decorative document-upload step | What It Does (Must Have Wave 1) | section-01 | 01-01..01-07 | Covered |
| 2 | Add Gender field | What It Does | section-02 | 02-01, 02-02, 02-03, 02-05 | Covered |
| 3 | Add Academic Year field | What It Does | section-02 | 02-01, 02-02, 02-04, 02-05 | Covered |
| 4 | Add Nationality field (free text, per Discovery) | What It Does | section-02 | 02-01, 02-02, 02-05 | Covered |
| 5 | Add Mother Tongue field (Arabic/French/Tamazight/English/Other, per Discovery) | What It Does | section-02 | 02-01, 02-02, 02-05 | Covered |
| 6 | Add City field | What It Does | section-02 | 02-01, 02-02, 02-05 | Covered |
| 7 | Add Blood Group field (optional) | What It Does | section-02 | 02-01, 02-02, 02-05 | Covered |
| 8 | Profile picture set automatically from admission photo | What It Does | section-03 | 03-03 | Covered |
| 9 | Real guardian linking, search-existing-first (per Discovery) | What It Does (Must Have Wave 2) | section-04 | 04-01..04-04 | Covered |
| 10 | Real student/guardian login access on approval | What It Does (Must Have Wave 2) | section-05 | 05-01..05-05, 05-07 | Covered |
| 11 | Login mechanism = school-wide setting, both invite-link and temp-password (per Discovery) | What It Does | section-05 | 05-02, 05-03 | Covered |
| 12 | Random-matricule bug (found during Research, not in source doc) | Risks & Concerns | section-03 | 03-01 | Covered |
| 13 | Concurrent-approval race condition (found during Review) | Risks & Concerns | section-03 | 03-01 | Covered |
| 14 | Upload-immediately architecture (per Discovery conflict resolution) | Risks & Concerns #1 | section-01 | 01-01..01-03 | Covered |
| 15 | No backfill of existing students (per Discovery) | What It Does NOT Do | — | — | Covered by omission (no backfill task exists, by design) |
| 16 | Caste / Category / Religion / "State" / Transport / Hostel / second Roll Number system | What It Does NOT Do | — | — | Excluded by design (source doc's own reasoning, not revisited) |
| 17 | Keep documents after a rejected admission (Review refinement) | — | — | — | Covered by omission (no deletion task exists, by design) |
| 18 | Allow duplicate applicant emails (Review refinement) | — | — | — | Covered by omission (no uniqueness constraint added, by design) |
| 19 | Regenerate login access after the fact (Review refinement) | Risks & Concerns | section-05 | 05-06 | Covered |
| 20 | Guardian search uses simple partial-text matching, not fuzzy (Review refinement) | — | section-04 | 04-04 | Covered |
| 21 | Blood group has no restricted visibility beyond the rest of the profile (Review refinement) | — | — | — | Covered by omission (no access-control task added, by design) |
| 22 | Academic years list endpoint (justified enabler for #3, not directly requested) | — | section-02 | 02-04 | Covered (justified addition) |
| 23 | Applicant PATCH endpoint (justified enabler for #1/#9, not directly requested) | — | section-01 | 01-04 | Covered (justified addition) |
| 24 | Move applicant creation to Step 1 completion (justified enabler for #1, not directly requested) | — | section-01 | 01-05, 01-07 | Covered (justified addition) |

## Scope-creep check (tasks without a traced requirement)

None found. Every task in every section file traces to a row above — either a directly-stated requirement or a disclosed architectural enabler for one.

## Gap Resolution Log

No gaps required resolution — every requirement identified across Discovery, Research, and Review already had a home in an existing section before this phase began. This phase's job was confirming that, not fixing anything.
