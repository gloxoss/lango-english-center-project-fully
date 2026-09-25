import { Buffer } from 'node:buffer';
import { NextResponse } from 'next/server';
import { parseAndImportMassarMarks } from '@/features/academics/services/massar-sync-service';
import { writableStudentIds } from '@/features/assessment/services/marksheet-access';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';

// A Massar marks sheet for one class is a few dozen KB. The cap keeps a huge
// or crafted workbook from being parsed in memory on the shared VPS.
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(ctx);
    // Had no capability check at all; same gate as grade entry.
    await requireCapability(ctx, 'grading.manage');

    const formData = await request.formData();
    const assessmentDefId = formData.get('assessmentDefId');
    const file = formData.get('file');

    if (typeof assessmentDefId !== 'string' || !assessmentDefId) {
      throw new ApiError(400, 'BAD_REQUEST', 'assessmentDefId requis.');
    }

    if (!(file instanceof File)) {
      throw new ApiError(400, 'BAD_REQUEST', 'Fichier Excel Massar requis.');
    }
    if (file.size > MAX_BYTES) {
      throw new ApiError(413, 'FILE_TOO_LARGE', 'Fichier trop volumineux (5 Mo maximum).');
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // null for school_admin (no restriction); for a teacher, only the students
    // of the sections they teach for this assessment.
    const writable = await writableStudentIds(ctx, tenantId, assessmentDefId);

    const result = await parseAndImportMassarMarks(tenantId, assessmentDefId, buffer, {
      markerId: ctx.userId,
      writableStudentIds: writable,
    });

    recordAudit(ctx, 'update', 'massar_marks_import', assessmentDefId, { imported: result.importedCount, errors: result.errorCount });

    return NextResponse.json({
      success: true,
      data: result,
      message: `${result.importedCount} note(s) importée(s) avec succès.${result.errorCount > 0 ? ` (${result.errorCount} avertissement(s))` : ''}`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
