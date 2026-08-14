import { and, desc, eq } from 'drizzle-orm';
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
  certificateDefinitions,
  certificateDefinitionVersions,
} from '@/features/certificates/models/certificates-schema';

const createSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional().default(''),
  allowedTargetType: z.enum(['student', 'employee']),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'certificate-management');
    await requireCapability(context, 'certificates.issue');

    const url = new URL(request.url);
    const targetType = url.searchParams.get('targetType');

    const rows = await db.select()
      .from(certificateDefinitions)
      .where(and(
        eq(certificateDefinitions.tenantId, tenantId),
        targetType ? eq(certificateDefinitions.allowedTargetType, targetType) : undefined,
      ))
      .orderBy(desc(certificateDefinitions.createdAt));

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

    const [definition] = await db.insert(certificateDefinitions).values({
      tenantId,
      title: body.title,
      description: body.description,
      allowedTargetType: body.allowedTargetType,
      createdBy: context.userId,
    }).returning();
    if (!definition) {
      throw new ApiError(500, 'CREATE_FAILED', 'Erreur lors de la création de la définition.');
    }

    // Every definition starts with an empty v1 draft version so the NOT NULL
    // jsonb columns are satisfied and the policy/template can be designed.
    await db.insert(certificateDefinitionVersions).values({
      tenantId,
      definitionId: definition.id,
      versionNumber: 1,
      fieldAllowlist: { allowedFields: [] },
      templateSchema: [],
      pdfmeBasePdf: { width: 794, height: 1123 },
      createdBy: context.userId,
    });

    recordAudit(context, 'create', 'certificate_definition', definition.id, {
      title: definition.title,
      allowedTargetType: definition.allowedTargetType,
    });

    return NextResponse.json({ success: true, data: definition }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
