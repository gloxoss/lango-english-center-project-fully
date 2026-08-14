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
import { user } from '@/models/Schema';
import {
  certificateDefinitions,
  certificateRequests,
} from '@/features/certificates/models/certificates-schema';

const createSchema = z.object({
  definitionId: z.uuid(),
  recipientId: z.string().trim().min(1).max(255),
  recipientType: z.enum(['student', 'employee']),
  notes: z.string().trim().max(2000).optional().default(''),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'certificate-management');
    await requireCapability(context, 'certificates.issue');

    const url = new URL(request.url);
    const status = url.searchParams.get('status');

    const rows = await db.select({
      id: certificateRequests.id,
      definitionId: certificateRequests.definitionId,
      requesterId: certificateRequests.requesterId,
      recipientId: certificateRequests.recipientId,
      status: certificateRequests.status,
      notes: certificateRequests.notes,
      createdAt: certificateRequests.createdAt,
      updatedAt: certificateRequests.updatedAt,
      definitionTitle: certificateDefinitions.title,
      requesterName: user.name,
    })
      .from(certificateRequests)
      .innerJoin(certificateDefinitions, and(
        eq(certificateDefinitions.id, certificateRequests.definitionId),
        eq(certificateDefinitions.tenantId, tenantId),
      ))
      .leftJoin(user, eq(user.id, certificateRequests.requesterId))
      .where(and(
        eq(certificateRequests.tenantId, tenantId),
        status ? eq(certificateRequests.status, status as never) : undefined,
      ))
      .orderBy(desc(certificateRequests.createdAt));

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

    const [definition] = await db.select().from(certificateDefinitions)
      .where(and(
        eq(certificateDefinitions.tenantId, tenantId),
        eq(certificateDefinitions.id, body.definitionId),
      ))
      .limit(1);
    if (!definition) {
      throw new ApiError(404, 'NOT_FOUND', 'Définition introuvable pour cet établissement.');
    }

    const [requestRow] = await db.insert(certificateRequests).values({
      tenantId,
      definitionId: definition.id,
      requesterId: context.userId,
      recipientId: body.recipientId,
      evidenceSnapshot: {
        type: 'manual_authorized',
        requestedBy: context.userId,
        recipientType: body.recipientType,
        notes: body.notes,
        createdAt: new Date().toISOString(),
      },
      status: 'draft',
      notes: body.notes,
    }).returning();

    recordAudit(context, 'create', 'certificate_request', requestRow!.id, {
      definitionId: definition.id,
      recipientId: body.recipientId,
    });

    return NextResponse.json({ success: true, data: requestRow }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
