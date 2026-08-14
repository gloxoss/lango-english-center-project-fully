import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireAddon } from '@/libs/api/entitlements';
import { hasCapability, requireCapability } from '@/libs/api/permissions';
import { listEmployees } from '@/features/hr/services/employees-service';

const BASE_COLUMNS = [
  'employeeId', 'firstName', 'lastName', 'displayName', 'email', 'phone',
  'department', 'designation', 'employmentType', 'employmentStatus', 'hireDate',
  'contractStartDate', 'contractEndDate', 'accountEmail', 'accountStatus',
];
const SENSITIVE_COLUMNS = ['salary', 'nationalId', 'bankRib', 'cnssNumber', 'amoNumber', 'contractType'];

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// CSV export honoring the same filters + tenant boundary as GET /api/hr/employees.
// Sensitive columns are only included when the caller holds hr.sensitive.read (§5).
export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'human-resources');
    await requireCapability(ctx, 'hr.export');

    const url = new URL(request.url);
    const search = url.searchParams.get('search') ?? undefined;
    const departmentId = url.searchParams.get('departmentId') ?? undefined;
    const designationId = url.searchParams.get('designationId') ?? undefined;
    const branchId = url.searchParams.get('branchId') ?? undefined;
    const employmentStatus = url.searchParams.get('employmentStatus') ?? undefined;
    const loginStatus = url.searchParams.get('loginStatus') as 'linked' | 'unlinked' | undefined;
    const role = url.searchParams.get('role') ?? undefined;

    const sensitive = await hasCapability(ctx.userId, tenantId, ctx.role, 'hr.sensitive.read');
    const rows = await listEmployees(tenantId, {
      search, departmentId, designationId, branchId, employmentStatus, loginStatus, role,
    }, sensitive);

    const columns = sensitive ? [...BASE_COLUMNS, ...SENSITIVE_COLUMNS] : BASE_COLUMNS;
    const lines = [columns.join(',')];
    for (const row of rows) {
      lines.push(columns.map((col) => csvEscape((row as Record<string, unknown>)[col])).join(','));
    }

    const csv = `﻿${lines.join('\n')}`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="employees-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
