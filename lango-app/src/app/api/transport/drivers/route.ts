import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';
import { sanitizeDriverProfile } from '@/features/transport/services/transport-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');
    await requireCapability(context, 'transport.driver.manage');

    const staffMembers = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      })
      .from(user)
      .where(
        and(
          eq(user.tenantId, tenantId as any),
          inArray(user.role, ['teacher' as any, 'school_admin' as any, 'driver' as any, 'guard' as any]),
        ),
      );

    const safeDrivers = staffMembers.map(m => sanitizeDriverProfile(m));

    return NextResponse.json({ success: true, data: safeDrivers });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
