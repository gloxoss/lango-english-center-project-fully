import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { importStatementLines } from '@/features/accounting/services/reconciliation-service';

const schema = z.object({
  filename: z.string().trim().min(1).max(255),
  content: z.string().min(1).max(1_000_000),
}).strict();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(req);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'accounting.reconcile');
    const [{ id }, body] = await Promise.all([params, parseJson(req, schema)]);
    const result = await importStatementLines({ tenantId, userId: ctx.userId }, id, body.filename, body.content);
    recordAudit(ctx, 'import', 'bank_reconciliation', id, { ...result });
    return NextResponse.json({ success: true, data: result }, { status: result.alreadyImported ? 200 : 201 });
  } catch (error) { return apiErrorResponse(error); }
}
