import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { branches, scannerDevices } from '@/models/Schema';

const pairDeviceSchema = z.object({
  deviceLabel: z.string().trim().min(1).max(255),
  branchId: z.string().uuid().optional().nullable(),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.attendance.manage');
    const body = await parseJson(request, pairDeviceSchema);

    if (body.branchId) {
      const [branch] = await db
        .select({ id: branches.id })
        .from(branches)
        .where(and(eq(branches.id, body.branchId), eq(branches.tenantId, tenantId)))
        .limit(1);
      if (!branch) {
        throw new ApiError(422, 'INVALID_BRANCH', 'La succursale indiquée n\'existe pas pour cet établissement.');
      }
    }

    const secretKey = crypto.randomBytes(32).toString('hex');

    const [device] = await db
      .insert(scannerDevices)
      .values({
        tenantId,
        deviceLabel: body.deviceLabel,
        branchId: body.branchId || null,
        pairedAt: new Date().toISOString(),
        isDisabled: false,
        secretKey,
      })
      .returning();

    recordAudit(context, 'create', 'scanner_device', device!.id);

    return NextResponse.json(
      { success: true, data: { device, secretKey } },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
