# Section Index — Phase 6: Workforce Operations, HR & Payroll

## Overview
- Total sections: 5
- Total tasks: 16
- Parallel batches: 3

## Batch Execution Order

### Batch 1 — Foundation (must run first)
- **Section 01**: Database Migration 0041 + Moroccan Payroll Calculation Engine

### Batch 2 — Core Features (parallel, after Batch 1)
- **Section 02**: 6A HR Employee Profiles API & Admin UI
- **Section 03**: 6B Monthly Payroll Run API & Lock Engine + GL Journal Posting

### Batch 3 — Portals (parallel, after Batch 2)
- **Section 04**: 6C Leave Management API & Approval Workflow
- **Section 05**: 6D HR Dashboard (`/dashboard/hr`) + 6E Employee Self-Service tab

---

## Section Manifest

| # | Section Name | Risk | Batch | Depends On | Blocks |
|---|---|---|---|---|---|
| 01 | DB Migration + Payroll Engine | 🔴 red | 1 | none | 02, 03, 04, 05 |
| 02 | HR Employee Profiles API | 🟡 yellow | 2 | 01 | 03, 05 |
| 03 | Payroll Run API + GL Posting | 🔴 red | 2 | 01, 02 | 05 |
| 04 | Leave Management API + Approvals | 🟡 yellow | 3 | 01 | 05 |
| 05 | HR Dashboard + Employee Self-Service | 🟢 green | 3 | 02, 03, 04 | none |
