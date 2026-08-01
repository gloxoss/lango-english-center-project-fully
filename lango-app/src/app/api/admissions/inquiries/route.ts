import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { inquiries } from '@/models/Schema';

const createInquirySchema = z.object({
  contactName: z.string().trim().min(1).max(255),
  phone: z.string().trim().optional(),
  email: z.string().email().optional().or(z.literal('')),
  source: z.enum(['walk_in', 'phone', 'web', 'referral']).default('walk_in'),
  interestLevel: z.enum(['low', 'medium', 'high']).default('medium'),
  notes: z.string().trim().optional(),
  assignedToId: z.string().optional(),
}).strict();

const updateInquirySchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['new', 'contacted', 'qualified', 'converted', 'lost']).optional(),
  interestLevel: z.enum(['low', 'medium', 'high']).optional(),
  assignedToId: z.string().nullable().optional(),
  notes: z.string().trim().optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const assignedToId = searchParams.get('assignedToId');

    const conditions = [eq(inquiries.tenantId, tenantId)];
    if (status) {
      conditions.push(eq(inquiries.status, status as any));
    }
    if (assignedToId) {
      conditions.push(eq(inquiries.assignedToId, assignedToId));
    }

    const items = await db
      .select()
      .from(inquiries)
      .where(and(...conditions))
      .orderBy(desc(inquiries.createdAt));

    return NextResponse.json({
      success: true,
      data: items,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, createInquirySchema);

    const [newInquiry] = await db
      .insert(inquiries)
      .values({
        tenantId,
        contactName: body.contactName,
        phone: body.phone || null,
        email: body.email || null,
        source: body.source,
        interestLevel: body.interestLevel,
        assignedToId: body.assignedToId || null,
        notes: body.notes || null,
        status: 'new',
      })
      .returning();

    if (newInquiry) {
      await recordAudit(context, 'create', 'inquiry', newInquiry.id);
    }

    return NextResponse.json({
      success: true,
      data: newInquiry,
    }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, updateInquirySchema);

    const [existing] = await db
      .select({ id: inquiries.id })
      .from(inquiries)
      .where(and(eq(inquiries.id, body.id), eq(inquiries.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Prospect introuvable.');
    }

    const [updated] = await db
      .update(inquiries)
      .set({
        ...(body.status ? { status: body.status } : {}),
        ...(body.interestLevel ? { interestLevel: body.interestLevel } : {}),
        ...(body.assignedToId !== undefined ? { assignedToId: body.assignedToId } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(inquiries.id, body.id), eq(inquiries.tenantId, tenantId)))
      .returning();

    await recordAudit(context, 'update', 'inquiry', body.id);

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
