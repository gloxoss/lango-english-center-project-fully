import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { classSections, feeStructureAssignments, feeStructures, invoices, user } from '@/models/Schema';

// GET /api/finance/fee-allocation?classId= — real per-student billing status
// for a class's assigned fee structure: an existing invoice if one was
// generated (real amount/discount/net/status), or "not_invoiced" if not.
// No billing-frequency field exists anywhere in the schema for fee
// structures - dropped rather than fabricated (same policy as the report
// card's dropped Coeff/Devoirs/Examen columns).
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');

    if (!classId) {
      return NextResponse.json({ success: false, message: 'classId requis.' }, { status: 400 });
    }

    const [assignment] = await db
      .select({ feeStructureId: feeStructureAssignments.feeStructureId, feeStructureName: feeStructures.name, baseAmount: feeStructures.amount })
      .from(feeStructureAssignments)
      .innerJoin(feeStructures, eq(feeStructureAssignments.feeStructureId, feeStructures.id))
      .where(and(eq(feeStructureAssignments.tenantId, tenantId), eq(feeStructureAssignments.classId, classId)))
      .limit(1);

    if (!assignment) {
      return NextResponse.json({ success: true, data: { feeStructure: null, students: [] } });
    }

    const sections = await db
      .select({ id: classSections.id })
      .from(classSections)
      .where(and(eq(classSections.tenantId, tenantId), eq(classSections.classId, classId)));
    const sectionIds = sections.map(s => s.id);

    const roster = sectionIds.length === 0
      ? []
      : await db
          .select({ id: user.id, name: user.name })
          .from(user)
          .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), inArray(user.classSectionId, sectionIds)));

    const students = await Promise.all(roster.map(async (s) => {
      const [invoice] = await db
        .select({ amount: invoices.amount, discountAmount: invoices.discountAmount, netAmount: invoices.netAmount, status: invoices.status })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.studentId, s.id), eq(invoices.feeStructureId, assignment.feeStructureId)))
        .limit(1);

      return {
        studentId: s.id,
        studentName: s.name,
        baseAmount: invoice ? Number(invoice.amount) : Number(assignment.baseAmount),
        discountAmount: invoice ? Number(invoice.discountAmount) : 0,
        netAmount: invoice ? Number(invoice.netAmount) : Number(assignment.baseAmount),
        status: invoice ? invoice.status : 'not_invoiced',
      };
    }));

    return NextResponse.json({
      success: true,
      data: { feeStructure: { id: assignment.feeStructureId, name: assignment.feeStructureName }, students },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
