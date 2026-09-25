# Section 08: Navigation — 8 pages into menus, the rest confirmed intentional

## Overview
`npm run check:ui` lists 29 dashboard pages with no nav entry. Most are reached from inside another page, redirects, or role portals. 8 are real workspaces people cannot find.

## Risk: [green] Menu entries only. `src/components/shared/sidebar.tsx` is claimed by codex-4 (`task:pdf-document-system`): wait for release.

## Dependencies
- Depends on: codex-4 release of sidebar.tsx, owner decision D6 · Blocks: 15 · Batch 2 · Hub item: `task:up-08-navigation`

## The 29, sorted

Add to menus (8): finance/bank-reconciliation, finance/chart-of-accounts, finance/journal, finance/reconciliation, finance/online-payments, hr/leave-management, hr/salary-advances, workforce/payroll/payslips.

Check before adding (4 — may be duplicates of pages already in the menu; if duplicate, redirect to the canonical page instead): hr/advances vs hr/salary-advances vs workforce/advances; hr/awards vs workforce/awards; communication/broadcast vs broadcast/*; accountant vs finance home.

Intentional, leave unlinked (17): academics/exams (redirect), academics/live-class/new, academics/assessment/marksheet, students/admissions/new, students/alumni-transition, settings/attendance, settings/onboarding, settings/security/2fa, settings/staff, library/me, transport/guardian, transport/student, communication/campaign-composer, communication/delivery-reports, communication/events, workforce/payroll/regulations, workforce/payroll/settings — each must be reachable from a button on a parent page; 08-02 checks that.

## Tasks

<task type="auto" id="08-01">
  <name>Add the 8 menu entries</name>
  <files>lango-app/src/components/shared/sidebar.tsx (or the nav manifest it reads), locales if labels are missing</files>
  <action>Add each page under its module group with the same capability/addon gating as the page's requireServerPage call (read each page.tsx). Reuse existing translation keys where they exist.</action>
  <verify>npm run check:ui: unlinked pages drops by 8 (update scripts/ui-reality-baseline.json to the new lower number). Log in as accountant and as school_admin: entries visible only to roles that can open them (nav-page-guard-parity test passes).</verify>
  <done>Finance and HR workspaces are findable.</done>
</task>

<task type="auto" id="08-02">
  <name>Resolve the 4 possible duplicates and check the 17 have a parent link</name>
  <files>only the duplicate page files if turned into redirects</files>
  <action>For each "check before adding" pair, compare the two pages. Same data = turn the older one into a redirect() to the canonical one. For the 17 intentional pages, grep for a Link/href to each from another page; list any with no inbound link at all in the hub note (do not add links without the owner).</action>
  <verify>Hub note lists each of the 21 with its inbound link file or "none".</verify>
  <done>Every page is either in a menu, a redirect, or reachable from a parent page.</done>
</task>
