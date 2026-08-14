import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { certificateSignatories } from '@/features/certificates/models/certificates-schema';

const createSchema = z.object({
  name: z.string().trim().min(1).max(255),
  title: z.string().trim().min(1).max(255),
  signatureImageId: z.string().trim().max(255).optional().default(''),
  isActive: z.boolean().optional().default(true),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'certificate-management');
    await requireCapability(context, 'certificates.issue');

    const rows = await db.select().from(certificateSignatories)
      .where(eq(certificateSignatories.tenantId, tenantId))
      .orderBy(desc(certificateSignatories.createdAt));

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

    const [signatory] = await db.insert(certificateSignatories).values({
      tenantId,
      name: body.name,
      title: body.title,
      signatureImageId: body.signatureImageId,
      isActive: body.isActive,
    }).returning();
    if (!signatory) {
      throw new ApiError(500, 'CREATE_FAILED', 'Erreur lors de la création du signataire.');
    }

    recordAudit(context, 'create', 'certificate_signatory', signatory.id, {
      name: signatory.name,
      title: signatory.title,
    });

    return NextResponse.json({ success: true, data: signatory }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
