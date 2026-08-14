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
  certificateJobItems,
  certificateJobs,
} from '@/features/certificates/models/certificates-schema';

const createSchema = z.object({
  definitionId: z.uuid(),
  definitionVersionId: z.uuid(),
  recipientType: z.enum(['student', 'employee']),
  recipientIds: z.array(z.string().trim().min(1).max(255)).min(1).max(200),
  ruleType: z.enum(['manual_authorized', 'enrollment_active', 'assessment_threshold', 'attendance_percentage', 'event_participation', 'hr_employment']),
  ruleParams: z.record(z.string(), z.unknown()).optional().default({}),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'certificate-management');
    await requireCapability(context, 'certificates.issue');

    const rows = await db.select({
      id: certificateJobs.id,
      definitionId: certificateJobs.definitionId,
      status: certificateJobs.status,
      totalCount: certificateJobs.totalCount,
      successCount: certificateJobs.successCount,
      errorCount: certificateJobs.errorCount,
      createdAt: certificateJobs.createdAt,
      createdBy: certificateJobs.createdBy,
      definitionTitle: certificateDefinitions.title,
    })
      .from(certificateJobs)
      .innerJoin(certificateDefinitions, and(
        eq(certificateDefinitions.id, certificateJobs.definitionId),
        eq(certificateDefinitions.tenantId, tenantId),
      ))
      .where(eq(certificateJobs.tenantId, tenantId))
      .orderBy(desc(certificateJobs.createdAt));

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'certificate-management');
    await requireCapability(context, 'certificates.issue');

    const body = await parseJson(request, createSchema);

    const [version] = await db.select().from(certificateDefinitionVersions)
      .where(and(
        eq(certificateDefinitionVersions.tenantId, tenantId),
        eq(certificateDefinitionVersions.id, body.definitionVersionId),
      ))
      .limit(1);
    if (!version) {
      throw new ApiError(404, 'NOT_FOUND', 'Version de définition introuvable pour cet établissement.');
    }
    if (version.status !== 'active') {
      throw new ApiError(400, 'NOT_PUBLISHED', 'Seules les versions actives (publiées) peuvent être émises.');
    }

    const [definition] = await db.select().from(certificateDefinitions)
      .where(and(
        eq(certificateDefinitions.tenantId, tenantId),
        eq(certificateDefinitions.id, body.definitionId),
      ))
      .limit(1);
    if (!definition) {
      throw new ApiError(404, 'NOT_FOUND', 'Définition introuvable pour cet établissement.');
    }
    if (definition.allowedTargetType !== body.recipientType) {
      throw new ApiError(400, 'TYPE_MISMATCH', 'Le type de bénéficiaires ne correspond pas à la définition.');
    }

    const uniqueRecipients = [...new Set(body.recipientIds)];

    const [job] = await db.insert(certificateJobs).values({
      tenantId,
      definitionId: definition.id,
      status: 'pending',
      totalCount: uniqueRecipients.length,
      createdBy: context.userId,
    }).returning();
    if (!job) {
      throw new ApiError(500, 'CREATE_FAILED', 'Erreur lors de la création de l\'émission en lot.');
    }

    await db.insert(certificateJobItems).values(
      uniqueRecipients.map(recipientId => ({
        tenantId,
        jobId: job.id,
        recipientId,
        status: 'pending' as const,
      })),
    );

    recordAudit(context, 'create', 'certificate_job', job.id, {
      definitionId: definition.id,
      recipientCount: uniqueRecipients.length,
    });

    return NextResponse.json({ success: true, data: job }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
