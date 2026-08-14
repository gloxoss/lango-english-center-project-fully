import { and, count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { db } from '@/libs/DB';
import {
  documentGenerationItems,
  documentGenerationJobs,
  documentTemplates,
  documentTemplateVersions,
  issuedDocuments,
} from '@/features/cards/models/cards-schema';
import { issueDocument, resolveSubjectData } from '@/features/cards/services/issue-service';

const BATCH_SIZE = 50;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'card-management');
    await requireCapability(context, 'cards.issue');

    const [job] = await db.select().from(documentGenerationJobs)
      .where(and(eq(documentGenerationJobs.tenantId, tenantId), eq(documentGenerationJobs.id, id)))
      .limit(1);
    if (!job) throw new ApiError(404, 'NOT_FOUND', 'Lot introuvable.');
    if (job.status === 'completed' || job.status === 'cancelled') {
      return NextResponse.json({ success: true, data: { job, processedCount: 0 }, message: 'Lot déjà terminé ou annulé.' });
    }

    const [version] = await db.select().from(documentTemplateVersions)
      .where(and(
        eq(documentTemplateVersions.tenantId, tenantId),
        eq(documentTemplateVersions.id, job.templateVersionId),
      ))
      .limit(1);
    if (!version || !version.publishedById) {
      throw new ApiError(400, 'NOT_PUBLISHED', 'La version de modèle du lot n\'est plus publiée.');
    }
    const [template] = await db.select().from(documentTemplates)
      .where(and(eq(documentTemplates.tenantId, tenantId), eq(documentTemplates.id, version.templateId)))
      .limit(1);
    if (!template) throw new ApiError(404, 'NOT_FOUND', 'Modèle introuvable.');

    const items = await db.select().from(documentGenerationItems)
      .where(and(
        eq(documentGenerationItems.tenantId, tenantId),
        eq(documentGenerationItems.jobId, job.id),
        eq(documentGenerationItems.status, 'pending'),
      ))
      .limit(BATCH_SIZE);

    if (items.length === 0) {
      const finalStatus = finalJobStatus(job.successCount, job.errorCount);
      await db.update(documentGenerationJobs)
        .set({ status: finalStatus, completedAt: finalStatus === 'completed' || finalStatus === 'partially_completed' || finalStatus === 'failed' ? new Date().toISOString() : job.completedAt })
        .where(eq(documentGenerationJobs.id, job.id));
      return NextResponse.json({ success: true, data: { job: { ...job, status: finalStatus }, processedCount: 0 } });
    }

    await db.update(documentGenerationJobs)
      .set({ status: 'processing', startedAt: job.startedAt ?? new Date().toISOString() })
      .where(eq(documentGenerationJobs.id, job.id));

    let successDelta = 0;
    let errorDelta = 0;

    for (const item of items) {
      try {
        const { subjectId: resolvedSubjectId } = await resolveSubjectData(tenantId, item.subjectType, item.subjectId);

        // Idempotency guard: a retry (after a crash mid-batch) must not mint a
        // second active card for the same subject. Reuses an existing active
        // document if one was already issued for this subject+type.
        const [existing] = await db.select({ id: issuedDocuments.id }).from(issuedDocuments)
          .where(and(
            eq(issuedDocuments.tenantId, tenantId),
            eq(issuedDocuments.type, job.type),
            eq(issuedDocuments.subjectType, item.subjectType),
            eq(issuedDocuments.subjectId, resolvedSubjectId),
            eq(issuedDocuments.status, 'active'),
          ))
          .limit(1);

        if (existing) {
          await db.update(documentGenerationItems)
            .set({ status: 'success', issuedDocumentId: existing.id })
            .where(eq(documentGenerationItems.id, item.id));
          successDelta += 1;
          continue;
        }

        const result = await issueDocument({
          tenantId,
          templateVersionId: job.templateVersionId,
          subjectType: item.subjectType,
          subjectId: item.subjectId,
          issuedBy: context.userId,
        });

        await db.update(documentGenerationItems)
          .set({ status: 'success', issuedDocumentId: result.issuedDocument.id })
          .where(eq(documentGenerationItems.id, item.id));
        successDelta += 1;
      } catch (error: any) {
        await db.update(documentGenerationItems)
          .set({
            status: 'failed',
            errorCode: 'ISSUE_ERROR',
            errorMessage: error?.message ? String(error.message).slice(0, 500) : 'Erreur inconnue',
          })
          .where(eq(documentGenerationItems.id, item.id));
        errorDelta += 1;
      }
    }

    const newSuccess = job.successCount + successDelta;
    const newError = job.errorCount + errorDelta;

    const [pendingRow] = await db.select({ value: count() }).from(documentGenerationItems)
      .where(and(
        eq(documentGenerationItems.tenantId, tenantId),
        eq(documentGenerationItems.jobId, job.id),
        eq(documentGenerationItems.status, 'pending'),
      ));
    const pendingLeft = pendingRow?.value ?? 0;

    const finalStatus = pendingLeft === 0
      ? finalJobStatus(newSuccess, newError)
      : 'processing';

    const [updatedJob] = await db.update(documentGenerationJobs)
      .set({
        successCount: newSuccess,
        errorCount: newError,
        status: finalStatus,
        completedAt: pendingLeft === 0 ? new Date().toISOString() : job.completedAt,
      })
      .where(eq(documentGenerationJobs.id, job.id))
      .returning();

    recordAudit(context, 'update', 'document_generation_job', job.id, {
      processedCount: items.length,
      status: finalStatus,
    });

    return NextResponse.json({
      success: true,
      data: { job: updatedJob, processedCount: items.length },
      message: items.length === 0 ? 'Rien à traiter' : `${successDelta} traité(s) avec succès, ${errorDelta} en erreur`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

function finalJobStatus(success: number, error: number): 'completed' | 'partially_completed' | 'failed' {
  if (success > 0 && error > 0) return 'partially_completed';
  if (error > 0) return 'failed';
  return 'completed';
}
