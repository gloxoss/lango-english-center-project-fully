import { and, eq } from 'drizzle-orm';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { documentArtifacts } from '@/features/documents/models/document-schema';
import { loadFinanceDocument } from '@/features/documents/services/finance-loaders';
import { readIssuedPdf } from '@/features/documents/services/artifacts';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.read');
    const [artifact] = await db.select().from(documentArtifacts)
      .where(and(eq(documentArtifacts.id, (await params).id), eq(documentArtifacts.tenantId, tenantId))).limit(1);
    if (!artifact || (artifact.kind !== 'invoice' && artifact.kind !== 'receipt')) throw new ApiError(404, 'NOT_FOUND', 'Document introuvable.');
    await loadFinanceDocument(request, context, { kind: artifact.kind, sourceId: artifact.sourceId });
    const bytes = await readIssuedPdf(artifact.storageKey, artifact.sha256);
    recordAudit(context, 'export', 'document_artifact', artifact.id, { kind: artifact.kind });
    const disposition = new URL(request.url).searchParams.get('download') === '1' ? 'attachment' : 'inline';
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${artifact.filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) { return apiErrorResponse(error); }
}
