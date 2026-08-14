import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import {
  deleteInquiry,
  getInquiry,
  updateInquiry,
  type InquiryInterestLevel,
  type InquirySource,
  type InquiryStatus,
} from '@/features/crm/services/inquiries-service';

const patchSchema = z.object({
  status: z.enum(['new', 'contacted', 'qualified', 'converted', 'lost']).optional(),
  contactName: z.string().trim().min(1).max(255).optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  email: z.string().email().max(255).nullable().optional().or(z.literal('')),
  source: z.enum(['walk_in', 'phone', 'web', 'referral', 'facebook_ads', 'google_ads']).optional(),
  interestLevel: z.enum(['low', 'medium', 'high']).optional(),
  assignedToId: z.string().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
}).strict();

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(request);
    await requireCapability(ctx, 'crm.manage');
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'lead-crm');

    const { id } = await params;
    const data = await getInquiry(tenantId, id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(request);
    await requireCapability(ctx, 'crm.manage');
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'lead-crm');

    const { id } = await params;
    const body = await parseJson(request, patchSchema);
    const updated = await updateInquiry(tenantId, id, {
      ...(body.status !== undefined && { status: body.status as InquiryStatus }),
      ...(body.contactName !== undefined && { contactName: body.contactName }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.email !== undefined && { email: body.email || null }),
      ...(body.source !== undefined && { source: body.source as InquirySource }),
      ...(body.interestLevel !== undefined && { interestLevel: body.interestLevel as InquiryInterestLevel }),
      ...(body.assignedToId !== undefined && { assignedToId: body.assignedToId }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.tags !== undefined && { tags: body.tags }),
    });

    recordAudit(ctx, 'update', 'inquiry', id, { status: body.status });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(request);
    await requireCapability(ctx, 'crm.manage');
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'lead-crm');

    const { id } = await params;
    await deleteInquiry(tenantId, id);
    recordAudit(ctx, 'delete', 'inquiry', id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
