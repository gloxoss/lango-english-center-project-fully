// Shared HMAC badge issuance — the ONE implementation used by both the admin
// identity-badges routes and the guard visitor-pass route, so there is
// provably a single signed badge format. The raw token is returned exactly
// once; only its HMAC hash is stored.
import { and, eq } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from '@/libs/DB';
import { computeHmacHash } from '@/libs/api/badge-crypto';
import { identityBadgeCredentials } from '@/models/Schema';

/**
 * Whether a credential has passed its expiry instant.
 *
 * Expiry is an absolute instant, so this comparison is timezone-independent and
 * needs no school-local calendar. A credential whose stored expiry cannot be
 * parsed is treated as expired: a badge we cannot prove is valid must not be
 * honoured. `expiresAt` is nullable, and NULL means "no expiry recorded".
 */
export function isCredentialExpired(
  credential: { expiresAt: string | null },
  now: Date = new Date(),
): boolean {
  if (!credential.expiresAt) {
    return false;
  }

  const expiry = new Date(credential.expiresAt).getTime();
  if (Number.isNaN(expiry)) {
    return true;
  }

  return expiry <= now.getTime();
}

export async function issueBadge(input: {
  tenantId: string;
  userId: string;
  subjectType: 'student' | 'staff' | 'visitor';
  expiresAt?: string | null;
  issuerId: string;
}): Promise<{ badge: typeof identityBadgeCredentials.$inferSelect; rawToken: string }> {
  const rawTokenBytes = crypto.randomBytes(16).toString('hex');
  const rawToken = `LANGQR-${input.subjectType.toUpperCase().slice(0, 3)}-${rawTokenBytes}`;
  const tokenHash = computeHmacHash(rawToken);

  // Revoke and re-issue in ONE transaction. As two statements they can
  // interleave: two concurrent replacements each revoke, then each insert,
  // leaving one student with two active credentials — and the scanner honours
  // whichever it finds first, so the "old" badge keeps working.
  const rows = await db.transaction(async (tx) => {
    await tx
      .update(identityBadgeCredentials)
      .set({ status: 'revoked', revokedAt: new Date().toISOString() })
      .where(and(
        eq(identityBadgeCredentials.tenantId, input.tenantId),
        eq(identityBadgeCredentials.userId, input.userId),
        eq(identityBadgeCredentials.status, 'active'),
      ));

    return tx
      .insert(identityBadgeCredentials)
      .values({
        tenantId: input.tenantId,
        userId: input.userId,
        subjectType: input.subjectType,
        tokenHash,
        displayPrefix: rawToken.slice(0, 12),
        status: 'active',
        expiresAt: input.expiresAt ?? null,
        issuerId: input.issuerId,
      })
      .returning();
  });

  return { badge: rows[0]!, rawToken };
}
