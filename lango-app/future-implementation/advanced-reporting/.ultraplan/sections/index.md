# UltraPlan Section Index — Advanced Reporting Add-on

## Execution Order

| Batch | Section | Name | Risk | Dependencies | Tasks |
|-------|---------|------|------|--------------|-------|
| 1 | 01 | Schema & Migration Foundation | yellow | none | 4 |
| 2 | 02 | Report Catalog Core & Registry | green | 01 | 4 |
| 2 | 03 | Run Engine & Export Generators | yellow | 01 | 4 |
| 3 | 04 | Shared Reporting UI Workspaces | green | 02, 03 | 4 |
| 3 | 05 | Student & Attendance Domain Adapters | green | 02, 03 | 4 |
| 3 | 06 | Fees & Financial Domain Adapters | yellow | 02, 03 | 4 |
| 3 | 07 | Academic, HR & Inventory Adapters | yellow | 02, 03 | 6 |
| 4 | 08 | Schedules Engine, Secure Delivery & Admin Console | yellow | 04 | 4 |
| 5 | 09 | Verification & Golden Dataset Tests | green | 01, 02, 03, 04, 05, 06, 07, 08 | 4 |

## Summary
- Total sections: 9
- Total tasks: 36
- Parallel batches: 5
- Sequential steps: 5 (minimum batches to complete)
- Risk breakdown: 4 green, 5 yellow, 0 red

## Dependency Graph
```
Batch 1: [01]
Batch 2: [02] [03]                       (depend on 01)
Batch 3: [04] [05] [06] [07]             (depend on 02, 03)
Batch 4: [08]                            (depends on 04)
Batch 5: [09]                            (depends on everything)
```

## How to Execute
1. **Batch 1:** Start with Section 01 (Schema & Migration). Apply migration `0059` and update Drizzle models. Batch 2 cannot start until Section 01 is applied and verified.
2. **Batch 2:** Run Section 02 (Catalog Core) and Section 03 (Run Engine & Export Generators) in parallel.
3. **Batch 3:** Run Sections 04, 05, 06, 07 in parallel. They touch separate adapter files and separate UI components.
4. **Batch 4:** Run Section 08 (Schedules Engine & Admin Console).
5. **Batch 5:** Run Section 09 (End-to-End Verification & Golden Dataset Tests).
