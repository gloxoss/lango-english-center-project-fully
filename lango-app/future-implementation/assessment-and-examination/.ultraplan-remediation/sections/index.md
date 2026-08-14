# UltraPlan Section Index — Assessment & Examination Remediation

## Execution Order

| Batch | Section | Name | Risk | Dependencies | Tasks |
|-------|---------|------|------|--------------|-------|
| 1 | 01 | Fix Live Online-Exam Security Bugs | red | none | 3 |
| 1 | 02 | Fix Homework Audience Scoping | green | none | 1 |
| 1 | 03 | Exam Master Routes | yellow | none | 4 |
| 2 | 04 | Exam Master UI Wiring | green | 03 | 1 |
| 2 | 05 | Rebuild Real Test Suite | yellow | 01, 02 | 1 |
| 3 | 06 | Final Verification | green | 01-05 (all) | 2 |

## Summary
- Total sections: 6
- Total tasks: 12
- Parallel batches: 3
- Risk breakdown: 1 red (01), 2 yellow (03, 05), 3 green (02, 04, 06)

## Dependency Graph
```
Batch 1: [01] [02] [03]
Batch 2: [04] [05]
Batch 3: [06]
```

## How to Execute
1. Batch 1: sections 01, 02, 03 (no shared files, independent).
2. Batch 2: sections 04 (needs 03's routes), 05 (needs 01/02's fixed logic to test).
3. Batch 3: section 06, last.
