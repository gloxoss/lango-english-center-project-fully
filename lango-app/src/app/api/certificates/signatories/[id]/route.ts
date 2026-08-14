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
import { certificateSignatories } from '@/features/certificates/models/certificates-schema';

const patchSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  title: z.string().trim().min(1).max(255).optional(),
  signatureImageId: z.string().trim().max(255).optional(),
  isActive: z.boolean().optional(),
}).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'certificate-management');
    await requireCapability(context, 'certificates.templates.manage');

    const body = await parseJson(request, patchSchema);

    const [existing] = await db.select().from(certificateSignatories)
      .where(and(eq(certificateSignatories.tenantId, tenantId), eq(certificateSignatories.id, id)))
      .limit(1);
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Signataire introuvable pour cet établissement.');
    }

    const [updated] = await db.update(certificateSignatories)
      .set({ ...body })
      .where(and(eq(certificateSignatories.tenantId, tenantId), eq(certificateSignatories.id, id)))
      .returning();

    recordAudit(context, 'update', 'certificate_signatory', id, body);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'certificate-management');
    await requireCapability(context, 'certificates.templates.manage');

    const [existing] = await db.select().from(certificateSignatories)
      .where(and(eq(certificateSignatories.tenantId, tenantId), eq(certificateSignatories.id, id)))
      .limit(1);
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Signataire introuvable pour cet établissement.');
    }

    await db.delete(certificateSignatories)
      .where(and(eq(certificateSignatories.tenantId, tenantId), eq(certificateSignatories.id, id)));

    recordAudit(context, 'delete', 'certificate_signatory', id);
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
