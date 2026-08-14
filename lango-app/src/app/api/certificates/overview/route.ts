import { and, count, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';
import {
  certificateDefinitions,
  certificateRequests,
  certificateSignatories,
  certificateTemplates,
  certificateJobs,
  issuedCertificates,
} from '@/features/certificates/models/certificates-schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'certificate-management');
    await requireCapability(context, 'certificates.issue');

    const [definitionRows, templateRows, signatoryRows, issuedRows, requestRows, jobRows] = await Promise.all([
      db.select({ id: certificateDefinitions.id }).from(certificateDefinitions).where(eq(certificateDefinitions.tenantId, tenantId)),
      db.select({ id: certificateTemplates.id }).from(certificateTemplates).where(eq(certificateTemplates.tenantId, tenantId)),
      db.select({ id: certificateSignatories.id }).from(certificateSignatories)
        .where(and(eq(certificateSignatories.tenantId, tenantId), eq(certificateSignatories.isActive, true))),
      db.select({ status: issuedCertificates.status, count: sql<number>`count(*)` }).from(issuedCertificates)
        .where(eq(issuedCertificates.tenantId, tenantId)).groupBy(issuedCertificates.status),
      db.select({ status: certificateRequests.status, count: sql<number>`count(*)` }).from(certificateRequests)
        .where(eq(certificateRequests.tenantId, tenantId)).groupBy(certificateRequests.status),
      db.select({ status: certificateJobs.status, count: sql<number>`count(*)` }).from(certificateJobs)
        .where(eq(certificateJobs.tenantId, tenantId)).groupBy(certificateJobs.status),
    ]);

    const issuedByStatus: Record<string, number> = {};
    for (const r of issuedRows) issuedByStatus[r.status] = Number(r.count);
    const requestsByStatus: Record<string, number> = {};
    for (const r of requestRows) requestsByStatus[r.status] = Number(r.count);
    const jobsByStatus: Record<string, number> = {};
    for (const r of jobRows) jobsByStatus[r.status] = Number(r.count);

    const recent = await db.select({
      id: issuedCertificates.id,
      serialNumber: issuedCertificates.serialNumber,
      definitionId: issuedCertificates.definitionId,
      status: issuedCertificates.status,
      issuedAt: issuedCertificates.issuedAt,
      recipientName: user.name,
      definitionTitle: certificateDefinitions.title,
    })
      .from(issuedCertificates)
      .innerJoin(certificateDefinitions, and(
        eq(certificateDefinitions.id, issuedCertificates.definitionId),
        eq(certificateDefinitions.tenantId, tenantId),
      ))
      .leftJoin(user, eq(user.id, issuedCertificates.recipientId))
      .where(eq(issuedCertificates.tenantId, tenantId))
      .orderBy(desc(issuedCertificates.issuedAt))
      .limit(8);

    const awaitingReview = (requestsByStatus.submitted ?? 0) + (requestsByStatus.under_review ?? 0);

    return NextResponse.json({
      success: true,
      data: {
        definitions: definitionRows.length,
        templates: templateRows.length,
        activeSignatories: signatoryRows.length,
        issuedByStatus,
        issuedTotal: Object.values(issuedByStatus).reduce((a, b) => a + b, 0),
        requestsByStatus,
        awaitingReview,
        jobsByStatus,
        recent,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
