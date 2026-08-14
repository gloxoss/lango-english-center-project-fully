import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { createIssue, listIssues } from '@/features/inventory/services/issues-service';

const issueLineSchema = z.object({
  productId: z.string().uuid(),
  qty: z.string().trim().min(1).max(20),
}).strict();

const issueCreateSchema = z.object({
  storeId: z.string().uuid(),
  issueToRole: z.enum(['student', 'staff', 'guest']),
  studentId: z.string().trim().min(1).nullable().optional(),
  issueToName: z.string().trim().max(255).nullable().optional(),
  issueDate: z.iso.date(),
  dueDate: z.iso.date(),
  lines: z.array(issueLineSchema).min(1).max(100),
  idempotencyKey: z.string().trim().max(80).nullable().optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'inventory');
    await requireCapability(context, 'inventory.read');

    const url = new URL(request.url);
    const data = await listIssues(tenantId, {
      storeId: url.searchParams.get('storeId'),
      status: url.searchParams.get('status'),
      issueToRole: url.searchParams.get('issueToRole'),
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'inventory');
    await requireCapability(context, 'inventory.issue.manage');

    const body = await parseJson(request, issueCreateSchema);
    const data = await createIssue(context, tenantId, body);

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
