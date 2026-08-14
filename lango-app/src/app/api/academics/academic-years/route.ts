import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { academicYears } from '@/models/Schema';

// No route exposed academicYears at all before this - confirmed via grep,
// not assumed. Read-only reference data, no pagination needed - a school
// has a handful of academic years at most.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'accountant']);
    const tenantId = requireTenant(context);

    const rows = await db
      .select({ id: academicYears.id, name: academicYears.name, startDate: academicYears.startDate, endDate: academicYears.endDate, isActive: academicYears.isActive })
      .from(academicYears)
      .where(eq(academicYears.tenantId, tenantId))
      .orderBy(desc(academicYears.startDate));

    return NextResponse.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
