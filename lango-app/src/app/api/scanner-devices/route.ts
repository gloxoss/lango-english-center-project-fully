import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { scannerDevices } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.attendance.manage');

    const { searchParams } = new URL(request.url);
    const conditions = [eq(scannerDevices.tenantId, tenantId)];
    const branchFilter = searchParams.get('branchId');
    if (branchFilter) {
      conditions.push(eq(scannerDevices.branchId, branchFilter));
    }

    // secretKey is deliberately excluded: it is shown once at pairing time.
    const items = await db
      .select({
        id: scannerDevices.id,
        deviceLabel: scannerDevices.deviceLabel,
        branchId: scannerDevices.branchId,
        pairedAt: scannerDevices.pairedAt,
        lastSeenAt: scannerDevices.lastSeenAt,
        isDisabled: scannerDevices.isDisabled,
      })
      .from(scannerDevices)
      .where(and(...conditions))
      .orderBy(desc(scannerDevices.pairedAt));

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
