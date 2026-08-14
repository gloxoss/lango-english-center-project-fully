import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { findDuplicateCandidates, getInquiry } from '@/features/crm/services/inquiries-service';

// GET /api/crm/inquiries/[id]/duplicates
// Returns other tenant-scoped inquiries matching the same phone/email,
// so the UI can offer a safe merge.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(request);
    await requireCapability(ctx, 'crm.manage');
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'lead-crm');

    const { id } = await params;
    const inquiry = await getInquiry(tenantId, id);
    const data = await findDuplicateCandidates(tenantId, {
      phone: inquiry.phone,
      email: inquiry.email,
      excludeId: id,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
