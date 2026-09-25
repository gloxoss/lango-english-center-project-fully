import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { recordAudit } from '@/libs/api/audit';
import { computeHmacHash } from '@/libs/api/badge-crypto';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { branches, scannerDevices } from '@/models/Schema';

const pairDeviceSchema = z.object({
  deviceLabel: z.string().trim().min(1).max(255),
  branchId: z.string().uuid().optional().nullable(),
  // Optional room binding: a fixed classroom kiosk then resolves its own session
  // from the timetable instead of being told which class it is.
  roomLabel: z.string().trim().min(1).max(100).optional().nullable(),
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

    // The raw secret is returned exactly once and never stored: the row keeps
    // only its hash, so a database read cannot impersonate a terminal. Same
    // model as a badge token.
    const secretKey = crypto.randomBytes(32).toString('hex');

    const [device] = await db
      .insert(scannerDevices)
      .values({
        tenantId,
        deviceLabel: body.deviceLabel,
        branchId: body.branchId || null,
        roomLabel: body.roomLabel || null,
        pairedAt: new Date().toISOString(),
        isDisabled: false,
        status: 'active',
        secretHash: computeHmacHash(secretKey),
        secretPrefix: secretKey.slice(0, 12),
      })
      .returning();

    recordAudit(context, 'create', 'scanner_device', device!.id, {
      deviceLabel: body.deviceLabel,
      branchId: body.branchId || null,
    });

    // Never return the stored row wholesale: it carries the hash, which is not
    // a secret an operator needs and not one they should see.
    const { secretHash: _hash, secretKey: _legacy, ...safeDevice } = device!;

    return NextResponse.json(
      { success: true, data: { device: safeDevice, secretKey } },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
