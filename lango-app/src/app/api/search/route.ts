import { and, eq, ilike, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { hasCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { invoices, user } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();

    if (!query || query.length < 2) {
      return NextResponse.json({
        success: true,
        data: {
          students: [],
          teachers: [],
          invoices: [],
        },
      });
    }

    // Role & Capability Gating (D-12 Broken Access Control Remediation)
    // Only return categories for which the caller possesses active read permissions.
    const [canReadStudents, canReadTeachers, canReadFinance] = await Promise.all([
      hasCapability(context.userId, tenantId, context.role, 'students.read'),
      hasCapability(context.userId, tenantId, context.role, 'teachers.read'),
      hasCapability(context.userId, tenantId, context.role, 'finance.read'),
    ]);

    // If caller has none of these capabilities (e.g. student, parent, guard, alumni),
    // return an empty payload rather than 403 to prevent breaking client-side searchbars.
    if (!canReadStudents && !canReadTeachers && !canReadFinance) {
      return NextResponse.json({
        success: true,
        data: {
          students: [],
          teachers: [],
          invoices: [],
        },
      });
    }

    const searchPattern = `%${query}%`;

    // Search students (only if caller has students.read)
    const students = canReadStudents
      ? await db
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            matricule: user.matricule,
          })
          .from(user)
          .where(
            and(
              eq(user.tenantId, tenantId),
              eq(user.role, 'student'),
              or(
                ilike(user.name, searchPattern),
                ilike(user.email, searchPattern),
                ilike(user.matricule, searchPattern),
              ),
            ),
          )
          .limit(5)
      : [];

    // Search teachers (only if caller has teachers.read)
    const teachers = canReadTeachers
      ? await db
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            matricule: user.matricule,
          })
          .from(user)
          .where(
            and(
              eq(user.tenantId, tenantId),
              eq(user.role, 'teacher'),
              or(
                ilike(user.name, searchPattern),
                ilike(user.email, searchPattern),
                ilike(user.matricule, searchPattern),
              ),
            ),
          )
          .limit(5)
      : [];

    // Search invoices (only if caller has finance.read)
    const foundInvoices = canReadFinance
      ? await db
          .select({
            id: invoices.id,
            invoiceNumber: invoices.invoiceNumber,
            netAmount: invoices.netAmount,
            status: invoices.status,
          })
          .from(invoices)
          .where(
            and(
              eq(invoices.tenantId, tenantId),
              ilike(invoices.invoiceNumber, searchPattern),
            ),
          )
          .limit(5)
      : [];

    return NextResponse.json({
      success: true,
      data: {
        students,
        teachers,
        invoices: foundInvoices,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
