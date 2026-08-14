import { and, asc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';

// Certificate recipients come from the same tenant's user table: students for
// student definitions, staff roles for employee definitions. The certificates
// addon is commercially independent of cards, so this listing lives here rather
// than reusing /api/cards/*.

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'certificate-management');
    await requireCapability(context, 'certificates.issue');

    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'student';

    const query = url.searchParams.get('q')?.trim().toLowerCase() ?? '';

    const rows = await db.select({
      id: user.id,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      matricule: user.matricule,
      employeeId: user.employeeId,
      phone: user.phone,
    })
      .from(user)
      .where(and(
        eq(user.tenantId, tenantId),
        type === 'employee'
          ? inArray(user.role, ['teacher', 'accountant', 'receptionist', 'guard', 'school_admin'])
          : inArray(user.role, ['student']),
      ))
      .orderBy(asc(user.name));

    const filtered = query
      ? rows.filter(r => (r.name?.toLowerCase().includes(query) ?? false))
      : rows;

    return NextResponse.json({ success: true, data: filtered });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
