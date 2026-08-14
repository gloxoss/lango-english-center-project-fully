import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { checkRateLimit } from '@/libs/api/rate-limit';
import { parsePagination } from '@/libs/api/pagination';
import { parseJson } from '@/libs/api/validation';
import { receptionInquiryCreateSchema } from '@/features/reception/models/reception-validation';
import {
  createInquiry,
  findDuplicateCandidates,
  listInquiries,
} from '@/features/crm/services/inquiries-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['receptionist', 'school_admin', 'super_admin']);
    requireTenant(context);
    await requireCapability(context, 'reception.inquiry.manage');
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const data = await listInquiries({
      tenantId: context.tenantId!,
      search: searchParams.get('q') ?? undefined,
      status: (searchParams.get('status') as any) ?? undefined,
      source: (searchParams.get('source') as any) ?? undefined,
      sortBy: (searchParams.get('sortBy') as any) ?? 'createdAt',
      sortDir: (searchParams.get('sortDir') as any) ?? 'desc',
      limit: pagination.limit,
      offset: pagination.offset,
    });
    return NextResponse.json({ success: true, data: data.data, total: data.total });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['receptionist', 'school_admin', 'super_admin']);
    requireTenant(context);
    await requireCapability(context, 'reception.inquiry.create');
    // Duplicate-intake resistance: a retry of the same walk-in must never
    // create a second inquiry. Tight window protects the shared queue.
    checkRateLimit(`reception:inquiry:${context.userId}`, 10, 60 * 1000);

    const body = await parseJson(request, receptionInquiryCreateSchema);

    // Dedup before create: same phone or email in this tenant (excluding
    // already-lost prospects) → 409 with candidates so the UI routes to the
    // existing record instead of duplicating it.
    const candidates = await findDuplicateCandidates(context.tenantId!, {
      phone: body.phone ?? null,
      email: body.email ?? null,
    });
    const liveDuplicates = candidates.filter((c) => c.status !== 'lost');
    if (liveDuplicates.length > 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'DUPLICATE_INQUIRY',
          message: 'Une fiche identique existe déjà pour ce contact.',
          candidates: liveDuplicates.map((c) => ({ id: c.id, contactName: c.contactName, phone: c.phone, email: c.email, status: c.status })),
        },
      }, { status: 409 });
    }

    const inquiry = await createInquiry(context.tenantId!, {
      contactName: body.contactName,
      phone: body.phone ?? undefined,
      email: body.email ?? undefined,
      source: body.source,
      interestLevel: body.interestLevel,
      notes: body.notes ?? undefined,
      assignedToId: body.assignedToId ?? undefined,
      tags: ['reception'],
    });
    return NextResponse.json({ success: true, data: inquiry }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
