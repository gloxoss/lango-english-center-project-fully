# Section 07: Global Header Search

## Overview
`header.tsx`'s search input (lines 79-84) has no state, no onChange, no fetch - purely decorative. Rest of the header (notifications, campus switcher, sign-out) is genuinely wired and out of scope. No unified cross-entity search API exists.

## Risk: [yellow] - cross-cutting (searches multiple tables: students, teachers, guardians at minimum), needs sensible result-type routing on click

## Dependencies
- Depends on: none
- Blocks: none
- Parallel batch: 2

## TDD Test Stubs
- Test: GET /api/search?q= only returns results within the caller's tenant across all searched entity types
- Test: a receptionist searching sees student/guardian results but not other-tenant or unauthorized-entity results (respects each entity's existing read permission, not a blanket bypass)

## Tasks

<task type="auto" id="07-01">
  <name>Build a minimal cross-entity search route</name>
  <files>src/app/api/search/route.ts (new)</files>
  <action>
    GET ?q= , tenant-scoped. Search user.name/email (students+teachers, ilike), guardians.firstName/lastName. Keep the entity set small and real - don't try to search everything in one pass. Return { type: 'student'|'teacher'|'guardian', id, label, href } per result so the UI can route on click. requireRequestContext with no role restriction (any authenticated tenant member can search within their own read permissions) but filter each entity type by whether the caller's role can read it (reuse hasCapability with students.read/teachers.read/guardians.read per result type, skip types the caller can't read rather than 403ing the whole search).
  </action>
  <verify>curl as different roles, confirm result-type filtering matches each role's actual read permissions</verify>
  <done>Real, permission-respecting, tenant-scoped search across students/teachers/guardians</done>
</task>

<task type="auto" id="07-02">
  <name>Wire header.tsx's search input to the real route</name>
  <files>src/components/shared/header.tsx</files>
  <action>
    Add local state + debounced fetch to GET /api/search?q= as the user types (300ms debounce, minimum 2 characters before firing). Render a dropdown of results below the input; clicking a result navigates via next/link to its href.
  </action>
  <verify>tsc --noEmit clean; typing a real student name in a fresh browser session returns that student</verify>
  <done>Search input has real state, real results, real navigation on click</done>
</task>
