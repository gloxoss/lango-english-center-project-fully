# Section 08: Users List Pagination

## Overview
`users-manage-view.tsx`'s CRUD is genuinely real (fetches `/api/users`, POST/PUT/DELETE wired) - only the pagination buttons (lines 307/309) are dead: no onClick, no currentPage state. `/api/users` GET already supports `parsePagination` (page/pageSize query params, per this session's earlier verification) - this is purely a frontend wiring gap, zero backend work.

## Risk: [green] - frontend-only, backend already supports it

## Dependencies
- Depends on: none
- Blocks: none
- Parallel batch: 2

## TDD Test Stubs
- (No new backend - no new automated test needed per this session's "test money/security paths only" policy; this is a display-only fix.)

## Tasks

<task type="auto" id="08-01">
  <name>Add currentPage state and wire Previous/Next buttons</name>
  <files>src/features/auth/ui/users-manage-view.tsx</files>
  <action>
    Add `const [page, setPage] = useState(1)`. Include `page` in the existing fetch's query params. Wire the ChevronLeft button to `setPage(p => Math.max(1, p - 1))` and ChevronRight to `setPage(p => p + 1)`, disabling each appropriately at the boundaries using the `total`/`pageSize` already returned by the API response.
  </action>
  <verify>tsc --noEmit clean; manually create enough test users to span 2 pages, confirm clicking Next shows page 2's real rows</verify>
  <done>Pagination buttons change the visible page with real data, disabled correctly at first/last page</done>
</task>
