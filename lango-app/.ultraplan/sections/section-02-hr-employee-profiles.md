# Section 02: 6A HR Employee Profiles API & Admin UI

## Risk: 🟡 YELLOW — Standard CRUD with tenant scoping.

## Overview
Build the HR employee profile management API (`/api/hr/employee-profiles`) for CNSS number, bank RIB, contract type, and dependants count. Build the admin list UI component to display and edit profiles at `/dashboard/hr/employees`.

## Dependencies
- Depends on: Section 01
- Blocks: Sections 03, 05

## Success Criteria
- `GET /api/hr/employee-profiles` returns paginated, tenant-scoped employee profiles.
- `POST /api/hr/employee-profiles` creates/upserts profile with Zod validation.
- `npx tsc --noEmit` → 0 errors.

## Tasks

### [02-01] Build HR Employee Profiles API Route
**File**: `src/app/api/hr/employee-profiles/route.ts`
**Action**: 
- GET: paginated list of employee profiles joined with user name/role, scoped to `tenantId`.
- POST: upsert employee profile (CNSS number, AMO number, bank RIB, contract type, dependants count) with Zod validation.
- Requires `requireCapability(context, 'hr.manage')`.
**Verify**: curl GET /api/hr/employee-profiles → 200 with data array.

### [02-02] Build Salary Components & Templates API
**File**: `src/app/api/hr/salary-templates/route.ts`
**Action**: 
- GET: list salary templates for tenant.
- POST: create salary template with components list.
- PATCH `[id]`: assign template to employee with effective date.
**Verify**: POST creates template + component links.

### [02-03] Build HR Employees List UI Component
**File**: `src/components/hr/EmployeeProfilesList.tsx`
**Action**: Glassmorphic table listing employees with CNSS, contract type, base salary, and assigned template. Edit modal for HR profile fields.
**Verify**: Component renders with mock data, 0 TypeScript errors.
