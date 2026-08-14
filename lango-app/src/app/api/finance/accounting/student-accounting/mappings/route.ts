import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { listSourceMappings, upsertSourceMapping } from '@/features/accounting/services/student-accounting-adapter';

const upsertSchema = z.object({
  sourceModule: z.string().trim().min(1).max(50),
  sourceKeyType: z.enum(['fee_category', 'payment_method', 'student']),
  sourceKey: z.string().trim().min(1).max(100).nullable().optional(),
  accountId: z.string().uuid(),
}).strict();

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'accounting.account.read');
    const sourceModule = new URL(req.url).searchParams.get('sourceModule') ?? undefined;
    const data = await listSourceMappings({ tenantId, userId: ctx.userId }, sourceModule);
    return NextResponse.json({ success: true, data });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'accounting.account.manage');
    const body = await parseJson(req, upsertSchema);
    const row = await upsertSourceMapping({ tenantId, userId: ctx.userId }, {
      sourceModule: body.sourceModule,
      sourceKeyType: body.sourceKeyType,
      sourceKey: body.sourceKey ?? null,
      accountId: body.accountId,
    });
    recordAudit(ctx, 'create', 'accounting_source_mapping', row.id, {
      sourceModule: row.sourceModule,
      sourceKeyType: row.sourceKeyType,
      sourceKey: row.sourceKey,
      accountId: row.accountId,
    });
    return NextResponse.json({ success: true, data: row });
  } catch (error) { return apiErrorResponse(error); }
}
