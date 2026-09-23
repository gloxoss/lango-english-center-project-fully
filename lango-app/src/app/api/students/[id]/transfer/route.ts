import { NextResponse } from 'next/server';
import { z } from 'zod';
import { executeStudentTransfer } from '@/features/students/services/transfer-service';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';

const transferSchema = z.object({
  branchId: z.string().uuid(),
  classSectionId: z.string().uuid().nullable().optional(),
  reason: z.string().trim().max(500).optional(),
  effectiveDate: z.string().optional(),
  notifyGuardian: z.boolean().optional(),
  generateCertificate: z.boolean().optional(),
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'students.update');
    const { id: studentId } = await params;
    const body = await parseJson(request, transferSchema);

    const result = await executeStudentTransfer({
      tenantId,
      studentId,
      targetBranchId: body.branchId,
      targetClassSectionId: body.classSectionId,
      reason: body.reason,
      effectiveDate: body.effectiveDate,
      actor: {
        userId: context.userId,
        branchId: context.branchId,
        role: context.role,
        name: context.name,
      },
      notifyGuardian: body.notifyGuardian,
      generateCertificate: body.generateCertificate,
    });

    return NextResponse.json({
      success: true,
      data: result,
      warnings: result.warnings,
      message: result.message,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
