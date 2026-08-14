import { and, eq, gt, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { guardians, parentGuardianLinkTokens } from '@/models/Schema';
import { hashSetupToken } from '@/libs/setup-token';

// POST /api/guardian/link/accept — an authenticated user redeems a one-time
// link token to bind their account to a guardian record. The token is the
// credential (single-use, expiring, digest-only at rest); binding to a record
// that is already claimed by a different account is refused. Cross-tenant
// tokens are refused.
const acceptSchema = z.object({ token: z.string().min(1).max(200) }).strict();

export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);

    const body = await parseJson(request, acceptSchema);
    const hashed = hashSetupToken(body.token);

    const [tokenRow] = await db
      .select()
      .from(parentGuardianLinkTokens)
      .where(and(
        eq(parentGuardianLinkTokens.token, hashed),
        isNull(parentGuardianLinkTokens.usedAt),
        gt(parentGuardianLinkTokens.expiresAt, new Date().toISOString()),
      ))
      .limit(1);

    if (!tokenRow) {
      throw new ApiError(422, 'INVALID_TOKEN', 'Ce jeton de liaison est invalide, déjà utilisé ou expiré.');
    }
    if (tokenRow.tenantId !== tenantId) {
      throw new ApiError(403, 'FORBIDDEN', 'Accès refusé.');
    }

    const [guardian] = await db
      .select({ id: guardians.id, userId: guardians.userId })
      .from(guardians)
      .where(eq(guardians.id, tokenRow.guardianId))
      .limit(1);
    if (!guardian) {
      throw new ApiError(422, 'INVALID_TOKEN', 'Ce jeton de liaison est invalide.');
    }
    if (guardian.userId && guardian.userId !== ctx.userId) {
      throw new ApiError(409, 'ALREADY_LINKED', 'Ce tuteur est déjà relié à un autre compte.');
    }

    await db
      .update(guardians)
      .set({ userId: ctx.userId, updatedAt: new Date().toISOString() })
      .where(eq(guardians.id, guardian.id));
    await db
      .update(parentGuardianLinkTokens)
      .set({ usedAt: new Date().toISOString() })
      .where(eq(parentGuardianLinkTokens.id, tokenRow.id));

    recordAudit(ctx, 'update', 'guardian', guardian.id, { action: 'self_link' });

    return NextResponse.json({ success: true, message: 'Compte relié à votre fiche tuteur.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
