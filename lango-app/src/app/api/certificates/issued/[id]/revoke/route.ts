import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import {
  certificateEvents,
  issuedCertificates,
} from '@/features/certificates/models/certificates-schema';

const revokeSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'certificate-management');
    await requireCapability(context, 'certificates.revoke');

    const body = await parseJson(request, revokeSchema);

    const [certificate] = await db.select().from(issuedCertificates)
      .where(and(eq(issuedCertificates.tenantId, tenantId), eq(issuedCertificates.id, id)))
      .limit(1);
    if (!certificate) {
      throw new ApiError(404, 'NOT_FOUND', 'Certificat émis introuvable pour cet établissement.');
    }

    if (certificate.status === 'revoked') {
      return NextResponse.json({ success: true, data: certificate, message: 'Le certificat est déjà révoqué.' });
    }
    if (certificate.status === 'replaced') {
      throw new ApiError(400, 'CERT_REPLACED', 'Un certificat remplacé ne peut pas être révoqué directement.');
    }

    const [updated] = await db.update(issuedCertificates)
      .set({ status: 'revoked' })
      .where(and(eq(issuedCertificates.tenantId, tenantId), eq(issuedCertificates.id, id)))
      .returning();

    await db.insert(certificateEvents).values({
      tenantId,
      issuedCertificateId: id,
      eventKind: 'revoked',
      actorId: context.userId,
      reason: body.reason,
      metadata: { reason: body.reason ?? null },
    });

    recordAudit(context, 'update', 'issued_certificate', id, { revoked: true, reason: body.reason ?? null });

    return NextResponse.json({ success: true, data: updated, message: 'Certificat révoqué.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
