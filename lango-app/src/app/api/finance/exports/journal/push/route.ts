import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { getAccountingExportAdapter } from '@/libs/finance/export/accounting-export-adapter';
import { buildStudentJournal } from '@/libs/finance/export/journal-extract';

const pushSchema = z.object({
  target: z.string().trim().min(1).max(50),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict();

// POST /api/finance/exports/journal/push — push the journal to an ERP target.
// CSV/XLSX return a file result; DAMANCOM/Sage return a clear NOT_IMPLEMENTED
// until each target's spec is confirmed.
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'accounting.export');
    const body = await parseJson(request, pushSchema);

    const adapter = getAccountingExportAdapter(body.target);
    if (!adapter) {
      return NextResponse.json({ success: false, message: `Cible « ${body.target} » inconnue.` }, { status: 400 });
    }

    const rows = await buildStudentJournal(tenantId, { from: body.from, to: body.to });
    const result = await adapter.exportJournal(tenantId, rows);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
