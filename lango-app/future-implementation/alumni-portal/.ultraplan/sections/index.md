# UltraPlan Section Index — Alumni Portal

## Execution Order

| Batch | Section | Name | Risk | Dependencies | Tasks |
|-------|---------|------|------|--------------|-------|
| 1 | 01 | Schema & Role Foundation | yellow | none | 5 |
| 2 | 02 | Graduation Transition | yellow | 01 | 4 |
| 2 | 03 | Alumni Portal Shell & Announcements | green | 01, 02 | 5 |
| 3 | 04 | Records & Document Verification | yellow | 01, 03 | 4 |
| 3 | 06 | Alumni Events & RSVP | green | 01, 03 | 3 |
| 3 | 07 | Opt-In Directory & Safeguarding | yellow | 01, 03 | 4 |
| 3 | 08 | Mentoring & Volunteering Listing | green | 01, 03, 07 | 3 |
| 4 | 05 | Correction/Reissue/Data/Deletion Requests | yellow | 01, 03, 04 | 3 |
| 5 | 09 | Final Verification | green | all | 4 |

## Summary
- Total sections: 9
- Total tasks: 35 (task count updated during Phase 4 review — bulk transition added to section-02 per a refinement question)
- Parallel batches: 5
- Risk breakdown: 5 yellow, 4 green, 0 red

## Dependency Graph
```
Batch 1: [01]
Batch 2: [02] [03]              (both depend on 01; 03 also needs 02 for a real account to test login)
Batch 3: [04] [06] [07] [08]    (08 specifically needs 07's safeguarding helper, 07-01)
Batch 4: [05]                   (needs 04's document/verification-code mechanics)
Batch 5: [09]                   (depends on everything)
```

## How to Execute
1. Section 01 (schema/role foundation) is the hard critical path — nothing else can build real logic without it, and it includes the easy-to-miss non-DB role touch points (`APP_ROLES`, `DEFAULT_ROLE_PERMISSIONS`, `ROLE_TO_UI`/`ROLE_TO_DB`).
2. Section 02 (transition) is the single highest-risk section in this plan — the first-ever post-creation role change in this codebase. Build and verify it thoroughly before treating it as done.
3. Sections 04, 06, 07 can run in parallel once 01+03 are done; section 08 waits specifically on 07's safeguarding helper (task 07-01), not all of section 07.
4. Section 05 (requests) needs section 04's document mechanics for its reissue branch — don't start it before 04 is real and verified.
5. Section 09 (final verification) is last, always.
6. No new capability strings beyond a small, real, minimal `alumni.*` set added once in section-01 — reused everywhere else, not re-invented per section.
