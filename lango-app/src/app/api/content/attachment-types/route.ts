import { and, asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { attachmentTypes } from '@/features/attachments/models/attachments-schema';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';

const createAttachmentTypeSchema = z.object({
  name: z.string().trim().min(1).max(255),
  code: z.string().trim().min(1).max(50),
  icon: z.string().trim().optional(),
  color: z.string().trim().optional(),
  allowedMimeFamilies: z.array(z.string()).min(1),
  maxSizeBytes: z.number().int().positive().optional(),
  studentVisible: z.boolean().optional(),
  downloadable: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);

    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';

    const conditions = [eq(attachmentTypes.tenantId, tenantId)];
    if (!includeArchived) conditions.push(eq(attachmentTypes.isActive, true));

    const types = await db
      .select()
      .from(attachmentTypes)
      .where(and(...conditions))
      .orderBy(asc(attachmentTypes.displayOrder));

    return NextResponse.json({ success: true, data: types });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'content.types.manage');
    const body = await parseJson(request, createAttachmentTypeSchema);

    const [created] = await db
      .insert(attachmentTypes)
      .values({
        tenantId,
        name: body.name,
        code: body.code,
        icon: body.icon,
        color: body.color,
        allowedMimeFamilies: body.allowedMimeFamilies,
        maxSizeBytes: body.maxSizeBytes,
        studentVisible: body.studentVisible,
        downloadable: body.downloadable,
        displayOrder: body.displayOrder,
      })
      .returning();

    recordAudit(context, 'create', 'attachment_type', created!.id, { name: body.name });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
