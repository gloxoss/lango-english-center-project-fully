# Section 11: UX cleanup (small, cheap)

## Overview
Leftovers from `check:ui` and the code scan: 4 icon-only dead controls, 5 orphaned components, and places where an error is only `console.error`-ed so the user sees nothing. The 87 native `alert`/`prompt`/`confirm` calls work and are accessible: leave them (ponytail: native dialogs until a design asks otherwise), except `prompt` used to collect a required rejection reason, which is kept too.

## Risk: [green]

## Dependencies
- Depends on: none · Blocks: none · Batch 1 · Hub item: `task:up-11-ux-cleanup`

## Tasks

<task type="auto" id="11-01">
  <name>Label or remove the 4 dead icon controls</name>
  <files>addons/advanced-reporting/ui/components/catalog-card.tsx:146, features/finance/ui/invoice-detail-view.tsx:260, features/finance/ui/invoices-view.tsx:244, features/settings/ui/entitlements-catalog-view.tsx:222 (paths under lango-app/src)</files>
  <action>Open each line. If the icon button has a real action, it just needs an aria-label (then the check counts it). If it does nothing, delete it.</action>
  <verify>npm run check:ui: dead controls 0; update scripts/ui-reality-baseline.json.</verify>
  <done>No button that does nothing.</done>
</task>

<task type="auto" id="11-02">
  <name>Delete the 5 orphaned components</name>
  <files>features/attendance/ui/attendance-scanner-kiosk.tsx, features/dashboard/ui/analytics-view.tsx, features/dashboard/ui/attendance-chart.tsx, features/students/ui/parents-guardians-page.tsx, features/students/ui/student-attendance-heatmap.tsx</files>
  <action>For each, grep the whole repo (including dynamic imports and string paths) to confirm nothing imports it. Delete confirmed orphans. student-attendance-heatmap was just translated by codex-4: ask in the hub before deleting it — it may be about to be wired.</action>
  <verify>tsc 0; check:ui orphaned components 0 (update baseline).</verify>
  <done>No dead components.</done>
</task>

<task type="auto" id="11-03">
  <name>Surface errors that are only logged, on save/delete paths</name>
  <files>screens found by the scan below (1–3 files per commit)</files>
  <action>grep -rn "console.error" lango-app/src --include=*.tsx. Only fix catch blocks on user actions (save, delete, submit, approve) where the user gets no message: add a toast.error (sonner is already used app-wide) with the server message or tCommon('error'). Leave load-time logging alone.</action>
  <verify>Per file: tsc 0, eslint 0. List fixed files in the hub note.</verify>
  <done>No user action fails silently.</done>
</task>
