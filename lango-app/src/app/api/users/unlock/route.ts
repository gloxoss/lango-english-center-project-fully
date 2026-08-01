import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';

const unlockUserSchema = z.object({
  userId: z.string().min(1),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, unlockUserSchema);

    const [targetUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, body.userId), eq(user.tenantId, tenantId)))
      .limit(1);

    if (!targetUser) {
      throw new ApiError(404, 'NOT_FOUND', 'Utilisateur introuvable.');
    }

    await db
      .update(user)
      .set({
        failedLoginCount: 0,
        lockedUntil: null,
      })
      .where(and(eq(user.id, body.userId), eq(user.tenantId, tenantId)));

    await recordAudit(context, 'update', 'user_unlock', body.userId, { unlockedBy: context.userId });

    return NextResponse.json({
      success: true,
      message: 'Compte déverrouillé avec succès.',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
