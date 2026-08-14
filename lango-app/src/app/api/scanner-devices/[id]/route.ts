import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { scannerDevices } from '@/models/Schema';

const updateDeviceSchema = z.object({
  deviceLabel: z.string().trim().min(1).max(255).optional(),
  isDisabled: z.boolean().optional(),
}).strict();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.attendance.manage');
    const body = await parseJson(request, updateDeviceSchema);

    const set: { deviceLabel?: string; isDisabled?: boolean } = {};
    if (body.deviceLabel !== undefined) {
      set.deviceLabel = body.deviceLabel;
    }
    if (body.isDisabled !== undefined) {
      set.isDisabled = body.isDisabled;
    }

    const [updated] = await db
      .update(scannerDevices)
      .set(set)
      .where(and(eq(scannerDevices.id, id), eq(scannerDevices.tenantId, tenantId)))
      .returning();

    if (!updated) {
      throw new ApiError(404, 'DEVICE_NOT_FOUND', 'Dispositif de scan introuvable.');
    }

    recordAudit(context, 'update', 'scanner_device', id);

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
