import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { hashSetupToken } from '@/libs/setup-token';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { account, accountSetupTokens } from '@/models/Schema';

const setupAccountSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
}).strict();

// No auth required - this IS how a newly-approved student/guardian
// establishes their first login. The token itself is the credential proving
// they received the invite-link. See future-implementation/
// admission-and-student-model, Section 05.
export async function POST(request: Request) {
  try {
    const body = await parseJson(request, setupAccountSchema);

    const [tokenRow] = await db
      .select()
      .from(accountSetupTokens)
      .where(and(eq(accountSetupTokens.token, hashSetupToken(body.token)), isNull(accountSetupTokens.usedAt), gt(accountSetupTokens.expiresAt, new Date().toISOString())))
      .limit(1);

    if (!tokenRow) {
      throw new ApiError(422, 'INVALID_TOKEN', 'Ce lien d\'activation est invalide, déjà utilisé, ou expiré.');
    }

    const hashed = await hashPassword(body.password);

    await db.insert(account).values({
      id: randomUUID(),
      accountId: tokenRow.userId,
      providerId: 'credential',
      userId: tokenRow.userId,
      password: hashed,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.update(accountSetupTokens).set({ usedAt: new Date().toISOString() }).where(eq(accountSetupTokens.id, tokenRow.id));

    return NextResponse.json({ success: true, message: 'Compte activé avec succès.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
