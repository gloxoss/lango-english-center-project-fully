import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { requireLibraryContext } from '@/features/library/api/guard';
import { createLoanPolicy, listPolicies } from '@/features/library/services/library-operations-service';

const schema = z.object({
  name: z.string().trim().min(1).max(255),
  patronCategory: z.string().trim().min(1).max(50),
  branchId: z.uuid().nullable().optional(),
  maxLoans: z.number().int().min(0).max(999).optional(),
  loanDurationDays: z.number().int().min(0).max(3650).optional(),
  renewalLimit: z.number().int().min(0).max(999).optional(),
  renewalDurationDays: z.number().int().min(0).max(3650).optional(),
  finePerDay: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  gracePeriodDays: z.number().int().min(0).max(3650).optional(),
  maxHolds: z.number().int().min(0).max(999).optional(),
}).strict();

export async function GET(r: Request) {
  try {
    const { tenantId } = await requireLibraryContext(r, 'library.policy.manage');
    return NextResponse.json({ success: true, data: await listPolicies(tenantId) });
  } catch (e) { return apiErrorResponse(e); }
}

export async function POST(r: Request) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.policy.manage');
    const b = await parseJson(r, schema);
    const data = await createLoanPolicy(tenantId, b);
    recordAudit(context, 'create', 'library_loan_policy', data.id, { name: data.name, patronCategory: data.patronCategory });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (e) { return apiErrorResponse(e); }
}
