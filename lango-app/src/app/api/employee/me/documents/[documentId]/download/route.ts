import { and, eq, isNull, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { contentTypeFor, readUploadedFile } from '@/libs/api/uploads';
import { db } from '@/libs/DB';
import { employeeDocuments } from '@/models/Schema';
import { resolveEmployeeContext } from '@/features/hr/services/employee-context';

export async function GET(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  try {
    const ctx = await requireRequestContext(request); const tenantId = requireTenant(ctx);
    const employee = await resolveEmployeeContext(tenantId, ctx.userId, { allowRetainedReadOnly: true });
    const { documentId } = await params;
    const [doc] = await db.select().from(employeeDocuments).where(and(
      eq(employeeDocuments.id, documentId), eq(employeeDocuments.tenantId, tenantId), eq(employeeDocuments.employeeId, employee.id),
      isNull(employeeDocuments.archivedAt), ne(employeeDocuments.visibility, 'restricted'),
    )).limit(1);
    if (!doc) throw new ApiError(404, 'DOCUMENT_NOT_FOUND', 'Document introuvable.');
    const bytes = await readUploadedFile(tenantId, doc.storageKey);
    const ext = doc.storageKey.includes('.') ? doc.storageKey.split('.').pop()! : 'pdf';
    const safeName = doc.originalName.replace(/["\\\r\n]/g, '');
    recordAudit(ctx, 'export', 'employee_document', doc.id);
    return new NextResponse(new Uint8Array(bytes), { headers: {
      'Content-Type': contentTypeFor(ext), 'Content-Disposition': `attachment; filename="${safeName}"`, 'Cache-Control': 'private, no-store',
    } });
  } catch (error) { return apiErrorResponse(error); }
}
