# Users & Students Base Implementation Plan

## Goal
Implement essential data models, multi-tenant scoping, interactive CRUD UI, and API route stubs for Users Base (Staff, Guardians, Admins) and Students Base, with automated test verification.

## Tasks
- [ ] Task 1: Create `auth/model/types.ts` with User, Role, Staff, Guardian models → Verify: File compiles
- [ ] Task 2: Create `auth/data/users-data.ts` and `auth/data/users-api.ts` → Verify: Data objects exported
- [ ] Task 3: Create API route `/api/users/route.ts` with GET, POST, PUT, DELETE → Verify: Endpoint handles JSON
- [ ] Task 4: Create API route `/api/auth/me/route.ts` → Verify: Returns session JSON
- [ ] Task 5: Enhance `/api/students/parents/route.ts` with POST, PUT, DELETE → Verify: Guardians CRUD works
- [ ] Task 6: Build `auth/ui/users-manage-view.tsx` with Create, Edit, Delete modals → Verify: UI renders with table and dialogs
- [ ] Task 7: Create page route `/dashboard/settings/users/page.tsx` → Verify: Route registers in Next.js
- [ ] Task 8: Add Users link to Sidebar in `sidebar.tsx` → Verify: Navigation item visible
- [ ] Task 9: Make `parents-guardians-view.tsx`, `student-transfers-view.tsx`, and `promotions-view.tsx` interactive → Verify: Action buttons open modals
- [ ] Task 10: Run API test script and `npx next build` → Verify: 0 build errors and all tests pass

## Done When
- [ ] Users directory and API endpoints support full CRUD operations
- [ ] Students sub-views (Parents, Transfers, Promotions) have working interactive modals
- [ ] `npx next build` succeeds with zero errors
