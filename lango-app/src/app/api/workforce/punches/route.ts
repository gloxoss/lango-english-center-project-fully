import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { identityBadgeCredentials, user, workforcePunchEvents } from '@/models/Schema';

const HMAC_SECRET = process.env.BETTER_AUTH_SECRET || 'lango-qr-secret-key-sentinel';

function computeHmacHash(rawToken: string): string {
  return crypto.createHmac('sha256', HMAC_SECRET).update(rawToken).digest('hex');
}

const punchSchema = z.object({
  rawToken: z.string().trim().min(1),
  punchType: z.enum(['in', 'out']),
  notes: z.string().optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'hr.read');

    const items = await db
      .select({
        id: workforcePunchEvents.id,
        employeeId: workforcePunchEvents.employeeId,
        punchType: workforcePunchEvents.punchType,
        scannedAt: workforcePunchEvents.scannedAt,
        employeeName: user.name,
      })
      .from(workforcePunchEvents)
      .leftJoin(user, eq(workforcePunchEvents.employeeId, user.id))
      .where(eq(workforcePunchEvents.tenantId, tenantId))
      .orderBy(desc(workforcePunchEvents.scannedAt))
      .limit(50);

    return NextResponse.json({
      success: true,
      data: items,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, punchSchema);

    // Compute HMAC hash of raw badge token
    const tokenHash = computeHmacHash(body.rawToken);

    // Resolve staff badge
    const [badge] = await db
      .select()
      .from(identityBadgeCredentials)
      .where(
        and(
          eq(identityBadgeCredentials.tenantId, tenantId),
          eq(identityBadgeCredentials.tokenHash, tokenHash),
          eq(identityBadgeCredentials.status, 'active')
        )
      )
      .limit(1);

    if (!badge) {
      throw new ApiError(404, 'STAFF_BADGE_INVALID', 'Badge employé non reconnu ou inactif.');
    }

    const [staffUser] = await db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(and(eq(user.id, badge.userId), eq(user.tenantId, tenantId)))
      .limit(1);

    if (!staffUser) {
      throw new ApiError(404, 'EMPLOYEE_NOT_FOUND', 'Employé introuvable.');
    }

    const [punch] = await db
      .insert(workforcePunchEvents)
      .values({
        tenantId,
        employeeId: staffUser.id,
        credentialId: badge.id,
        punchType: body.punchType,
        notes: body.notes || null,
      })
      .returning();

    await recordAudit(context, 'create', 'workforce_punch', punch!.id);

    return NextResponse.json({
      success: true,
      data: {
        punch,
        employeeName: staffUser.name,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
