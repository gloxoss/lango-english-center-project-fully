import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { attachmentTypes } from '@/features/attachments/models/attachments-schema';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';

const updateAttachmentTypeSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  icon: z.string().trim().optional(),
  color: z.string().trim().optional(),
  allowedMimeFamilies: z.array(z.string()).min(1).optional(),
  maxSizeBytes: z.number().int().positive().optional(),
  studentVisible: z.boolean().optional(),
  downloadable: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
}).strict();

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'attachments-book');
    await requireCapability(context, 'content.types.manage');
    const body = await parseJson(request, updateAttachmentTypeSchema);

    const [existing] = await db.select().from(attachmentTypes).where(and(eq(attachmentTypes.id, id), eq(attachmentTypes.tenantId, tenantId))).limit(1);
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Type de pièce jointe introuvable.');
    }
    if (existing.isSystem) {
      throw new ApiError(403, 'SYSTEM_TYPE_LOCKED', 'Ce type est un type système et ne peut pas être modifié.');
    }

    const [updated] = await db
      .update(attachmentTypes)
      .set({ ...body, updatedAt: new Date().toISOString() })
      .where(and(eq(attachmentTypes.id, id), eq(attachmentTypes.tenantId, tenantId)))
      .returning();

    recordAudit(context, 'update', 'attachment_type', id, {});

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'attachments-book');
    await requireCapability(context, 'content.types.manage');

    const [existing] = await db.select().from(attachmentTypes).where(and(eq(attachmentTypes.id, id), eq(attachmentTypes.tenantId, tenantId))).limit(1);
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Type de pièce jointe introuvable.');
    }

    // Archive, never a hard delete - referenced types stay referenced by
    // existing assets; only new assets are blocked from using an archived type.
    const [archived] = await db
      .update(attachmentTypes)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(and(eq(attachmentTypes.id, id), eq(attachmentTypes.tenantId, tenantId)))
      .returning();

    recordAudit(context, 'update', 'attachment_type', id, { archived: true });

    return NextResponse.json({ success: true, data: archived });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
