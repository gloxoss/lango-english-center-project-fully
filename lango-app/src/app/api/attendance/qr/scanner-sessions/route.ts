import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { classSections, scannerDevices, scannerSessions } from '@/models/Schema';

const startSessionSchema = z.object({
  classSectionId: z.string().uuid(),
  deviceId: z.string().uuid().optional().nullable(),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'attendance.manage');
    const body = await parseJson(request, startSessionSchema);

    // The session's class-scope must exist inside this tenant — the roster the
    // kiosk scans against is locked to this section.
    const [section] = await db
      .select({ id: classSections.id })
      .from(classSections)
      .where(and(eq(classSections.id, body.classSectionId), eq(classSections.tenantId, tenantId)))
      .limit(1);
    if (!section) {
      throw new ApiError(422, 'INVALID_CLASS', 'La classe/section indiquée n\'existe pas pour cet établissement.');
    }

    if (body.deviceId) {
      const [device] = await db
        .select({ id: scannerDevices.id, isDisabled: scannerDevices.isDisabled })
        .from(scannerDevices)
        .where(and(eq(scannerDevices.id, body.deviceId), eq(scannerDevices.tenantId, tenantId)))
        .limit(1);
      if (!device) {
        throw new ApiError(422, 'INVALID_DEVICE', 'Le dispositif de scan indiqué n\'existe pas pour cet établissement.');
      }
      if (device.isDisabled) {
        throw new ApiError(409, 'DEVICE_DISABLED', 'Ce dispositif de scan est désactivé.');
      }
    }

    const [session] = await db
      .insert(scannerSessions)
      .values({
        tenantId,
        deviceId: body.deviceId || null,
        operatorId: context.userId,
        classSectionId: body.classSectionId,
        startedAt: new Date().toISOString(),
        status: 'active',
      })
      .returning();

    recordAudit(context, 'create', 'scanner_session', session!.id, {
      classSectionId: body.classSectionId,
      deviceId: body.deviceId || null,
    });

    return NextResponse.json({ success: true, data: session }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
