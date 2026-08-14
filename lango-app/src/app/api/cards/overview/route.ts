import { and, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { db } from '@/libs/DB';
import {
  documentGenerationJobs,
  documentTemplates,
  issuedDocuments,
} from '@/features/cards/models/cards-schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'card-management');
    await requireCapability(context, 'cards.issue');

    const [templateRows, publishedRows] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(documentTemplates)
        .where(eq(documentTemplates.tenantId, tenantId)),
      db.select({ count: sql<number>`count(*)` }).from(documentTemplates)
        .where(and(eq(documentTemplates.tenantId, tenantId), eq(documentTemplates.status, 'published'))),
    ]);

    const issuedRows = await db.select({ status: issuedDocuments.status, count: sql<number>`count(*)` })
      .from(issuedDocuments)
      .where(eq(issuedDocuments.tenantId, tenantId))
      .groupBy(issuedDocuments.status);

    const issuedByStatus: Record<string, number> = {};
    for (const row of issuedRows) issuedByStatus[row.status] = Number(row.count);

    const jobsRows = await db.select({ status: documentGenerationJobs.status, count: sql<number>`count(*)` })
      .from(documentGenerationJobs)
      .where(eq(documentGenerationJobs.tenantId, tenantId))
      .groupBy(documentGenerationJobs.status);

    const jobsByStatus: Record<string, number> = {};
    for (const row of jobsRows) jobsByStatus[row.status] = Number(row.count);

    const recent = await db.select({
      id: issuedDocuments.id,
      type: issuedDocuments.type,
      subjectType: issuedDocuments.subjectType,
      subjectId: issuedDocuments.subjectId,
      status: issuedDocuments.status,
      issuedAt: issuedDocuments.issuedAt,
    })
      .from(issuedDocuments)
      .where(eq(issuedDocuments.tenantId, tenantId))
      .orderBy(desc(issuedDocuments.issuedAt))
      .limit(8);

    return NextResponse.json({
      success: true,
      data: {
        templates: { total: Number(templateRows[0]?.count ?? 0), published: Number(publishedRows[0]?.count ?? 0) },
        issued: issuedByStatus,
        issuedTotal: Object.values(issuedByStatus).reduce((a, b) => a + b, 0),
        jobs: jobsByStatus,
        recent,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
