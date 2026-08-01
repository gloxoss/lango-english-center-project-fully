import { randomBytes } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { accessResetRequests, account, guardians, guardianStudents, smsMessages, user } from '@/models/Schema';

// ponytail: "code" here is a real temporary password for the guardian's
// parent-portal account (created on first use if they have none), not a
// redeemable OTP - this app has no OTP-login flow, only Better Auth
// email/password, so a real temp password is what actually lets a parent
// log in. Never persisted in plaintext - only its hash, on `account`.
function generateTempPassword(): string {
  return randomBytes(9).toString('base64url');
}

const generateSchema = z.object({ studentId: z.string().min(1) }).strict();
const sendSmsSchema = z.object({ requestId: z.string().uuid(), action: z.literal('send_sms'), code: z.string().min(1) }).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);

    const rows = await db
      .select({
        id: accessResetRequests.id,
        studentId: accessResetRequests.studentId,
        studentName: user.name,
        status: accessResetRequests.status,
        createdAt: accessResetRequests.createdAt,
        guardianFirstName: guardians.firstName,
        guardianLastName: guardians.lastName,
        guardianPhone: guardians.phone,
      })
      .from(accessResetRequests)
      .innerJoin(user, eq(accessResetRequests.studentId, user.id))
      .innerJoin(guardians, eq(accessResetRequests.guardianId, guardians.id))
      .where(eq(accessResetRequests.tenantId, tenantId))
      .orderBy(desc(accessResetRequests.createdAt))
      .limit(100);

    const data = rows.map(r => ({
      id: r.id,
      studentName: r.studentName,
      className: '—',
      guardianName: `${r.guardianFirstName} ${r.guardianLastName}`.trim(),
      phone: r.guardianPhone ?? '',
      status: r.status === 'sms_sent' ? 'SMS envoyé' : 'Code généré',
      requestedAt: new Date(r.createdAt).toLocaleString('fr-FR'),
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const raw = await request.clone().json().catch(() => ({}));

    if (raw.action === 'send_sms') {
      const body = await parseJson(request, sendSmsSchema);
      const [reqRow] = await db
        .select({ id: accessResetRequests.id, guardianId: accessResetRequests.guardianId })
        .from(accessResetRequests)
        .where(and(eq(accessResetRequests.id, body.requestId), eq(accessResetRequests.tenantId, tenantId)))
        .limit(1);
      if (!reqRow) {
        throw new ApiError(404, 'NOT_FOUND', 'Demande introuvable.');
      }
      const [guardian] = await db.select({ phone: guardians.phone }).from(guardians).where(eq(guardians.id, reqRow.guardianId)).limit(1);

      await db.insert(smsMessages).values({
        tenantId,
        recipientPhone: guardian?.phone ?? '—',
        body: `Votre code d'accès temporaire SchoolOS : ${body.code}`,
        status: 'sent',
        sentAt: new Date().toISOString(),
        createdById: context.userId,
      });
      await db.update(accessResetRequests).set({ status: 'sms_sent' }).where(eq(accessResetRequests.id, body.requestId));

      recordAudit(context, 'update', 'access_reset_request', body.requestId, { action: 'send_sms' });
      return NextResponse.json({ success: true, code: body.code, message: 'SMS (simulé) envoyé.' });
    }

    const body = await parseJson(request, generateSchema);

    const [student] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, body.studentId), eq(user.tenantId, tenantId), eq(user.role, 'student')))
      .limit(1);
    if (!student) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'L\'élève indiqué n\'existe pas pour cet établissement.');
    }

    const [link] = await db
      .select({ guardianId: guardianStudents.guardianId })
      .from(guardianStudents)
      .where(and(eq(guardianStudents.tenantId, tenantId), eq(guardianStudents.studentId, body.studentId)))
      .orderBy(desc(guardianStudents.isPrimaryContact))
      .limit(1);
    if (!link) {
      throw new ApiError(422, 'NO_GUARDIAN', 'Aucun tuteur lié à cet élève. Ajoutez un tuteur avant de réinitialiser l\'accès.');
    }

    const [guardian] = await db.select().from(guardians).where(eq(guardians.id, link.guardianId)).limit(1);
    if (!guardian) {
      throw new ApiError(404, 'NOT_FOUND', 'Tuteur introuvable.');
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = await hashPassword(tempPassword);
    const now = new Date();

    let parentUserId = guardian.userId;

    if (!parentUserId) {
      parentUserId = `PARENT-${Date.now()}`;
      await db.transaction(async (tx) => {
        await tx.insert(user).values({
          id: parentUserId!,
          tenantId,
          name: `${guardian.firstName} ${guardian.lastName}`.trim(),
          email: guardian.email || `${parentUserId!.toLowerCase()}@placeholder.local`,
          phone: guardian.phone,
          role: 'parent',
          userStatus: 'active',
        });
        await tx.insert(account).values({
          id: `credential-${parentUserId!.toLowerCase()}`,
          accountId: parentUserId!,
          providerId: 'credential',
          userId: parentUserId!,
          password: hashedPassword,
          createdAt: now,
          updatedAt: now,
        });
        await tx.update(guardians).set({ userId: parentUserId }).where(eq(guardians.id, guardian.id));
      });
    } else {
      await db
        .update(account)
        .set({ password: hashedPassword, updatedAt: now })
        .where(and(eq(account.userId, parentUserId), eq(account.providerId, 'credential')));
    }

    const [inserted] = await db
      .insert(accessResetRequests)
      .values({ tenantId, studentId: body.studentId, guardianId: guardian.id, status: 'code_generated' })
      .returning();

    recordAudit(context, 'create', 'access_reset_request', inserted!.id, { studentId: body.studentId });

    return NextResponse.json({ success: true, code: tempPassword, data: { id: inserted!.id }, message: 'Code temporaire généré.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
