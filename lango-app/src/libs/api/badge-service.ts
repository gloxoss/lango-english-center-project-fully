// Shared HMAC badge issuance — the ONE implementation used by both the admin
// identity-badges routes and the guard visitor-pass route, so there is
// provably a single signed badge format. The raw token is returned exactly
// once; only its HMAC hash is stored.
import { and, eq } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from '@/libs/DB';
import { computeHmacHash } from '@/libs/api/badge-crypto';
import { identityBadgeCredentials } from '@/models/Schema';

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

  // Revoke any existing active badge for this user (one active badge per user).
  await db
    .update(identityBadgeCredentials)
    .set({ status: 'revoked', revokedAt: new Date().toISOString() })
    .where(and(
      eq(identityBadgeCredentials.tenantId, input.tenantId),
      eq(identityBadgeCredentials.userId, input.userId),
      eq(identityBadgeCredentials.status, 'active'),
    ));

  const rows = await db
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

  return { badge: rows[0]!, rawToken };
}
