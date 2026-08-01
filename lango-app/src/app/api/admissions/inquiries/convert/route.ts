import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { applicants, inquiries } from '@/models/Schema';

const convertInquirySchema = z.object({
  inquiryId: z.string().uuid(),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, convertInquirySchema);

    const [inquiry] = await db
      .select()
      .from(inquiries)
      .where(and(eq(inquiries.id, body.inquiryId), eq(inquiries.tenantId, tenantId)))
      .limit(1);

    if (!inquiry) {
      throw new ApiError(404, 'NOT_FOUND', 'Prospect introuvable.');
    }

    if (inquiry.status === 'converted' && inquiry.convertedApplicantId) {
      throw new ApiError(422, 'ALREADY_CONVERTED', 'Ce prospect a déjà été converti en candidat.');
    }

    // Split contactName into firstName / lastName
    const nameParts = inquiry.contactName.trim().split(/\s+/);
    const firstName = nameParts[0] || 'Candidat';
    const lastName = nameParts.slice(1).join(' ') || 'Prospect';

    // Insert new applicant
    const [newApplicant] = await db
      .insert(applicants)
      .values({
        tenantId,
        firstName,
        lastName,
        email: inquiry.email || `prospect-${inquiry.id.slice(0, 8)}@lango.local`,
        phone: inquiry.phone || '0600000000',
        status: 'applied',
      })
      .returning();

    // Update inquiry status
    await db
      .update(inquiries)
      .set({
        status: 'converted',
        convertedApplicantId: newApplicant?.id,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(inquiries.id, body.inquiryId), eq(inquiries.tenantId, tenantId)));

    await recordAudit(context, 'create', 'applicant_conversion', newApplicant!.id);

    return NextResponse.json({
      success: true,
      data: {
        inquiryId: inquiry.id,
        applicant: newApplicant,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
