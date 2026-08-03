import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { parseJson } from '@/libs/api/validation';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { inquiries } from '@/models/Schema';

const createSchema = z.object({
  contactName: z.string().trim().min(1).max(255),
  phone: z.string().trim().max(50).optional(),
  email: z.string().email().max(255).optional(),
  source: z.enum(['walk_in', 'phone', 'web', 'referral']).default('walk_in'),
  interestLevel: z.enum(['low', 'medium', 'high']).default('medium'),
  notes: z.string().trim().max(2000).optional(),
  assignedToId: z.string().optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    await requireCapability(ctx, 'crm.manage');
    const tenantId = requireTenant(ctx);
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const statusFilter = searchParams.get('status');
    const assignedToId = searchParams.get('assignedToId');

    const conditions = [eq(inquiries.tenantId, tenantId)];
    if (statusFilter) conditions.push(eq(inquiries.status, statusFilter as any));
    if (assignedToId) conditions.push(eq(inquiries.assignedToId, assignedToId));

    const rows = await db
      .select()
      .from(inquiries)
      .where(and(...conditions))
      .orderBy(desc(inquiries.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset);

    return NextResponse.json({ success: true, data: rows, total: rows.length, page: pagination.page, pageSize: pagination.pageSize });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    await requireCapability(ctx, 'crm.manage');
    const tenantId = requireTenant(ctx);
    const body = await parseJson(request, createSchema);

    const [inserted] = await db
      .insert(inquiries)
      .values({
        tenantId,
        contactName: body.contactName,
        phone: body.phone,
        email: body.email,
        source: body.source,
        interestLevel: body.interestLevel,
        notes: body.notes,
        assignedToId: body.assignedToId,
        status: 'new',
      })
      .returning();

    recordAudit(ctx, 'create', 'inquiry', inserted!.id);
    return NextResponse.json({ success: true, data: inserted }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
