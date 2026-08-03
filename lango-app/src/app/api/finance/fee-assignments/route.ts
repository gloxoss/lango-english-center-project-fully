import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { classes, feeStructureAssignments, feeStructures } from '@/models/Schema';

// Which fee structure a class owes - class-level assignment, not per-student
// overrides (matches what the mock UI showed - a rules table, not a roster).
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);

    const rows = await db
      .select({
        id: feeStructureAssignments.id,
        feeStructureId: feeStructureAssignments.feeStructureId,
        feeStructureName: feeStructures.name,
        feeAmount: feeStructures.amount,
        classId: feeStructureAssignments.classId,
        className: classes.name,
        effectiveDate: feeStructureAssignments.effectiveDate,
      })
      .from(feeStructureAssignments)
      .innerJoin(feeStructures, eq(feeStructureAssignments.feeStructureId, feeStructures.id))
      .innerJoin(classes, eq(feeStructureAssignments.classId, classes.id))
      .where(eq(feeStructureAssignments.tenantId, tenantId));

    return NextResponse.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

const createSchema = z.object({
  feeStructureId: z.uuid(),
  classId: z.uuid(),
  effectiveDate: z.string().optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.approve');
    const body = await parseJson(request, createSchema);

    const [feeStructure] = await db
      .select({ id: feeStructures.id })
      .from(feeStructures)
      .where(and(eq(feeStructures.id, body.feeStructureId), eq(feeStructures.tenantId, tenantId)))
      .limit(1);
    if (!feeStructure) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'La structure tarifaire indiquée n\'existe pas pour cet établissement.');
    }

    const [classRow] = await db
      .select({ id: classes.id })
      .from(classes)
      .where(and(eq(classes.id, body.classId), eq(classes.tenantId, tenantId)))
      .limit(1);
    if (!classRow) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'La classe indiquée n\'existe pas pour cet établissement.');
    }

    const [inserted] = await db
      .insert(feeStructureAssignments)
      .values({
        tenantId,
        feeStructureId: body.feeStructureId,
        classId: body.classId,
        effectiveDate: body.effectiveDate || new Date().toISOString().slice(0, 10),
      })
      .returning();

    recordAudit(context, 'create', 'fee_structure_assignment', inserted!.id);

    return NextResponse.json({ success: true, data: inserted, message: 'Structure tarifaire assignée à la classe.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.approve');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID non fourni' }, { status: 400 });
    }

    await db.delete(feeStructureAssignments).where(and(eq(feeStructureAssignments.id, id), eq(feeStructureAssignments.tenantId, tenantId)));
    recordAudit(context, 'delete', 'fee_structure_assignment', id);

    return NextResponse.json({ success: true, message: 'Assignation supprimée.', id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
