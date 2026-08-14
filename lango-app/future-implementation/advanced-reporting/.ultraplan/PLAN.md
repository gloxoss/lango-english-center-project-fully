# UltraPlan Technical Master Plan — Advanced Reporting Add-on

## Architecture Overview
The Advanced Reporting Add-on is structured as a decoupled module within `src/addons/advanced-reporting/` and exposed via API routes (`src/app/api/addons/reporting/`) and dashboard pages (`src/app/[locale]/(dashboard)/dashboard/reports/`).

```
src/
├── addons/
│   └── advanced-reporting/
│       ├── models/
│       │   └── reporting-schema.ts          # Drizzle ORM definitions (13 tables)
│       ├── services/
│       │   ├── catalog-service.ts           # Definition registry & permission filtering
│       │   ├── run-engine.ts                # Queue, execution, timeout, quotas
│       │   ├── export-service.ts            # CSV, XLSX (exceljs), PDF builders
│       │   ├── snapshot-service.ts          # Immutable period & report card snapshots
│       │   └── schedule-service.ts          # Cron engine & delivery notification
│       ├── adapters/                        # Typed domain query providers
│       │   ├── student-adapter.ts
│       │   ├── fees-adapter.ts
│       │   ├── financial-adapter.ts
│       │   ├── attendance-adapter.ts
│       │   ├── hr-adapter.ts
│       │   ├── examination-adapter.ts
│       │   └── inventory-adapter.ts
│       └── ui/                              # Frontend React views & components
│           ├── report-center-view.tsx
│           ├── report-workspace-view.tsx
│           ├── my-runs-view.tsx
│           ├── schedules-view.tsx
│           ├── reporting-admin-view.tsx
│           └── components/                  # Parameter form, Data table, Charts, Modals
├── app/
│   ├── api/
│   │   └── addons/
│   │       └── reporting/                   # Next.js API route handlers
│   └── [locale]/(dashboard)/dashboard/reports/  # Next.js Page routes
```

## Section Manifest Summary
- **Section 01:** Schema & Migration Foundation (Migration 0059, Drizzle schema, DB indexes)
- **Section 02:** Report Catalog Core & Definition Registry (Registry service, catalog API, domain readiness)
- **Section 03:** Run Engine & Export Generators (Async background run queue, CSV streaming, ExcelJS, PDF builder)
- **Section 04:** Shared Reporting UI Workspaces (Report Center, Workspace, My Runs, Schedules, Admin View)
- **Section 05:** Student & Attendance Domain Adapters (Student 4 reports + Attendance 5 reports)
- **Section 06:** Fees & Financial Domain Adapters (Fees 4 reports + Financial 5 reports)
- **Section 07:** Academic, HR & Inventory Adapters (Report Card / Tabulation, Payroll / Leave, Stock / Purchases / Sales / Issues)
- **Section 08:** Schedules Engine, Secure Delivery & Admin Console (Cron executor, signed download links, projection watermarks)
- **Section 09:** End-to-End Verification & Golden Dataset Tests (Automated tests, Docker build, security audit)

## Batch Execution Order
```
Batch 1: [01] (Schema & Migration Foundation)
Batch 2: [02] [03] (Catalog & Run/Export Engine - depends on 01)
Batch 3: [04] [05] [06] [07] (Shared UI + Domain Adapters - depends on 02, 03)
Batch 4: [08] (Schedules Engine & Admin Console - depends on 04)
Batch 5: [09] (Verification & Regression Check - depends on all)
```

## Safety & Security Rules
1. **Entitlement Gate:** All API endpoints invoke `requireAddon('advanced-reporting')`.
2. **Capability Check:** Endpoints call `requireCapability()` using existing domain keys.
3. **No Secret Leaks:** Credential report masks user identifiers and excludes passwords/hashes.
4. **Formula Injection Sanitization:** CSV/XLSX text values starting with `=`, `+`, `-`, or `@` are escaped.
5. **No Mutation of Closed Statements:** Snapshot tables ensure closed financial and academic records remain unchanged.
