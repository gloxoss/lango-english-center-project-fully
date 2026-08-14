# Section 07: Content Library UI

## Overview
The dashboard pages real users touch: a searchable/filterable content library with table/grid modes, a create/edit form with real upload, an inspector sidebar for asset detail/version-history/usage-backlinks, and an admin-only attachment-types configuration page. Matches this project's established design mandate (CLAUDE.md Section 1.5: slate/blue palette, data-dense tables, KPI banners, inspector sidebars) and CRUD-must-be-interactive rule — no static placeholders, no dummy data.

## Risk: [yellow] - largest single UI surface in this plan; real risk is scope creep into a multi-step wizard the single-request v1 upload doesn't need

## Dependencies
- Depends on: section-04, section-05, section-06
- Blocks: section-09
- Parallel batch: 5

## TDD Test Stubs
- (UI section — verified via a real browser/dev-server pass in section-09, matching this codebase's established UI-verification discipline; no unit tests for React components in this codebase's existing pattern)

## Tasks

<task type="auto" id="07-01">
  <name>Content library page: list + search/filter + KPI banner</name>
  <files>src/app/[locale]/(dashboard)/dashboard/content/library/page.tsx</files>
  <action>
    Real `fetch('/api/content/assets?...')` on mount and on filter change (search/type/tag/status query params, matching section-05's GET route). Table and grid view toggle. Top KPI banner: total published, total draft/pending-review (admin/teacher view only), storage used by the current tenant's clean versions (a real client-side sum over the fetched page is fine for v1 — a true aggregate query is part of the deferred Section 5/ops-dashboard follow-up per PRD.md). Each row: preview icon by type, title, type badge, targeting summary (e.g. "3rd Grade B, Math"), version count, status badge, owner, and row actions (open detail, download if authorized, edit if owner/admin). "New Resource" button opens the create modal (07-02). Role-aware: teacher's default filter is "mine + school-shared", admin defaults to "all", student/parent see only published+targeted (list route already enforces this server-side — the UI just doesn't render admin-only actions for these roles).
  </action>
  <verify>Real DB rows render on load for a fresh tenant with zero fake/mock data seeded into the component; empty state (zero assets) renders a real empty-state message, not a broken table.</verify>
  <done>Library page fetches and renders real data, matches the palette/density conventions of every other dashboard list page in this app.</done>
</task>

<task type="auto" id="07-02">
  <name>Create/edit resource modal with real upload</name>
  <files>src/app/[locale]/(dashboard)/dashboard/content/library/_components/asset-form-modal.tsx</files>
  <action>
    A single form (not a multi-step wizard — v1's upload is single-request, a wizard would add complexity the flow doesn't need): title, description, attachment-type select (fetched from `/api/content/attachment-types`), tags input, language, a targeting picker (audience-kind selector: School-wide / Role / Class Section / Class Subject / Specific Student, with a dependent second control for the specific target when not "School-wide" — "All" must always be an explicit selection per the spec, never a default-empty state that silently means the same thing to a confused user), and a file-drop zone. On submit: build a real `FormData`, POST to `/api/content/assets` (create) or `/api/content/assets/[id]/versions` (replace-file on an existing asset), show real upload progress via `XMLHttpRequest.upload.onprogress` (native browser progress event — no library needed for a single-request upload's progress bar) rather than a fake simulated progress bar. On success, show the resulting `status` honestly (e.g. "En cours d'analyse antivirus..." if the response is still `processing`/`quarantined` at request-completion time — the scan happens synchronously in this v1 pipeline per section-05, so in practice the response already reflects `ready` or a failure state by the time the request completes, but the UI must render whatever real status comes back, never assume success).
  </action>
  <verify>A real file upload round-trips through to a real new digitalAssets/digitalAssetVersions row (checked live in section-09); an infected test upload shows the real rejection message, not a generic error.</verify>
  <done>Create/edit modal performs a real upload with real progress and renders the real resulting status.</done>
</task>

<task type="auto" id="07-03">
  <name>Asset detail / version-history inspector sidebar</name>
  <files>src/app/[locale]/(dashboard)/dashboard/content/library/_components/asset-inspector.tsx</files>
  <action>
    Slide-out sidebar (matches this project's established inspector pattern), opened from a library row. Real `fetch('/api/content/assets/[id]')` for metadata, targets, tag names, and usage backlinks (real homework titles linking to this asset, via section-06's data). Version-history list with per-version scan status, size, uploader, date, and a "Set as current" affordance is explicitly NOT built in v1 (out of spec — replacing IS how a version becomes current; there's no separate "revert to an older version" action in the source spec, so none is invented here). Publish/Archive/Restore buttons call section-05's routes and refresh the inspector afterward. Download button hits section-05's authorized download route directly (real file download, not a fake link).
  </action>
  <verify>Real version list renders with real scan-status badges; publish button is disabled (not just hidden) with a real reason shown when the current version isn't `ready` or when no targets are set yet, matching the real 422 the publish route would return.</verify>
  <done>Inspector shows real metadata/versions/backlinks and drives real lifecycle actions.</done>
</task>

<task type="auto" id="07-04">
  <name>Attachment-types admin page</name>
  <files>src/app/[locale]/(dashboard)/dashboard/content/types/page.tsx</files>
  <action>
    Admin-only (route-level check: redirect or show a real "access restricted" state for non-admin roles, matching how other admin-only pages in this app already gate access client-side in addition to the server-side `requireCapability` check). Real CRUD table over `/api/content/attachment-types`: name, code, icon/color pickers, allowed MIME families (multi-select), max size, student-visible toggle, downloadable toggle, active/order. System types render their edit fields but the rename/delete actions are disabled with a real tooltip reason ("Type système - verrouillé"), matching the server-side 403 section-04 already enforces. Archive action (never a hard delete) with a confirmation dialog.
  </action>
  <verify>Real create/edit/archive round-trip against the real API; system-type lock is visibly enforced in the UI, not just server-side.</verify>
  <done>Types admin page is real, admin-gated, matches the CRUD-must-be-interactive project mandate.</done>
</task>
