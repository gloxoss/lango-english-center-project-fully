import { randomBytes, randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { hashSetupToken } from '@/libs/setup-token';
import { db } from '@/libs/DB';
import { getEffectiveValueWithLegacyFallback } from '@/libs/settings/registry';
import {
  account, accountSetupTokens, guardians, guardianStudents, smsMessages, user,
} from '@/models/Schema';

// Closes a real support gap: a temp password or invite-link SMS that never
// reached the guardian had no recovery path once approval was over. Repeats
// the exact logic from PUT /api/students/admissions's approval transaction,
// against an already-enrolled student instead. Not wrapped in that
// transaction - this is a standalone action.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const { id: studentId } = await params;

    const [student] = await db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId), eq(user.role, 'student')))
      .limit(1);
    if (!student) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'Élève introuvable pour cet établissement.');
    }

    const { value: loginAccessMethodValue } = await getEffectiveValueWithLegacyFallback(tenantId, null, 'security.loginAccessMethod');
    const loginAccessMethod = (loginAccessMethodValue as string) || 'invite_link';

    let tempPassword: string | null = null;
    let loginAccessDeliveryStatus: string | null = null;

    if (loginAccessMethod === 'temp_password') {
      tempPassword = randomBytes(9).toString('base64url');
      const hashed = await hashPassword(tempPassword);
      await db.delete(account).where(and(eq(account.userId, student.id), eq(account.providerId, 'credential')));
      await db.insert(account).values({
        id: randomUUID(),
        accountId: student.id,
        providerId: 'credential',
        userId: student.id,
        password: hashed,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      // Invalidate previous unused tokens so only the newest one works.
      await db.update(accountSetupTokens).set({ usedAt: new Date().toISOString() }).where(and(eq(accountSetupTokens.userId, student.id), isNull(accountSetupTokens.usedAt)));

      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await db.insert(accountSetupTokens).values({ tenantId, userId: student.id, token: hashSetupToken(token), expiresAt });

      const [primaryGuardian] = await db
        .select({ phone: guardians.phone })
        .from(guardianStudents)
        .innerJoin(guardians, eq(guardianStudents.guardianId, guardians.id))
        .where(and(eq(guardianStudents.tenantId, tenantId), eq(guardianStudents.studentId, student.id)))
        .orderBy(desc(guardianStudents.isPrimaryContact))
        .limit(1);

      if (primaryGuardian?.phone) {
        await db.insert(smsMessages).values({
          tenantId,
          recipientPhone: primaryGuardian.phone,
          studentId: student.id,
          body: `Nouveau lien d'activation pour le compte de ${student.name} : /setup-account?token=${token}`,
          status: 'sent',
          sentAt: new Date().toISOString(),
          createdById: context.userId,
        });
        loginAccessDeliveryStatus = 'sent';
      } else {
        loginAccessDeliveryStatus = 'no_guardian_phone';
      }
    }

    recordAudit(context, 'update', 'student_access', student.id, { action: 'regenerate_access' });

    return NextResponse.json({ success: true, data: { loginAccessMethod, tempPassword, loginAccessDeliveryStatus } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
