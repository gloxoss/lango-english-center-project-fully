# UltraPlan Section Index

## Execution Order

| Batch | Section | Name | Risk | Dependencies | Tasks |
|-------|---------|------|------|--------------|-------|
| 1 | 01 | Schema & Migration Foundation | yellow | none | 4 |
| 1 | 04 | Schedule — teacher and room views | green | none | 2 |
| 1 | 07 | Transfers — real KPIs | green | none | 2 |
| 2 | 02 | Households | yellow | 01 | 6 |
| 2 | 03 | Classes | yellow | 01 | 4 |
| 2 | 05 | Reusable question bank | yellow | 01 | 4 |
| 2 | 06 | Admission review | green | 01 | 4 |
| 3 | 08 | Final verification | green | 01, 02, 03, 04, 05, 06, 07 | 3 |

## Summary
- Total sections: 8
- Total tasks: 29
- Parallel batches: 3
- Sequential steps: 3 (minimum batches to complete)
- Risk breakdown: 4 green, 4 yellow, 0 red

## Dependency Graph
```
Batch 1: [01] [04] [07]
Batch 2: [02] [03] [05] [06]   (all depend on 01)
Batch 3: [08]                  (depends on everything)
```

## How to Execute
1. Start with Batch 1 (sections 01, 04, 07). These have no dependencies on each other and can run in parallel, but section 01 (schema) is the critical path — batch 2 cannot start until it's fully applied and verified (task 01-04).
2. When Batch 1 is complete, move to Batch 2 (sections 02, 03, 05, 06). All four can run in parallel — they touch entirely different files and different feature areas.
3. After Batch 2 completes, run Batch 3 (section 08) — full live verification and regression check.
4. After each section, run its TDD test stubs to verify before moving on.
5. No new capability strings are introduced anywhere in this plan — every new route reuses an existing capability already governing the same resource domain. `src/libs/api/permissions.ts` is never touched.
