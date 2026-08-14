import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { requireLibraryContext } from '@/features/library/api/guard';
import { deleteLoanPolicy, updateLoanPolicy } from '@/features/library/services/library-operations-service';

const schema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  branchId: z.uuid().nullable().optional(),
  maxLoans: z.number().int().min(0).max(999).optional(),
  loanDurationDays: z.number().int().min(0).max(3650).optional(),
  renewalLimit: z.number().int().min(0).max(999).optional(),
  renewalDurationDays: z.number().int().min(0).max(3650).optional(),
  finePerDay: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  gracePeriodDays: z.number().int().min(0).max(3650).optional(),
  maxHolds: z.number().int().min(0).max(999).optional(),
}).strict();

export async function PUT(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.policy.manage');
    const { id } = await params;
    const data = await updateLoanPolicy(tenantId, id, await parseJson(r, schema));
    recordAudit(context, 'update', 'library_loan_policy', id, { name: data.name });
    return NextResponse.json({ success: true, data });
  } catch (e) { return apiErrorResponse(e); }
}

export async function DELETE(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.policy.manage');
    const { id } = await params;
    const data = await deleteLoanPolicy(tenantId, id);
    recordAudit(context, 'delete', 'library_loan_policy', id, { name: data.name });
    return NextResponse.json({ success: true, data });
  } catch (e) { return apiErrorResponse(e); }
}
