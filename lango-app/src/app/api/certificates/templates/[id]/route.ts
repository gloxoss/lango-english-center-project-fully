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
import { certificateTemplates } from '@/features/certificates/models/certificates-schema';

const patchSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
}).strict();

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'certificate-management');
    await requireCapability(context, 'certificates.issue');

    const [template] = await db.select().from(certificateTemplates)
      .where(and(eq(certificateTemplates.tenantId, tenantId), eq(certificateTemplates.id, id)))
      .limit(1);
    if (!template) {
      throw new ApiError(404, 'NOT_FOUND', 'Modèle de certificat introuvable pour cet établissement.');
    }

    return NextResponse.json({ success: true, data: template });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'certificate-management');
    await requireCapability(context, 'certificates.templates.manage');

    const body = await parseJson(request, patchSchema);

    const [existing] = await db.select().from(certificateTemplates)
      .where(and(eq(certificateTemplates.tenantId, tenantId), eq(certificateTemplates.id, id)))
      .limit(1);
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Modèle de certificat introuvable pour cet établissement.');
    }

    const [updated] = await db.update(certificateTemplates)
      .set({ ...body })
      .where(and(eq(certificateTemplates.tenantId, tenantId), eq(certificateTemplates.id, id)))
      .returning();

    recordAudit(context, 'update', 'certificate_template', id, body);
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

    const [existing] = await db.select().from(certificateTemplates)
      .where(and(eq(certificateTemplates.tenantId, tenantId), eq(certificateTemplates.id, id)))
      .limit(1);
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Modèle de certificat introuvable pour cet établissement.');
    }

    const [updated] = await db.update(certificateTemplates)
      .set({ status: 'archived' })
      .where(and(eq(certificateTemplates.tenantId, tenantId), eq(certificateTemplates.id, id)))
      .returning();

    recordAudit(context, 'delete', 'certificate_template', id, { archived: true });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
