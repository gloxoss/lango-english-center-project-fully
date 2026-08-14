# Section 04: Shared Reporting UI Workspaces

## Overview
This section builds the core frontend pages and shared components under `src/app/[locale]/(dashboard)/dashboard/reports/`: Report Center (`page.tsx`), Report Workspace (`[key]/page.tsx`), My Runs (`runs/page.tsx`), Schedules (`schedules/page.tsx`), and Reporting Admin (`admin/page.tsx`).

## Risk: green - React UI views with design system components
Standard React 19 / Next.js 15 pages using Tailwind CSS v4 and Recharts. Low risk.

## Dependencies
- **Depends on:** section-02, section-03
- **Blocks:** section-08 (schedules)
- **Parallel batch:** 3

## TDD Test Stubs
- Test: `/dashboard/reports` renders domain catalog cards with search and readiness badges.
- Test: `/dashboard/reports/[key]` renders parameter controls, datatable, chart visualization, export triggers, and save view modal.
- Test: `/dashboard/reports/runs` displays background run status with live status polling.
- Test: Responsive navigation, dark/light theme rendering, empty and loading states work without hydration errors.

## Tasks

<task type="auto" id="04-01">
  <name>Build Report Center catalog page</name>
  <files>src/app/[locale]/(dashboard)/dashboard/reports/page.tsx, src/addons/advanced-reporting/ui/report-center-view.tsx, src/addons/advanced-reporting/ui/components/catalog-card.tsx</files>
  <action>
    Create `/dashboard/reports` page rendering `ReportCenterView`. Display domain filter tabs (All, Student, Fees, Finance, Attendance, HR, Exam, Inventory), quick search bar, favorites filter, and `CatalogCard` grid with readiness status badges (`ready`, `not_ready`).
  </action>
  <verify>Build workspace with `npx tsc --noEmit` and check page rendering.</verify>
  <done>Report Center catalog page built with full domain filter and search controls.</done>
</task>

<task type="auto" id="04-02">
  <name>Build Report Workspace view and parameter controls</name>
  <files>src/app/[locale]/(dashboard)/dashboard/reports/[key]/page.tsx, src/addons/advanced-reporting/ui/report-workspace-view.tsx, src/addons/advanced-reporting/ui/components/parameter-form.tsx, src/addons/advanced-reporting/ui/components/report-datatable.tsx, src/addons/advanced-reporting/ui/components/report-chart.tsx</files>
  <action>
    Build interactive report workspace. Render dynamic parameter form based on `parametersSchema`, preview datatable with sorting/pagination/totals, Recharts visualization panel (bar/line/pie), CSV/XLSX/PDF export buttons, Save View modal trigger, and Schedule modal trigger.
  </action>
  <verify>Verify dynamic form rendering and table pagination in preview mode.</verify>
  <done>Report Workspace component created with full data visualization and export bar.</done>
</task>

<task type="auto" id="04-03">
  <name>Build My Runs execution history page</name>
  <files>src/app/[locale]/(dashboard)/dashboard/reports/runs/page.tsx, src/addons/advanced-reporting/ui/my-runs-view.tsx</files>
  <action>
    Create `/dashboard/reports/runs` page showing active user's background report run queue. Display status pills (`queued`, `running`, `completed`, `failed`), progress indicator, run duration, error message drawer, and direct download links for completed artifacts.
  </action>
  <verify>Verify status polling interval and download link trigger.</verify>
  <done>My Runs page operational with background queue tracking.</done>
</task>

<task type="auto" id="04-04">
  <name>Implement Saved Views and Favorites API & UI components</name>
  <files>src/addons/advanced-reporting/ui/components/save-view-modal.tsx, src/app/api/addons/reporting/saved-views/route.ts, src/app/api/addons/reporting/favorites/route.ts</files>
  <action>
    Build modal to save customized filter parameter sets as named views (`isShared` option). Create API route handlers for GET/POST/DELETE saved views and report favorites.
  </action>
  <verify>Test saving a view via API and retrieving it in parameter form dropdown.</verify>
  <done>Saved views and favorites management fully implemented.</done>
</task>
