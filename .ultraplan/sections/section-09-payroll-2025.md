# Section 09: Payroll 2025/2026 regulation pack

## Overview
Moroccan payroll rules are effective-dated packs: code default in `lango-app/src/features/workforce/services/ma-regulation-adapter.ts` (CGI 2024 values, `validationStatus: 'unvalidated'`) and per-tenant versions in `payroll_regulation_versions` (managed via `/api/workforce/payroll/config` and the `/dashboard/workforce/payroll/regulations` page). Payslips already print a "barème non certifié" warning while unvalidated (`features/hr/services/payslips.ts`).

## Risk: [red] Legal money figures. Nothing changes without owner decision D3 (accountant-signed figures + source).

## Dependencies
- Depends on: D3 · Blocks: none · Batch 3 · Hub item: `task:up-09-payroll-2025`

## Figures to get confirmed (NOT to be used until signed)
Believed to have changed under the 2025 Finance Law (unverified): IR exempt band 30 000 → 40 000 MAD/yr; top rate 38 % → 37 %; intermediate brackets; professional-expenses allowance (35 % capped 35 000 MAD above 78 000 MAD gross, 40 % below); employer AMO 3.26 % → 4.11 % (incl. 1.85 % solidarity); family charges per dependant. CNSS (4.48 % / 8.98 %, 6 000 MAD cap) believed unchanged.

## Tasks

<task type="auto" id="09-01">
  <name>Add the 2025 pack as a new effective-dated version (after D3)</name>
  <files>lango-app/src/features/workforce/services/ma-regulation-adapter.ts, one test file</files>
  <action>
    Do NOT edit the 2024 values in place: payslips already computed on them must stay reproducible. Add a second default config effective from 2025-01-01 with the signed figures, provenance.validationStatus 'validated_by_professional', reviewer name and source document reference. Make the adapter pick the pack by payroll period date (look for existing effective-date selection first; reuse it).
    Existing tenants: publish the same values as a new payroll_regulation_versions row through the existing config flow, not by SQL.
  </action>
  <verify>Test: one gross salary computed for a 2024 period gives the old result, for a 2025 period gives the accountant's worked example exactly (ask the accountant for 2–3 worked payslips as test vectors). tsc 0.</verify>
  <done>2025+ payslips use certified figures; 2024 history unchanged; the uncertified warning disappears only for 2025+ periods.</done>
</task>
