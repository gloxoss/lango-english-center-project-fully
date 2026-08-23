import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parsePagination } from '@/libs/api/pagination';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';

// Staff roles eligible for an employee_id card: everyone except learners,
// alumni and parents. The issue-service employee path reads `user` by id +
// tenantId without any role filter, so the list is scoped to staff for the UI.

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'card-management');
    await requireCapability(context, 'cards.issue');

    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const where = and(eq(user.tenantId, tenantId), inArray(user.role, ['teacher', 'accountant', 'receptionist', 'guard', 'school_admin']));

    const [rows, totalRows] = await Promise.all([
      db.select({
        id: user.id,
        name: user.name,
        role: user.role,
        employeeId: user.employeeId,
        specialization: user.specialization,
        qualification: user.qualification,
        phone: user.phone,
      })
        .from(user)
        .where(where)
        .orderBy(asc(user.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(user).where(where),
    ]);

    return NextResponse.json({
      success: true,
      data: rows,
      total: totalRows[0]?.total ?? 0,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
