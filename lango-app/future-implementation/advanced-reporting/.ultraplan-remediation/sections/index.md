# UltraPlan Section Index — Advanced Reporting Addon Remediation

## Execution Order

| Batch | Section | Name | Risk | Dependencies | Tasks |
|-------|---------|------|------|--------------|-------|
| 1 | 01 | Schema & Seeding Foundation | green | none | 3 |
| 1 | 03 | Fix Fabricated Adapter Data | yellow | none | 4 |
| 2 | 02 | Route Layer Hardening | red | 01 | 6 |
| 2 | 04 | Run Engine Real-Data Wiring | yellow | 01, 03 | 3 |
| 2 | 05 | Real Exports & Durable Storage | yellow | 01 | 4 |
| 3 | 06 | Real Scheduler Worker | red | 04, 05 | 4 |
| 3 | 07 | Wire HMAC-Signed Download URLs | yellow | 02, 05 | 2 |
| 3 | 08 | Missing UI Pieces & Navigation Fix | green | 02, 04 | 3 |
| 3 | 09 | Rebuild the Golden-Dataset Test Suite | yellow | 02, 03 | 2 |
| 4 | 10 | Final Verification | green | 01-09 (all) | 4 |

## Summary
- Total sections: 10
- Total tasks: 35
- Parallel batches: 4
- Sequential steps: 4 (minimum batches to complete)
- Risk breakdown: 3 green (01, 08, 10), 5 yellow (03, 04, 05, 07, 09), 2 red (02, 06)

## Dependency Graph
```
Batch 1: [01] [03]
Batch 2: [02] [04] [05]
Batch 3: [06] [07] [08] [09]
Batch 4: [10]
```

## How to Execute
1. Start with Batch 1 (sections 01, 03 — no shared files, safe to run in either order or interleaved).
2. When Batch 1 is complete, move to Batch 2 (sections 02, 04, 05).
3. When Batch 2 is complete, move to Batch 3 (sections 06, 07, 08, 09).
4. Section 10 (Final Verification) runs last, after everything else, and is the only section requiring live database/Docker verification rather than pure code changes.
5. After each section, run its TDD test stubs to verify before moving on.
