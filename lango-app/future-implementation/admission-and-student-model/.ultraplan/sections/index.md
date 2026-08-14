# UltraPlan Section Index

## Execution Order

| Batch | Section | Name | Risk | Dependencies | Tasks |
|-------|---------|------|------|---------------|-------|
| 1 | 01 | Applicant Documents | green | none | 7 |
| 1 | 02 | Student New Fields | green | none | 5 |
| 2 | 03 | Approval Transaction Fixes | yellow | 01, 02 | 3 |
| 3 | 04 | Guardian Search-and-Link | yellow | 03 | 4 |
| 4 | 05 | Login Access Generation | red | 04 | 7 |

## Summary
- Total sections: 5
- Total tasks: 26
- Parallel batches: 4
- Sequential steps: 4 (01/02 parallel, then 03, 04, 05 strictly sequential — all three edit the same approval transaction in `PUT /api/students/admissions`)
- Risk breakdown: 2 green (01, 02), 2 yellow (03, 04), 1 red (05)

## Wave mapping (from Discovery's phased-rollout decision)
- **Wave 1** (real bug fixes + new fields, ships first): sections 01, 02, 03
- **Wave 2** (bigger behavior changes, ships second): sections 04, 05

## Dependency Graph
```
Batch 1: [01] [02]
Batch 2: [03]  (needs 01's applicantDocuments + 02's new columns)
Batch 3: [04]  (needs 03's transaction state; same function, sequential not parallel)
Batch 4: [05]  (needs 04's guardian link for invite delivery target)
```

## How to Execute
1. Start with Batch 1 — sections 01 and 02 can run in parallel, they touch different files.
2. Section 03 is the convergence point — it edits the same approval transaction both 01 and 02 feed into. Do not start it until both 01 and 02 are complete.
3. Sections 03, 04, 05 are strictly sequential — each one further extends the same `PUT /api/students/admissions` transaction. Running them in parallel would mean two agents editing the same function at once.
4. Section 05 ends in a mandatory checkpoint (task 05-06) — do not consider the plan complete until the user has verified both login-access mechanisms actually work.
5. After each section, run its TDD test stubs before moving to the next.
