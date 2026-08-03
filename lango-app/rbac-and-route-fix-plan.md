# Plan: Role-Based Access Control (RBAC) & Add Student Route Fix

## Goal
Enforce role security so `school_admin` users cannot view or access `/dashboard/super-admin/*` routes, propagate `role` to Better Auth session payload, and fix the `+ Inscrire un élève` enrollment route (`/dashboard/students/add`).

## Action Items

- [ ] **Step 1: Configure Better Auth User Role Schema** → Update `src/libs/auth.ts` with `user.additionalFields` for `role` and `tenantId`.
- [ ] **Step 2: Enforce Route Middleware Protection** → Update `src/middleware.ts` to redirect `school_admin` away from `/dashboard/super-admin/*`.
- [ ] **Step 3: Update Sidebar Dynamic Role Check** → Update `src/components/shared/sidebar.tsx` to conditionally render `superAdminNavItems` only when `session?.user?.role === 'super_admin'`.
- [ ] **Step 4: Verify Add Student Page Route** → Ensure `src/app/[locale]/(dashboard)/dashboard/students/add/page.tsx` renders `StudentAdmissionView`.
- [ ] **Step 5: Run Production Build** → Run `npx next build` to ensure 0 TypeScript compilation errors.

## Done When
- Logged in as `school_admin` (`y.elamrani@atlas.ma`): **Plateforme Super Admin** is hidden from sidebar, `/dashboard/super-admin` redirects to `/dashboard`, and `+ Inscrire un élève` opens `/dashboard/students/add`.
