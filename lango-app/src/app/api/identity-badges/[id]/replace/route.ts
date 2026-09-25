import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { computeHmacHash } from '@/libs/api/badge-crypto';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { identityBadgeCredentials, user } from '@/models/Schema';

const replaceBadgeSchema = z.object({
  expiresAt: z.string().optional().nullable(),
}).strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'attendance.manage');
    const body = await parseJson(request, replaceBadgeSchema);

    const [oldBadge] = await db
      .select()
      .from(identityBadgeCredentials)
      .where(and(eq(identityBadgeCredentials.id, id), eq(identityBadgeCredentials.tenantId, tenantId)))
      .limit(1);

    if (!oldBadge) {
      throw new ApiError(404, 'BADGE_NOT_FOUND', 'Badge introuvable.');
    }
    if (oldBadge.status === 'replaced') {
      throw new ApiError(409, 'BADGE_ALREADY_REPLACED', 'Ce badge a déjà été remplacé.');
    }

    // The subject must still exist inside the tenant (the old badge may outlive
    // a delete if it was revoked but the row cascaded — guard the link target).
    const [subject] = await db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(and(eq(user.id, oldBadge.userId), eq(user.tenantId, tenantId)))
      .limit(1);
    if (!subject) {
      throw new ApiError(422, 'USER_NOT_FOUND', 'Le titulaire du badge est introuvable pour cet établissement.');
    }

    // Issue a fresh credential for the same subject, then mark the old one
    // replaced and link it forward so the audit chain stays intact.
    const rawTokenBytes = crypto.randomBytes(16).toString('hex');
    const rawToken = `LANGQR-${oldBadge.subjectType.toUpperCase().slice(0, 3)}-${rawTokenBytes}`;
    const tokenHash = computeHmacHash(rawToken);

    // Insert the new credential and retire the old one in ONE transaction. As
    // two statements, a failure between them leaves TWO active badges for the
    // same student, and the scanner honours whichever it finds first — so the
    // credential the school just replaced keeps working.
    const newBadge = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(identityBadgeCredentials)
        .values({
          tenantId,
          userId: oldBadge.userId,
          subjectType: oldBadge.subjectType,
          tokenHash,
          displayPrefix: rawToken.slice(0, 12),
          status: 'active',
          expiresAt: body.expiresAt || null,
          issuerId: context.userId,
        })
        .returning();

      await tx
        .update(identityBadgeCredentials)
        .set({
          status: 'replaced',
          replacementId: inserted!.id,
          revokedAt: new Date().toISOString(),
        })
        .where(and(eq(identityBadgeCredentials.id, oldBadge.id), eq(identityBadgeCredentials.tenantId, tenantId)));

      return inserted!;
    });

    recordAudit(context, 'create', 'identity_badge', newBadge!.id, {
      replacedBadgeId: oldBadge.id,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          badge: newBadge,
          rawToken,
          userName: subject.name,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
