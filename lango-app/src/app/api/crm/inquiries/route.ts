import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { parseJson } from '@/libs/api/validation';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import {
  createInquiry,
  getPipelineCounts,
  listInquiries,
  type InquiryListFilters,
  type InquirySource,
  type InquiryStatus,
} from '@/features/crm/services/inquiries-service';

const createSchema = z.object({
  contactName: z.string().trim().min(1).max(255),
  phone: z.string().trim().max(50).optional(),
  email: z.string().email().max(255).optional().or(z.literal('')),
  source: z.enum(['walk_in', 'phone', 'web', 'referral', 'facebook_ads', 'google_ads']).default('walk_in'),
  interestLevel: z.enum(['low', 'medium', 'high']).default('medium'),
  notes: z.string().trim().max(2000).optional(),
  assignedToId: z.string().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    await requireCapability(ctx, 'crm.manage');
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'lead-crm');

    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const status = searchParams.get('status') as InquiryStatus | null;
    const source = searchParams.get('source') as InquirySource | null;
    const assignedToId = searchParams.get('assignedToId');
    const tag = searchParams.get('tag');
    const q = searchParams.get('q');
    const sortBy = searchParams.get('sortBy');
    const sortDir = searchParams.get('sortDir');

    const filters: InquiryListFilters = {
      tenantId,
      limit: pagination.limit,
      offset: pagination.offset,
      ...(status ? { status } : {}),
      ...(source ? { source } : {}),
      ...(assignedToId ? { assignedToId } : {}),
      ...(tag ? { tag } : {}),
      ...(q ? { search: q } : {}),
      ...(sortBy === 'createdAt' || sortBy === 'updatedAt' || sortBy === 'contactName' || sortBy === 'interestLevel'
        ? { sortBy }
        : {}),
      ...(sortDir === 'asc' || sortDir === 'desc' ? { sortDir } : {}),
    };

    const [result, counts] = await Promise.all([
      listInquiries(filters),
      getPipelineCounts(tenantId),
    ]);

    return NextResponse.json({
      success: true,
      data: result.data,
      total: result.total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      counts,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    await requireCapability(ctx, 'crm.manage');
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'lead-crm');

    const body = await parseJson(request, createSchema);
    const inserted = await createInquiry(tenantId, {
      contactName: body.contactName,
      phone: body.phone || undefined,
      email: body.email || undefined,
      source: body.source as InquirySource,
      interestLevel: body.interestLevel,
      notes: body.notes,
      assignedToId: body.assignedToId,
      tags: body.tags,
    });

    recordAudit(ctx, 'create', 'inquiry', inserted.id, { source: body.source });
    return NextResponse.json({ success: true, data: inserted }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
