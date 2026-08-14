import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { documentEvents, issuedDocuments } from '@/features/cards/models/cards-schema';
import { z } from 'zod';

const revokeSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'card-management');
    await requireCapability(context, 'cards.revoke');

    const body = await parseJson(request, revokeSchema);

    const [doc] = await db.select().from(issuedDocuments)
      .where(and(eq(issuedDocuments.tenantId, tenantId), eq(issuedDocuments.id, id)))
      .limit(1);
    if (!doc) throw new ApiError(404, 'NOT_FOUND', 'Document émis introuvable.');
    if (doc.status === 'revoked') {
      return NextResponse.json({ success: true, data: doc, message: 'Document déjà révoqué.' });
    }

    const [updated] = await db.update(issuedDocuments)
      .set({
        status: 'revoked',
        revokedById: context.userId,
        revokedAt: new Date().toISOString(),
        revokeReason: body.reason ?? null,
      })
      .where(and(eq(issuedDocuments.id, id), eq(issuedDocuments.tenantId, tenantId)))
      .returning();

    await db.insert(documentEvents).values({
      tenantId,
      issuedDocumentId: id,
      eventKind: 'revoked',
      actorId: context.userId,
      metadata: { reason: body.reason ?? null },
    });

    recordAudit(context, 'update', 'issued_document', id, { status: 'revoked', reason: body.reason ?? null });

    return NextResponse.json({ success: true, data: updated, message: 'Document révoqué avec succès.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
