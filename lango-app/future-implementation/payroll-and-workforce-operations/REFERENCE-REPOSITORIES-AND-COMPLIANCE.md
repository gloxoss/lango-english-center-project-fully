# Payroll/workforce references and compliance sources

Research verified on **2026-08-01**. Payroll law, tax, contribution rates,
thresholds, formats, and official interpretations change. Re-check all primary
sources and obtain qualified Moroccan payroll/legal review before implementation
or production use.

## Primary workflow inspiration — Frappe HR

- Repository: https://github.com/frappe/hrms
- License: GPL-3.0
- Useful domains: salary structures/components, tax slabs, payroll runs,
  additional/off-cycle salary, payslips, leave policies/balances, employee
  advances, multi-level approvals, self-service, shifts/attendance, performance.
- Intended use: domain vocabulary, lifecycle, validation, and UX inspiration.
- Licensing boundary: GPL-3.0 is not a casual copy source for a differently
  licensed commercial product. Do not copy/port code without an explicit legal
  and product licensing decision.

## Calculation architecture inspiration — Payroll Engine

- Web app: https://github.com/Payroll-Engine/PayrollEngine.WebApp
- Project/documentation: https://payrollengine.org
- License: WebApp is MIT; verify backend/package licenses individually.
- Useful concepts: tenants, regulations, derived/shared regulation versions,
  payroll layers, employee/company/national cases, calendars, forecasts, pay-run
  jobs, results, reports, and calculation logs.
- Intended use: inspiration for effective-dated rule packs, traceability,
  forecasting, and deterministic pay-run architecture.
- It is .NET/Blazor and not a direct Next.js dependency by default.

## Accounting integration inspiration — OCA Payroll

- Repository: https://github.com/OCA/payroll
- Repository license: AGPL-3.0; individual module manifests may differ.
- Useful concepts: payroll documents, payroll-to-accounting, contract advantages,
  and public-holiday integration.
- Intended use: workflow/domain inspiration only unless each relevant license is
  reviewed and the product's licensing strategy intentionally complies.

## Official Morocco tax sources

- Ministry of Economy and Finance, Finance Law 2026:
  https://www.finances.gov.ma/fr/vous-orientez/Pages/plf2026.aspx
- Ministry publications, including Code Général des Impôts 2026 and annual DGI
  circulars:
  https://www.finances.gov.ma/fr/lbc/Pages/publications0.aspx
- Code Général des Impôts 2026 PDF:
  https://www.finances.gov.ma/Publication/dgi/2025/CGI-2026-FR.pdf

Use these to source IR rules and annual changes. Store the publication/circular
reference and effective dates with each regulation version; never paste a rate
from an unaudited blog into production configuration.

## Official Morocco labour source

- Ministry of Justice legal portal, Labour Code:
  https://adala.justice.gov.ma/api/uploads/2024/04/30/code%20du%20travail-1714463246806.pdf

Use qualified review to translate statutory leave, paid leave, working-time,
notice, payslip/payment, and employment requirements into product behavior.

## CNSS / AMO / DAMANCOM

- Use current official CNSS/DAMANCOM documentation and employer portal
  specifications obtained for the production integration.
- Confirm contribution bases, ceilings, employee/employer shares, AMO and other
  contributions, declaration periods, file schemas, acknowledgements, and
  correction workflows for the exact effective period.
- Bank and consulting guides may help discovery but are not authoritative rate
  sources. Keep them out of production rule provenance.

## Reference hierarchy

1. Current Moroccan law, DGI/MEF publications, CNSS/DAMANCOM specifications, and
   qualified professional validation.
2. SchoolOS HR/finance source data and explicit policies.
3. Payroll Engine for rule/version/trace architecture.
4. Frappe HR for end-to-end workflow inspiration.
5. OCA Payroll for accounting-integration inspiration.

