import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { computeHmacHash } from '@/libs/api/badge-crypto';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireCapability } from '@/libs/api/permissions';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { identityBadgeCredentials, user } from '@/models/Schema';

const bulkIssueRowSchema = z.object({
  userId: z.string().min(1).max(100),
  subjectType: z.enum(['student', 'staff', 'visitor']).default('student'),
  expiresAt: z.string().optional().nullable(),
});

const bulkIssueSchema = z.object({
  rows: z.array(bulkIssueRowSchema).min(1).max(500),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'attendance.manage');
    const body = await parseJson(request, bulkIssueSchema);

    // Verify every target user exists inside this tenant before writing
    // anything, so a single unknown id fails fast instead of half-issuing.
    const userIds = [...new Set(body.rows.map(r => r.userId))];
    const known = userIds.length > 0
      ? await db
          .select({ id: user.id, name: user.name })
          .from(user)
          .where(and(inArray(user.id, userIds), eq(user.tenantId, tenantId)))
      : [];
    const knownById = new Map(known.map(u => [u.id, u.name]));

    const failures: { userId: string; reason: string }[] = [];
    const issued: {
      badge: typeof identityBadgeCredentials.$inferSelect;
      rawToken: string;
      userName: string;
    }[] = [];

    // One active badge per user is the idempotency contract: re-running the
    // same bulk issuance for the same roster revokes the prior active badge
    // and issues a fresh one, so the end state never contains duplicates.
    await db.transaction(async (tx) => {
      for (const row of body.rows) {
        const userName = knownById.get(row.userId);
        if (!userName) {
          failures.push({ userId: row.userId, reason: 'USER_NOT_FOUND' });
          continue;
        }

        await tx
          .update(identityBadgeCredentials)
          .set({ status: 'revoked', revokedAt: new Date().toISOString() })
          .where(and(
            eq(identityBadgeCredentials.tenantId, tenantId),
            eq(identityBadgeCredentials.userId, row.userId),
            eq(identityBadgeCredentials.status, 'active'),
          ));

        const rawTokenBytes = crypto.randomBytes(16).toString('hex');
        const rawToken = `LANGQR-${row.subjectType.toUpperCase().slice(0, 3)}-${rawTokenBytes}`;
        const tokenHash = computeHmacHash(rawToken);

        const [badge] = await tx
          .insert(identityBadgeCredentials)
          .values({
            tenantId,
            userId: row.userId,
            subjectType: row.subjectType,
            tokenHash,
            displayPrefix: rawToken.slice(0, 12),
            status: 'active',
            expiresAt: row.expiresAt || null,
            issuerId: context.userId,
          })
          .returning();

        issued.push({ badge: badge!, rawToken, userName });
      }
    });

    for (const item of issued) {
      recordAudit(context, 'create', 'identity_badge', item.badge.id);
    }

    return NextResponse.json({
      success: true,
      data: { issued, failures },
    }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
