import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { requireLibraryContext } from '@/features/library/api/guard';
import { setRecordSubjects } from '@/features/library/services/library-catalog-service';

const schema = z.object({ subjectIds: z.array(z.uuid()).max(200) }).strict();

export async function PUT(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.catalog.manage');
    const { id } = await params;
    const b = await parseJson(r, schema);
    const data = await setRecordSubjects(tenantId, id, b.subjectIds);
    recordAudit(context, 'update', 'library_bibliographic_record', id, { action: 'set_subjects', count: data.length });
    return NextResponse.json({ success: true, data });
  } catch (e) { return apiErrorResponse(e); }
}
