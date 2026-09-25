import type { RequestContext } from '@/libs/api/context';
import { ApiError } from '@/libs/api/errors';
import { findDocumentArtifact, readIssuedPdf, storeIssuedPdf } from './artifacts';
import { resolveDesign } from './designs';
import { loadFinanceDocument } from './finance-loaders';
import { renderSchoolPdf } from './pdf-renderer';

export async function ensureFinanceArtifact(request: Request, context: RequestContext, kind: 'invoice' | 'receipt', sourceId: string, origin: 'issued' | 'reconstruction' = 'issued') {
  const tenantId = context.tenantId;
  if (!tenantId) throw new ApiError(403, 'TENANT_REQUIRED', 'Établissement requis.');
  const existing = await findDocumentArtifact(tenantId, kind, sourceId);
  if (existing) return existing;
  const model = await loadFinanceDocument(request, context, { kind, sourceId }, true);
  if (kind === 'invoice' && model.status === 'draft') throw new ApiError(409, 'DRAFT_DOCUMENT', 'Une facture brouillon ne peut pas être archivée.');
  const { design, versionId } = await resolveDesign(tenantId, kind);
  const bytes = await renderSchoolPdf(model, design);
  return storeIssuedPdf({ tenantId, kind, sourceId, filename: model.filename, bytes, designVersionId: versionId, actorId: context.userId, archiveOrigin: origin });
}

export async function issuedFinancePdf(request: Request, context: RequestContext, kind: 'invoice' | 'receipt', sourceId: string) {
  const artifact = await ensureFinanceArtifact(request, context, kind, sourceId, 'reconstruction');
  if (!artifact) throw new ApiError(500, 'DOCUMENT_STORAGE_FAILED', 'PDF indisponible.');
  return { artifact, bytes: await readIssuedPdf(artifact.storageKey, artifact.sha256) };
}
