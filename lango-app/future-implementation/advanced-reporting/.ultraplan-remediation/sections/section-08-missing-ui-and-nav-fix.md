# Section 08: Missing UI Pieces & Navigation Fix

## Overview
Builds the never-built `save-view-modal.tsx`, adds the greyed-out "Bientôt disponible" state for genuinely not-ready reports (Inventory), and fixes the sidebar's incorrect `reports.manage` gate so the addon's own named audiences (teachers, accountants) can actually see the nav entry, per the PRD.

## Risk: green - UI wiring against already-correct visual design and already-working backend routes from prior sections

## Dependencies
- Depends on: section-02 (routes exist to call), section-04 (real "not ready" signal to render)
- Blocks: section-10
- Parallel batch: 3

## TDD Test Stubs
- Test: A teacher who previously could not see the Reports nav entry at all can now see it.
- Test: A confidential report a teacher cannot run is either absent or clearly disabled in their catalog view, never clickable-but-broken.
- Test: An Inventory report appears greyed out with a "Bientôt disponible" badge and cannot be clicked to run.
- Test: A user can save their current report filters/columns as a named view via the modal, and it appears in their saved views list afterward.

## Tasks

<task type="auto" id="08-01">
  <name>Fix sidebar permission gate</name>
  <files>src/components/shared/sidebar.tsx</files>
  <action>
    Change the "Rapports & Analytics" nav entry's `permission` from `reports.manage` to `reports.read`, matching the PRD decision and the roles that actually hold `reports.read` per `permissions.ts` (school_admin, teacher, accountant already have it per the audit's citation of `DEFAULT_ROLE_PERMISSIONS`).
  </action>
  <verify>Log in as a teacher and confirm the Reports nav entry is now visible, where it previously was not.</verify>
  <done>The named audiences from the PRD can see the reports navigation entry.</done>
</task>

<task type="auto" id="08-02">
  <name>Add not-ready styling to the catalog UI</name>
  <files>src/addons/advanced-reporting/ui/components/catalog-card.tsx</files>
  <action>
    Read the catalog API response shape after section-04's changes (it should now be able to indicate a report is not-ready, e.g. via the Inventory domain check). Render not-ready cards visually greyed out with a "Bientôt disponible" badge, with the click/run action disabled (not just visually styled but actually non-functional), matching the PRD decision. Also handle the case where a role's filtered catalog (per section-02's access matrix) has zero visible reports at all - show a clear, honest empty state rather than a blank page.
  </action>
  <verify>View the catalog and confirm Inventory reports appear greyed out and cannot be clicked into a run attempt.</verify>
  <done>Not-ready reports are honestly represented in the UI, never appearing as clickable-but-broken.</done>
</task>

<task type="auto" id="08-03">
  <name>Build save-view-modal.tsx</name>
  <files>src/addons/advanced-reporting/ui/components/save-view-modal.tsx</files>
  <action>
    Build a modal component (matching this project's existing modal patterns used elsewhere in the app) that lets a user name and save their current report filters/column selection as a reusable view, calling the `saved-views` POST route from section-02. Wire it into the report workspace view (`report-workspace-view.tsx`) as a "Save this view" action.
  </action>
  <verify>From a report's workspace, save a view with a custom name, then confirm it appears in the saved-views list and re-applies the same filters/columns when selected.</verify>
  <done>The previously-missing save-view UI is built and functional against the real saved-views API.</done>
</task>
