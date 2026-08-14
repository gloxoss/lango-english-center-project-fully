import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { convertInquiryToApplicant } from '@/features/crm/services/inquiries-service';

const convertInquirySchema = z.object({
  inquiryId: z.string().uuid(),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'receptionist']);
    requireTenant(context);
    await requireCapability(context, 'admissions.manage');
    const body = await parseJson(request, convertInquirySchema);

    const result = await convertInquiryToApplicant(context, body.inquiryId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
