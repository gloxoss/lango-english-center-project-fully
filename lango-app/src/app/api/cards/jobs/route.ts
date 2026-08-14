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
  documentGenerationItems,
  documentGenerationJobs,
  documentTemplates,
  documentTemplateVersions,
} from '@/features/cards/models/cards-schema';

const createJobSchema = z.object({
  templateVersionId: z.uuid(),
  subjectType: z.enum(['student', 'employee', 'exam_candidate']),
  subjectIds: z.array(z.string().trim().min(1).max(255)).min(1).max(500),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'card-management');
    await requireCapability(context, 'cards.issue');

    const jobs = await db.select().from(documentGenerationJobs)
      .where(eq(documentGenerationJobs.tenantId, tenantId))
      .orderBy(desc(documentGenerationJobs.createdAt));

    return NextResponse.json({ success: true, data: jobs });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'card-management');
    await requireCapability(context, 'cards.issue');

    const body = await parseJson(request, createJobSchema);

    const [version] = await db.select().from(documentTemplateVersions)
      .where(and(
        eq(documentTemplateVersions.tenantId, tenantId),
        eq(documentTemplateVersions.id, body.templateVersionId),
      ))
      .limit(1);
    if (!version) throw new ApiError(404, 'NOT_FOUND', 'Version de modèle introuvable.');
    if (!version.publishedById) {
      throw new ApiError(400, 'NOT_PUBLISHED', 'Seule une version publiée peut être émise en lot.');
    }

    const [template] = await db.select().from(documentTemplates)
      .where(and(eq(documentTemplates.tenantId, tenantId), eq(documentTemplates.id, version.templateId)))
      .limit(1);
    if (!template) throw new ApiError(404, 'NOT_FOUND', 'Modèle introuvable.');

    const expectedType: Record<string, string> = {
      student: 'student_id',
      employee: 'employee_id',
      exam_candidate: 'admit_card',
    };
    if (template.type !== expectedType[body.subjectType]) {
      throw new ApiError(400, 'TYPE_MISMATCH', `Le modèle est de type "${template.type}" mais le sujet est de type "${body.subjectType}".`);
    }

    const [job] = await db.transaction(async (tx) => {
      const [newJob] = await tx.insert(documentGenerationJobs).values({
        tenantId,
        type: template.type,
        templateVersionId: version.id,
        filtersSnapshot: { subjectIds: body.subjectIds },
        status: 'queued',
        totalCount: body.subjectIds.length,
        createdBy: context.userId,
      }).returning();

      await tx.insert(documentGenerationItems).values(
        body.subjectIds.map(subjectId => ({
          tenantId,
          jobId: newJob!.id,
          subjectType: body.subjectType,
          subjectId,
          status: 'pending' as const,
        })),
      );

      return [newJob];
    });

    recordAudit(context, 'create', 'document_generation_job', job!.id, {
      templateVersionId: version.id,
      totalCount: body.subjectIds.length,
    });

    return NextResponse.json({
      success: true,
      data: job,
      message: 'Lot créé avec succès',
    }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
