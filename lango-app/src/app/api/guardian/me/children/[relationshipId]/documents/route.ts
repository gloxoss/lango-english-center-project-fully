import { and, asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { studentDocuments } from '@/models/Schema';
import { requireParentContext } from '@/features/parent/api/guard';
import { requireRelationship } from '@/features/parent/services/relationship-resolver';

// Parent documents — the school documents held on the child (type + presence +
// date only; no file bytes are stored in these rows). Relationship-scoped
// (uniform 404 for a non-owned/non-effective child) and gated on the `medical`
// right so a guardian without medical/document access gets 403.
export async function GET(request: Request, { params }: { params: Promise<{ relationshipId: string }> }) {
  try {
    const ctx = await requireParentContext(request);
    const { relationshipId } = await params;
    const auth = await requireRelationship(ctx, relationshipId, { medical: true });

    const rows = await db
      .select({
        id: studentDocuments.id,
        documentType: studentDocuments.documentType,
        fileExt: studentDocuments.fileExt,
        uploadedAt: studentDocuments.uploadedAt,
      })
      .from(studentDocuments)
      .where(and(
        eq(studentDocuments.tenantId, ctx.tenantId as string),
        eq(studentDocuments.studentId, auth.studentId),
      ))
      .orderBy(asc(studentDocuments.uploadedAt));

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
