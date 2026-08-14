import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { invoices } from '@/models/Schema';
import { requireParentContext } from '@/features/parent/api/guard';
import { resolveEffectiveChildren } from '@/features/parent/services/relationship-resolver';

export async function GET(request: Request) {
  try {
    const context = await requireParentContext(request);
    const tenantId = context.tenantId as string;
    // Household roll-up: only children with the finance right AND financial
    // responsibility — a non-responsible child is never another guardian's
    // private data leak nor folded into a sibling's balance.
    const children = (await resolveEffectiveChildren(tenantId, context.userId)).filter(
      child => child.rights.finance && child.isFinanciallyResponsible,
    );
    if (children.length === 0) return NextResponse.json({ success: true, data: { children: [], totalOutstanding: 0 } });

    const rows = await db.select({ studentId: invoices.studentId, netAmount: invoices.netAmount, paidAmount: invoices.paidAmount, status: invoices.status })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), inArray(invoices.studentId, children.map(child => child.studentId))));
    const outstandingFor = (studentId: string) => rows.filter(row => row.studentId === studentId)
      .reduce((total, row) => total + Math.max(0, Number(row.netAmount) - Number(row.paidAmount)), 0);
    const household = children.map(child => ({ relationshipId: child.relationshipId, studentId: child.studentId, name: child.name, outstanding: outstandingFor(child.studentId) }));

    return NextResponse.json({ success: true, data: { children: household, totalOutstanding: household.reduce((total, child) => total + child.outstanding, 0) } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
