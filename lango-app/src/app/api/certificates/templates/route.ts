import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  certificateTemplates,
  certificateTemplateVersions,
} from '@/features/certificates/models/certificates-schema';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireAddon } from '@/libs/api/entitlements';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';

const createSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional().default(''),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'certificate-management');
    await requireCapability(context, 'certificates.issue');

    const rows = await db.select().from(certificateTemplates).where(eq(certificateTemplates.tenantId, tenantId)).orderBy(desc(certificateTemplates.createdAt));

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'certificate-management');
    await requireCapability(context, 'certificates.templates.manage');

    const body = await parseJson(request, createSchema);

    const [template] = await db.insert(certificateTemplates).values({
      tenantId,
      name: body.name,
      description: body.description,
      createdBy: context.userId,
    }).returning();
    if (!template) {
      throw new ApiError(500, 'CREATE_FAILED', 'Erreur lors de la création du modèle.');
    }

    await db.insert(certificateTemplateVersions).values({
      tenantId,
      templateId: template.id,
      versionNumber: 1,
      templateSchema: [[]],
      pdfmeBasePdf: { width: 794, height: 1123, padding: [0, 0, 0, 0] },
      createdBy: context.userId,
    });

    recordAudit(context, 'create', 'certificate_template', template.id, { name: template.name });

    return NextResponse.json({ success: true, data: template }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
