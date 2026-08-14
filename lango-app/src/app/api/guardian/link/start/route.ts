import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { guardians, parentGuardianLinkTokens } from '@/models/Schema';
import { generateSetupToken, hashSetupToken, SETUP_TOKEN_TTL_MS } from '@/libs/setup-token';

// POST /api/guardian/link/start — staff issue a one-time, hashed link token for
// a guardian record. The raw token is returned to staff once (they relay it via
// SMS/email); only its SHA-256 digest is stored. The token binds the redeeming
// authenticated account to the guardian record — it never exposes a password.
const startSchema = z.object({ guardianId: z.string().uuid() }).strict();

export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'students.guardians.manage');
    const body = await parseJson(request, startSchema);

    const [guardian] = await db
      .select({ id: guardians.id, userId: guardians.userId })
      .from(guardians)
      .where(and(eq(guardians.id, body.guardianId), eq(guardians.tenantId, tenantId)))
      .limit(1);
    if (!guardian) {
      throw new ApiError(404, 'GUARDIAN_NOT_FOUND', 'Tuteur introuvable.');
    }
    if (guardian.userId) {
      throw new ApiError(409, 'ALREADY_LINKED', 'Ce tuteur est déjà relié à un compte.');
    }

    const rawToken = generateSetupToken();
    const [inserted] = await db
      .insert(parentGuardianLinkTokens)
      .values({
        tenantId,
        guardianId: guardian.id,
        token: hashSetupToken(rawToken),
        expiresAt: new Date(Date.now() + SETUP_TOKEN_TTL_MS).toISOString(),
        createdBy: ctx.userId,
      })
      .returning();

    recordAudit(ctx, 'create', 'guardian_link_token', inserted!.id, { guardianId: guardian.id });

    return NextResponse.json({
      success: true,
      data: { id: inserted!.id, token: rawToken },
      message: 'Jeton de liaison généré. Transmettez-le au tuteur (SMS/e-mail).',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
