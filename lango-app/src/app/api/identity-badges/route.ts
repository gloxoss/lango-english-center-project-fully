import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { issueBadge } from '@/libs/api/badge-service';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { identityBadgeCredentials } from '@/models/Schema';

const issueBadgeSchema = z.object({
  userId: z.string().min(1),
  subjectType: z.enum(['student', 'staff', 'visitor']).default('student'),
  expiresAt: z.string().optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'attendance.read');

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const conditions = [eq(identityBadgeCredentials.tenantId, tenantId)];
    if (userId) {
      conditions.push(eq(identityBadgeCredentials.userId, userId));
    }

    const items = await db
      .select()
      .from(identityBadgeCredentials)
      .where(and(...conditions))
      .orderBy(desc(identityBadgeCredentials.issuedAt));

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
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'attendance.manage');
    const body = await parseJson(request, issueBadgeSchema);

    const { badge: newBadge, rawToken } = await issueBadge({
      tenantId,
      userId: body.userId,
      subjectType: body.subjectType,
      expiresAt: body.expiresAt || null,
      issuerId: context.userId,
    });

    await recordAudit(context, 'create', 'identity_badge', newBadge.id);

    return NextResponse.json(
      {
        success: true,
        data: {
          badge: newBadge,
          rawToken, // Return raw token ONCE for printable QR generation
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
