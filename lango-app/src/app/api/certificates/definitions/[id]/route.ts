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
import { certificateDefinitions } from '@/features/certificates/models/certificates-schema';

const patchSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(2000).optional(),
  allowedTargetType: z.enum(['student', 'employee']).optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
}).strict();

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'certificate-management');
    await requireCapability(context, 'certificates.issue');

    const [definition] = await db.select().from(certificateDefinitions)
      .where(and(eq(certificateDefinitions.tenantId, tenantId), eq(certificateDefinitions.id, id)))
      .limit(1);

    if (!definition) {
      throw new ApiError(404, 'NOT_FOUND', 'Définition introuvable pour cet établissement.');
    }

    return NextResponse.json({ success: true, data: definition });
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

    const [existing] = await db.select().from(certificateDefinitions)
      .where(and(eq(certificateDefinitions.tenantId, tenantId), eq(certificateDefinitions.id, id)))
      .limit(1);
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Définition introuvable pour cet établissement.');
    }

    const [updated] = await db.update(certificateDefinitions)
      .set({ ...body })
      .where(and(eq(certificateDefinitions.tenantId, tenantId), eq(certificateDefinitions.id, id)))
      .returning();

    recordAudit(context, 'update', 'certificate_definition', id, body);
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

    const [existing] = await db.select().from(certificateDefinitions)
      .where(and(eq(certificateDefinitions.tenantId, tenantId), eq(certificateDefinitions.id, id)))
      .limit(1);
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Définition introuvable pour cet établissement.');
    }

    // Archive rather than hard-delete; issued certificates reference definitions.
    const [updated] = await db.update(certificateDefinitions)
      .set({ status: 'archived' })
      .where(and(eq(certificateDefinitions.tenantId, tenantId), eq(certificateDefinitions.id, id)))
      .returning();

    recordAudit(context, 'delete', 'certificate_definition', id, { archived: true });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
