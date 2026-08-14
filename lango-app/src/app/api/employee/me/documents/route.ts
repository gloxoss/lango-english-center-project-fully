import { and, desc, eq, isNull, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { employeeDocuments } from '@/models/Schema';
import { resolveEmployeeContext } from '@/features/hr/services/employee-context';

// GET /api/employee/me/documents — Employee's own visible HR documents
export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    const employee = await resolveEmployeeContext(tenantId, ctx.userId, { allowRetainedReadOnly: true });

    const rows = await db
      .select({
        id: employeeDocuments.id,
        documentType: employeeDocuments.documentType,
        originalName: employeeDocuments.originalName,
        mimeType: employeeDocuments.mimeType,
        fileSize: employeeDocuments.fileSize,
        issuedAt: employeeDocuments.issuedAt,
        expiryDate: employeeDocuments.expiryDate,
        visibility: employeeDocuments.visibility,
        createdAt: employeeDocuments.createdAt,
      })
      .from(employeeDocuments)
      .where(and(
        eq(employeeDocuments.tenantId, tenantId),
        eq(employeeDocuments.employeeId, employee.id),
        isNull(employeeDocuments.archivedAt),
        ne(employeeDocuments.visibility, 'restricted'),
      ))
      .orderBy(desc(employeeDocuments.createdAt));

    return NextResponse.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
