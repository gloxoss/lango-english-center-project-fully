# Section Index

## Overview
Total sections: 9
Total tasks: 35
Parallel batches: 6

## Batch Execution Order

### Batch 1 (parallel, no dependencies)
- Section 01: Schema, Migration & Permissions Foundation [green]
- Section 02: BlobStore Interface & Local-Disk Adapter [green]
- Section 03: ClamAV Docker Service & Scan Client [yellow]

### Batch 2 (depends on Batch 1)
- Section 04: Attachment-Type Routes & Targeting Resolution [green]

### Batch 3 (depends on Batch 2)
- Section 05: Digital Asset CRUD, Upload/Quarantine/Scan Pipeline & Authorized Download [red]

### Batch 4 (parallel, depends on Batch 3)
- Section 06: Homework Reuse (Usage Links) [green]
- Section 08: Real Test Suite [green]

### Batch 5 (depends on Batch 4)
- Section 07: Content Library UI (List, Create/Edit, Types Admin, Detail/Versions) [yellow]

### Batch 6 (depends on all)
- Section 09: Final Verification (Docker rebuild incl. ClamAV, live E2E, EICAR scan test, cross-tenant sweep, tsc, isolation script) [yellow]

## Section Manifest

| # | Section | Risk | Batch | Depends On | Blocks |
|---|---------|------|-------|------------|--------|
| 01 | Schema, Migration & Permissions Foundation | green | 1 | none | 04, 05 |
| 02 | BlobStore Interface & Local-Disk Adapter | green | 1 | none | 05 |
| 03 | ClamAV Docker Service & Scan Client | yellow | 1 | none | 05 |
| 04 | Attachment-Type Routes & Targeting Resolution | green | 2 | 01 | 05 |
| 05 | Digital Asset CRUD, Upload/Scan Pipeline & Authorized Download | red | 3 | 01, 02, 03, 04 | 06, 07, 08 |
| 06 | Homework Reuse (Usage Links) | green | 4 | 05 | 07 |
| 08 | Real Test Suite | green | 4 | 04, 05 | 09 |
| 07 | Content Library UI | yellow | 5 | 04, 05, 06 | 09 |
| 09 | Final Verification | yellow | 6 | all | none |
