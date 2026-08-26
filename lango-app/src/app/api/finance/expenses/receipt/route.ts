import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { contentTypeFor, readUploadedFile, saveUploadedFile } from '@/libs/api/uploads';

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' };

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    const file = (await request.formData()).get('file');
    if (!(file instanceof File)) throw new ApiError(422, 'VALIDATION_ERROR', 'Justificatif requis.');
    const key = `finance/expense-receipts/${randomUUID()}.{ext}`;
    const ext = await saveUploadedFile(tenantId, key, file, TYPES, 8 * 1024 * 1024);
    const stored = key.replace('{ext}', ext);
    return NextResponse.json({ success: true, data: { url: `/api/finance/expenses/receipt?file=${encodeURIComponent(stored)}` } }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    const file = new URL(request.url).searchParams.get('file');
    if (!file || !file.startsWith('finance/expense-receipts/')) throw new ApiError(400, 'INVALID_PATH', 'Chemin invalide.');
    const bytes = await readUploadedFile(tenantId, file);
    return new NextResponse(new Uint8Array(bytes), { headers: { 'Content-Type': contentTypeFor(file.split('.').pop() || ''), 'Content-Disposition': 'inline' } });
  } catch (error) { return apiErrorResponse(error); }
}
