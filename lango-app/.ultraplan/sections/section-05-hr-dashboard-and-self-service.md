# Section 05: 6D HR Admin Dashboard + 6E Employee Self-Service Tab

## Risk: 🟢 GREEN — UI-only, all APIs exist from Sections 02-04.

## Overview
Build the HR & Payroll admin dashboard at `/dashboard/hr` with stats overview, payroll run modal, and leave approvals table. Add Employee Self-Service tab to Teacher/Staff portals for payslip download and leave request submission.

## Dependencies
- Depends on: Sections 02, 03, 04
- Blocks: none

## Success Criteria
- HR Dashboard renders payroll stats, monthly payroll calculator, and leave approvals table.
- Employee self-service tab renders payslips list and leave balance.
- All navigation items appear in portal manifest for `school_admin` and employee roles.
- 0 TypeScript errors.

## Tasks

### [05-01] Build HR Admin Dashboard Page
**File**: `src/app/[locale]/(dashboard)/dashboard/hr/page.tsx`
**File**: `src/components/hr/HrDashboardStats.tsx`
**Action**:
- Stats cards: Total Active Employees, Monthly Payroll Cost (current period), Pending Leave Requests, CNSS Employer Contribution.
- Payroll period selector with "Run Payroll for Month" button opening a confirmation modal that calls `POST /api/hr/payroll/periods` → `POST .../calculate` → `POST .../lock`.
- `LeaveApprovalsTable` component embedded below stats.
**Verify**: Page renders with glassmorphic card styling matching dashboard design system.

### [05-02] Build Employee Payslip & Leave Self-Service Components
**File**: `src/components/hr/EmployeePayslipList.tsx`
**File**: `src/components/hr/EmployeeLeaveRequestForm.tsx`
**Action**:
- `EmployeePayslipList`: Lists employee's own payslips per month with download button.
- `EmployeeLeaveRequestForm`: Simple form (category dropdown, start/end date, reason) that posts to `/api/hr/leave/requests`.
**Verify**: Components compile cleanly.

### [05-03] Add HR Self-Service Tab to Teacher Portal
**File**: `src/app/[locale]/(dashboard)/dashboard/teacher/page.tsx`
**Action**: Add a "Mon Dossier RH" tab section to existing teacher portal page integrating `EmployeePayslipList` and `EmployeeLeaveRequestForm` components.
**Verify**: Teacher portal page compiles and renders the new HR section without breaking existing schedule/marks sections.

### [05-04] Update Portal Manifest for HR Navigation
**File**: `src/libs/api/portal-manifest.ts`
**Action**: Add HR navigation items for `school_admin` role: "RH & Paie" section with links to `/dashboard/hr`, `/dashboard/hr/employees`, and `/dashboard/hr/leave`. Add `hr-overview` and `payroll-status` widgets.
**Verify**: `GET /api/portal/manifest` for school_admin includes HR navigation items.
