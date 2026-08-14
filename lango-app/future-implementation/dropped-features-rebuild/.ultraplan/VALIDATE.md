# UltraPlan Validation: Dropped-Features Rebuild

> Generated: 2026-08-06
> Phase: 5/6 - VALIDATE
> Requirements traced: 18
> Gaps found: 0
> Scope creep items: 0 unapproved (2 legitimate infrastructure additions documented below)

---

## Traceability Matrix

| # | Requirement (from Discovery) | PRD Section | Plan Section | Task IDs | Status |
|---|------------------------------|-------------|--------------|----------|--------|
| 1 | Pickup authorization per guardian/student | What It Does — Family view | section-01, section-02 | 01-01, 01-02, 02-01, 02-05 | Covered |
| 2 | Emergency-contact ranking among linked guardians | What It Does — Family view | section-01, section-02 | 01-01, 01-02, 02-01, 02-02, 02-05 | Covered |
| 3 | Communication preferences (email/SMS opt-in, language) | What It Does — Family view | section-01, section-02 | 01-01, 01-02, 02-02, 02-05 | Covered |
| 4 | Household payment history aggregated across linked students | What It Does — Family view | section-02 | 02-03, 02-06 | Covered |
| 5 | Real class cycle field (Maternelle/Primaire/Collège/Lycée) | What It Does — Class setup | section-01, section-03 | 01-01, 01-02, 03-01, 03-04 | Covered |
| 6 | Homeroom teacher + home room at class-section level | What It Does — Class setup | section-01, section-03 | 01-01, 01-02, 03-02, 03-03, 03-04 | Covered |
| 7 | Real enrollment capacity (maxStudents) on class-sections | What It Does — Class setup | section-01, section-03 | 01-01, 01-02, 03-02, 03-04 | Covered |
| 8 | Schedule teacher-view and room-view | What It Does — Schedule views | section-04 | 04-01, 04-02 | Covered |
| 9 | Drag-and-drop visual schedule grid | What It Does NOT Do (explicitly deferred) | — | — | Excluded (user choice) |
| 10 | Question difficulty scale (Facile/Moyen/Difficile) | What It Does — Question bank | section-01, section-05 | 01-01, 01-02, 05-01, 05-04 | Covered |
| 11 | Reusable cross-exam question bank, independent-copy model | What It Does — Question bank | section-01, section-05 | 01-01, 01-02, 05-02, 05-03, 05-04 | Covered |
| 12 | Question bank tagging by real subject + cycle | What It Does — Question bank | section-01, section-05 | 01-01, 01-02, 05-01, 05-02, 05-04 | Covered |
| 13 | Single real interview per applicant | What It Does — Admission tracking | section-01, section-06 | 01-01, 01-02, 06-01, 06-04 | Covered |
| 14 | Staff-only internal admission comments thread | What It Does — Admission tracking | section-01, section-06 | 01-01, 01-02, 06-02, 06-04 | Covered |
| 15 | Fixed 3-item admission review checklist | What It Does — Admission tracking | section-01, section-06 | 01-01, 01-02, 06-03, 06-04 | Covered |
| 16 | Interview scheduling triggers a guardian notification | What It Does NOT Do (explicitly deferred) | — | — | Excluded (user choice) |
| 17 | Real transfer KPIs (transfers this month, students per branch) | What It Does — Transfer numbers | section-07 | 07-01, 07-02 | Covered |
| 18 | Honest empty state for a student with zero linked guardians | Risks & Concerns / edge case | section-02 | 02-05 | Covered |
| 19 | Exclude rebuilding the "Création manuelle" duplicate tab | What It Does NOT Do | — | — | Excluded (user choice, confirmed intentional pre-existing drop, not this plan's gap) |

### Coverage Summary

- **Total requirements extracted:** 19 (18 discovery Q&A items + 1 carried-forward pre-plan exclusion)
- **Fully covered:** 16
- **Missing (gaps):** 0
- **Scope creep (extra):** 0 unapproved
- **Removed by user:** 0
- **Excluded by explicit user choice:** 3 (drag-and-drop grid, interview notification, manual-creation-tab rebuild)

**Coverage rate:** 100% (16/16 in-scope requirements covered; 3/3 explicitly-excluded items correctly excluded, not silently dropped)

---

## Gap Resolution Log

No gaps detected. All in-scope discovery requirements trace to plan tasks.

---

## Scope Creep Detection

No unapproved scope creep detected. Two categories of legitimate, necessary additions exist and are documented below rather than hidden:

| # | Plan Task(s) | Section | Justification | Status |
|---|-----------|---------|---------------|---------------|
| 1 | 01-01 (5 indexes), 02-03 (pagination/N+1 fix), 05-02 (pagination) | section-01, section-02, section-05 | Surfaced during Phase 4's Scalability review, not from Discovery directly — necessary for the aggregation/list features Discovery *did* request to perform correctly at real scale, not a new feature | Legitimate — supports requirements #2, #4, #11, #12 |
| 2 | 05-02 DELETE handler | section-05 | Surfaced during Phase 4's refinement questions (bank-item deletion) — a genuinely missing piece of requirement #11 (a reusable bank needs a delete path), not a new requirement | Legitimate — completes requirement #11 |

### Legitimate Additions

- **section-01** (schema foundation) and **section-08** (final verification) have no direct 1:1 discovery requirement — they are infrastructure that every other section depends on (schema) or that closes out the plan the way every prior phase of this session has (live verification, regression check). Both are standard, expected additions for any technical plan of this shape and match this session's own established completion discipline, not scope creep.

---

## Cross-Reference Checks

### PRD Completeness

| PRD Section | Plan Sections | Status |
|-------------|---------------|--------|
| What We're Building | all | Covered |
| The Problem | all | Covered (context, not a build target) |
| Who It's For | all (capability reuse decisions) | Covered |
| What It Does | 02, 03, 04, 05, 06, 07 | Covered |
| How It Should Feel | 02, 03, 04, 05, 06, 07 (Execution Notes) | Covered |
| What It Connects To | 01, 02 (auditLogs/smsMessages reuse) | Covered |
| What It Does NOT Do | — (verified as correctly absent from all sections) | Covered |
| How We'll Know It Works | 08 | Covered |
| Business Model | N/A | N/A (not applicable, correctly unaddressed) |
| Risks & Concerns | 01 (homeroom TOCTOU), 05 (independent-copy), 02 (N+1 fix) | Covered |

### Dependency Integrity

- **Circular dependencies found:** none — batch graph is a clean DAG (01/04/07 → 02/03/05/06 → 08)
- **Missing dependency declarations:** none — every section's "Depends on"/"Blocks" pair is mutually consistent with `sections/index.md`
- **Orphaned sections (no connections):** none — every section either blocks section-08 directly or transitively via a batch-2 section

### Task Integrity

- **Tasks with missing files:** none — every task specifies 1-3 real files
- **Tasks with missing verification:** none — every task has a concrete, observable `<verify>` block
- **Tasks with missing done criteria:** none — every task has a factual `<done>` statement

---

## Final Approval Status

**Validation result:** PASSED

**Unresolved items:** 0

### User Sign-off

**User approved:** Yes
**Approval timestamp:** 2026-08-06
**User comments:** Confirmed recommended option — finalize as-is.

### Ready for Output

**Proceed to Phase 6 (OUTPUT):** Yes
