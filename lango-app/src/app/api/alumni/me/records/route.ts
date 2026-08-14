import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { alumniDocuments } from '@/models/Schema';

// Real, self-scoped, active-only document list (future-implementation/alumni-portal).
export async function GET(req: Request) {
  try {
    const context = await requireRequestContext(req, ['alumni']);
    const tenantId = requireTenant(context);

    const rows = await db
      .select({
        id: alumniDocuments.id,
        documentType: alumniDocuments.documentType,
        verificationCode: alumniDocuments.verificationCode,
        issuedAt: alumniDocuments.issuedAt,
      })
      .from(alumniDocuments)
      .where(and(eq(alumniDocuments.alumnusId, context.userId), eq(alumniDocuments.status, 'active'), eq(alumniDocuments.tenantId, tenantId)))
      .orderBy(desc(alumniDocuments.issuedAt));

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
