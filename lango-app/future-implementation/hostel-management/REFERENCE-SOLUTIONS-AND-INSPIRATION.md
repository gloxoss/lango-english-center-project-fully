# Hostel Management References

Verified: 2026-08-01. Re-check modules, editions, licenses and security posture before reuse.

## OpenEduCat

- Repository: https://github.com/openeducat/openeducat_erp
- License: LGPL-3.0 for the referenced Community repository; verify whether specific Hostel capabilities are Community or commercial modules.
- Study: educational ERP navigation, student/residence relationships, rooms and allocation workflows.
- Recommendation: workflow inspiration only unless a component-level legal/technical review approves reuse. SchoolOS should not adopt Odoo as a second application framework.

## ERPNext

- Repository: https://github.com/frappe/erpnext
- License: GPL-3.0.
- Study: auditable document lifecycles, status transitions, approvals, charges, assets, maintenance and reports.
- Recommendation: behavioral inspiration only; do not copy GPL code into SchoolOS without legal review.

## Gibbon

- Repository: https://github.com/GibbonEdu/core
- License: GPL-family; verify current repository license.
- Study: student alerts, pastoral care/behaviour, permissions, attendance and school-centered usability.
- Recommendation: inspiration for safeguarding-aware workflows, not a dependency.

## Useful implementation tools

- PostgreSQL range/exclusion constraints: use native database guarantees for non-overlapping allocation periods.
- FullCalendar: https://github.com/fullcalendar/fullcalendar (mixed package licensing; verify the exact packages) for arrival/departure and leave calendars if needed.
- Zod and Drizzle already match SchoolOS's validation/data stack; do not introduce a second ORM/workflow engine merely for this addon.
- Attachments Book should provide incident/inspection file assets when enabled; retain a minimal private core adapter so Hostel is independently usable.

## Best-solution recommendation

Build the hostel domain natively in SchoolOS. External school ERPs are valuable references but are too broad and copyleft/framework-coupled to embed. The competitive advantage should come from reliable bed history, supervision workflows, privacy, guardian participation, facilities readiness and transparent capacity forecasting—not decorative dashboards.

