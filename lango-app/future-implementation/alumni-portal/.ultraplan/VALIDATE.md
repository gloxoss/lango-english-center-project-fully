# UltraPlan Validation: Alumni Portal

> Generated: 2026-08-06
> Phase: 5/6 - VALIDATE
> Requirements traced: 20
> Gaps found: 0
> Scope creep items: 0 unapproved (1 legitimate refinement-driven addition: bulk transition)

---

## Traceability Matrix

| # | Requirement (from Discovery) | PRD Section | Plan Section | Task IDs | Status |
|---|------------------------------|-------------|--------------|----------|--------|
| 1 | Build all 4 delivery phases now, safeguarding baked in | What It Does | all | all | Covered |
| 2 | Real, separate self-service alumni login | Must Have — self-service login | section-01, section-02, section-03 | 01-01–03, 02-01, 03-02 | Covered |
| 3 | Alumni = same user row, role flips to new value | Must Have | section-01, section-02 | 01-01, 01-02, 01-03, 02-01 | Covered |
| 4 | Manual admin transition trigger, real confirmation | Must Have | section-02 | 02-01, 02-04 | Covered |
| 5 | Old student login disabled; new alumni credentials issued | Must Have | section-02 | 02-01 | Covered |
| 6 | 18+ safeguarding cutoff, fail-closed on unknown age | Must Have — minors safeguarding | section-07 | 07-01 | Covered |
| 7 | Public, no-login document verification (genuine/not, no file exposure) | Must Have — document verification | section-01, section-04 | 01-01, 04-03, 04-04 | Covered |
| 8 | Correction requests via real staff-reviewed queue | Must Have | section-05 | 05-01, 05-02, 05-03 | Covered |
| 9 | Reissue via real staff-reviewed queue, old code revoked | Must Have | section-01, section-04, section-05 | 01-01, 04-01, 05-02 | Covered |
| 10 | school_admin administers, no new staff role | (implicit, capability reuse) | all | all (cap reuse, no new role) | Covered |
| 11 | Alumni events: self-contained, not blocked on event-management addon | Must Have | section-06 | 06-01, 06-02, 06-03 | Covered |
| 12 | Mentoring: opt-in listing only, no automated matching | Must Have | section-08 | 08-01, 08-02, 08-03 | Covered |
| 13 | Deletion request: community data only, legal records untouched | Must Have — data requests | section-05 | 05-02 (deletion branch) | Covered |
| 14 | Directory consent: per-field toggles | Must Have | section-07 | 07-02, 07-03, 07-04 | Covered |
| 15 | Re-admission: role flips back, access suspended not deleted | Should Have | section-02 | 02-03 | Covered |
| 16 | Notifications via existing real SMS pattern | Should Have | section-03 | 03-05 | Covered |
| 17 | Old verification code revoked on reissue | Must Have | section-01, section-04, section-05 | 01-01, 04-03, 05-02 | Covered |
| 18 | Bulk transition for a whole graduating cohort | (Phase 4 refinement) | section-02 | 02-02, 02-04 | Covered |
| 19 | No automated reissue notification | (Phase 4 refinement, confirms absence) | section-05 | — (deliberately not built) | Covered (explicit exclusion) |
| 20 | Per-IP rate limit acceptable, no partner-tier exception | (Phase 4 refinement, confirms as-is) | section-04 | 04-03 | Covered |
| 21 | Donations/fundraising deferred | What It Does NOT | — | — | Excluded (source doc + user confirmed) |
| 22 | No automated mentor-matching/accept-decline workflow | What It Does NOT | section-08 (simple listing only) | 08-01, 08-02 | Excluded by design (built as decided) |
| 23 | No dependency on the general school events system | What It Does NOT | section-06 (self-contained instead) | 06-01 | Excluded by design (built as decided) |
| 24 | The existing fake alumni portal UI is replaced, not extended | (research finding) | section-03 | 03-01 | Covered |

### Coverage Summary

- **Total requirements extracted:** 24 (20 discovery/refinement items + 3 explicit exclusions + 1 research-driven cleanup item)
- **Fully covered:** 21
- **Missing (gaps):** 0
- **Scope creep (extra):** 0 unapproved
- **Excluded by explicit design/user choice:** 3 (donations, automated matching, general events dependency) — all correctly reflected as absence, not oversight

**Coverage rate:** 100% (21/21 in-scope requirements covered; 3/3 explicit exclusions correctly excluded, not silently dropped)

---

## Gap Resolution Log

No gaps detected. All in-scope requirements trace to plan tasks.

---

## Scope Creep Detection

| # | Plan Task(s) | Section | Justification | Status |
|---|-----------|---------|---------------|---------------|
| 1 | 02-02, 02-04 (bulk transition) | section-02 | Added during Phase 4 refinement questions, not original discovery — but directly requested and approved by the user at that checkpoint, not silently added | Legitimate — approved scope addition, logged in PLAN.md's Review Notes |

### Legitimate Additions (infrastructure, no direct 1:1 discovery requirement)

- **section-01** (schema/role foundation) and **section-09** (final verification) — standard infrastructure/closing work every plan this session has needed, not scope creep.
- **`src/libs/services/alumni-verification-code.ts`, `alumni-safeguarding.ts`** — shared helpers extracted because 2+ call sites needed the identical logic (verification-code generation used by both issuance and reissue; safeguarding check used by both directory and mentoring) — matches this session's established shared-helper-extraction discipline, not unrequested abstraction.

---

## Cross-Reference Checks

### PRD Completeness

| PRD Section | Plan Sections | Status |
|-------------|---------------|--------|
| What We're Building | all | Covered |
| The Problem | all (context) | Covered |
| Who It's For | 01, 02, 03 (role/capability reuse) | Covered |
| What It Does | 02–08 | Covered |
| How It Should Feel | 03 (shell), cross-cutting Execution Notes | Covered |
| What It Connects To | 02 (credential reuse), 03 (SMS reuse), 04 (upload-helper reuse) | Covered |
| What It Does NOT Do | — (verified absent from all sections) | Covered |
| How We'll Know It Works | 09 | Covered |
| Business Model | N/A | N/A (correctly unaddressed) |
| Risks & Concerns | 02 (novel role-change risk), 01 (3-touch-point role risk), 04 (public endpoint risk) | Covered |

### Dependency Integrity
- **Circular dependencies found:** none — clean DAG (01 → {02,03} → {04,06,07→08} → 05 → 09)
- **Missing dependency declarations:** none — every section's stated deps match `sections/index.md`
- **Orphaned sections:** none — every section blocks something or is blocked by 09 transitively

### Task Integrity
- **Tasks with missing files:** none
- **Tasks with missing verification:** none — every task has a concrete, observable `<verify>` block, several with explicit psql/curl confirmation steps given the security sensitivity
- **Tasks with missing done criteria:** none

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
