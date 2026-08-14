import { NextResponse } from 'next/server';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { recordAudit } from '@/libs/api/audit';
import { requireLibraryContext } from '@/features/library/api/guard';
import { importCopiesCsv, MAX_CSV_BYTES } from '@/features/library/services/library-copies-csv';

export async function POST(r: Request) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.copy.manage');
    const contentLength = Number(r.headers.get('content-length') || 0);
    if (contentLength > MAX_CSV_BYTES) throw new ApiError(413, 'CSV_TOO_LARGE', `Fichier trop volumineux (max ${Math.round(MAX_CSV_BYTES / 1024)} Ko).`);
    const form = await r.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new ApiError(422, 'VALIDATION_ERROR', 'Fichier requis.');
    if (file.size > MAX_CSV_BYTES) throw new ApiError(413, 'CSV_TOO_LARGE', `Fichier trop volumineux (max ${Math.round(MAX_CSV_BYTES / 1024)} Ko).`);
    const dryRun = form.get('dryRun') === 'true' || form.get('dryRun') === '1';

    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
    } catch {
      throw new ApiError(422, 'INVALID_ENCODING', 'Le fichier doit être encodé en UTF-8.');
    }

    const data = await importCopiesCsv(tenantId, { text, dryRun });
    if (!dryRun) {
      recordAudit(context, 'import', 'library_copy_import', tenantId, {
        total: data.total, created: data.created, updated: data.updated, skipped: data.skipped, errors: data.errors,
      });
    }
    return NextResponse.json({ success: true, data });
  } catch (e) { return apiErrorResponse(e); }
}
