import { and, asc, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { db } from '@/libs/DB';
import {
  certificateDefinitions,
  certificateDefinitionVersions,
  certificateJobItems,
  certificateJobs,
} from '@/features/certificates/models/certificates-schema';
import { issueCertificate } from '@/features/certificates/services/issue-service';

const BATCH_LIMIT = 50;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'certificate-management');
    await requireCapability(context, 'certificates.issue');

    const [jobRow] = await db.select().from(certificateJobs)
      .where(and(eq(certificateJobs.tenantId, tenantId), eq(certificateJobs.id, id)))
      .limit(1);
    if (!jobRow) {
      throw new ApiError(404, 'NOT_FOUND', 'Lot de certificats introuvable pour cet établissement.');
    }

    const [definition] = await db.select().from(certificateDefinitions)
      .where(and(
        eq(certificateDefinitions.tenantId, tenantId),
        eq(certificateDefinitions.id, jobRow.definitionId),
      ))
      .limit(1);
    if (!definition) {
      throw new ApiError(404, 'NOT_FOUND', 'Définition du lot introuvable.');
    }

    // The job schema stores no version column, so issue against the latest
    // active (published) definition version - the immutable pinned policy.
    const [activeVersion] = await db.select().from(certificateDefinitionVersions)
      .where(and(
        eq(certificateDefinitionVersions.tenantId, tenantId),
        eq(certificateDefinitionVersions.definitionId, definition.id),
        eq(certificateDefinitionVersions.status, 'active'),
      ))
      .orderBy(desc(certificateDefinitionVersions.versionNumber))
      .limit(1);
    if (!activeVersion) {
      throw new ApiError(400, 'NOT_PUBLISHED', 'La définition n\'a aucune version active (publiée).');
    }

    const pending = await db.select().from(certificateJobItems)
      .where(and(
        eq(certificateJobItems.tenantId, tenantId),
        eq(certificateJobItems.jobId, id),
        eq(certificateJobItems.status, 'pending'),
      ))
      .orderBy(asc(certificateJobItems.id))
      .limit(BATCH_LIMIT);

    if (pending.length === 0) {
      const isDone = jobRow.successCount + jobRow.errorCount >= jobRow.totalCount;
      return NextResponse.json({
        success: true,
        data: {
          processed: 0,
          job: { ...jobRow, status: isDone ? 'completed' : jobRow.status },
          message: isDone ? 'Lot déjà terminé.' : 'Aucun élément en attente.',
        },
      });
    }

    const recipientType = definition.allowedTargetType === 'employee' ? 'employee' : 'student';
    let success = 0;
    let failed = 0;
    const details: Array<{ recipientId: string; status: string; error?: string; serialNumber?: string }> = [];

    for (const item of pending) {
      try {
        const result = await issueCertificate({
          tenantId,
          definitionId: definition.id,
          definitionVersionId: activeVersion.id,
          recipientType,
          recipientId: item.recipientId,
          issuedBy: context.userId,
          ruleType: 'manual_authorized',
          ruleParams: { notes: 'Émission en lot' },
        });
        await db.update(certificateJobItems)
          .set({ status: 'success', issuedCertificateId: result.issuedCertificate.id, errorReason: null })
          .where(and(eq(certificateJobItems.tenantId, tenantId), eq(certificateJobItems.id, item.id)));
        success++;
        details.push({ recipientId: item.recipientId, status: 'success', serialNumber: result.issuedCertificate.serialNumber });
      } catch (error: any) {
        const message = error?.message || 'Erreur inconnue';
        await db.update(certificateJobItems)
          .set({ status: 'failed', errorReason: message })
          .where(and(eq(certificateJobItems.tenantId, tenantId), eq(certificateJobItems.id, item.id)));
        failed++;
        details.push({ recipientId: item.recipientId, status: 'failed', error: message });
      }
    }

    const [updatedJob] = await db.update(certificateJobs)
      .set({
        successCount: jobRow.successCount + success,
        errorCount: jobRow.errorCount + failed,
        status: jobRow.successCount + success + jobRow.errorCount + failed >= jobRow.totalCount ? 'completed' : 'processing',
      })
      .where(and(eq(certificateJobs.tenantId, tenantId), eq(certificateJobs.id, id)))
      .returning();

    recordAudit(context, 'update', 'certificate_job', id, { processed: pending.length, success, failed });

    return NextResponse.json({
      success: true,
      data: {
        processed: pending.length,
        success,
        failed,
        details,
        job: updatedJob,
      },
      message: `${success} certificat(s) émis, ${failed} échec(s).`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
