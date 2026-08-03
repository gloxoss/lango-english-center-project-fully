# Section 01: Server Manifest Engine & Dedicated Navigation Shell

## Overview
Connect `/api/portal/manifest` endpoint to client dashboard layouts, wire role capability resolution, and establish dedicated route boundary wrappers for `/dashboard/teacher`, `/dashboard/student`, `/dashboard/parent`, `/dashboard/accountant`, `/dashboard/receptionist`.

## Risk: [green] - Low risk; existing getPortalManifest helper exists in src/libs/api/portal-manifest.ts.

## Dependencies
- Depends on: none
- Blocks: Section 02, 03, 04, 05
- Parallel batch: 1

## TDD Test Stubs
- Test: verifies /api/portal/manifest returns role-specific navigation for teacher, student, parent, accountant, receptionist.
- Test: verifies permission-denied navigation items are omitted from manifest payload.

## Tasks

<task type="auto" id="01-01">
  <name>Wire Server Portal Manifest API Endpoint</name>
  <files>src/app/api/portal/manifest/route.ts, src/libs/api/portal-manifest.ts</files>
  <action>
    Update GET /api/portal/manifest to return role-filtered navigation items, home widgets, and quick actions based on request context and role capabilities.
  </action>
  <verify>curl GET /api/portal/manifest returns HTTP 200 with JSON manifest payload</verify>
  <done>Manifest endpoint returns role-tailored navigation items for teacher, student, parent, accountant, receptionist</done>
</task>

<task type="auto" id="01-02">
  <name>Create Portal Navigation Context & Sidebar Component</name>
  <files>src/components/dashboard/PortalSidebar.tsx, src/components/dashboard/PortalHeader.tsx</files>
  <action>
    Build server-driven Sidebar and Header components consuming PortalManifest to render navigation items and active portal badges.
  </action>
  <verify>Component compiles cleanly with 0 TypeScript errors</verify>
  <done>Sidebar renders manifest navigation items dynamically</done>
</task>

<task type="auto" id="01-03">
  <name>Create Role Route Layout Roots</name>
  <files>src/app/[locale]/(dashboard)/teacher/layout.tsx, src/app/[locale]/(dashboard)/student/layout.tsx, src/app/[locale]/(dashboard)/parent/layout.tsx, src/app/[locale]/(dashboard)/accountant/layout.tsx, src/app/[locale]/(dashboard)/receptionist/layout.tsx</files>
  <action>
    Create dedicated layout wrappers for each role enforcing capability authorization and injecting PortalSidebar/PortalHeader.
  </action>
  <verify>npx tsc --noEmit exts with 0 errors</verify>
  <done>Layout wrappers established for all 5 portal roles</done>
</task>
