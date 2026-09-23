import { and, asc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';

// Bounded tenant staff directory for the exam-planning supervisor picker.
// Kept next to exam-schedules because that is its only consumer today; a
// school should assign supervisors from real staff, never free text.
const STAFF_ROLES = ['teacher', 'school_admin', 'accountant', 'librarian', 'receptionist'] as const;

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');

    const staff = await db
      .select({ id: user.id, name: user.name, role: user.role })
      .from(user)
      .where(and(
        eq(user.tenantId, tenantId),
        eq(user.userStatus, 'active'),
        inArray(user.role, [...STAFF_ROLES]),
      ))
      .orderBy(asc(user.name))
      .limit(200);

    return NextResponse.json({ success: true, data: staff });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
