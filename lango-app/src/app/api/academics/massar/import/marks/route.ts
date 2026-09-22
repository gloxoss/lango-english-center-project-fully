import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseAndImportMassarMarks } from '@/features/academics/services/massar-sync-service';

export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(ctx);

    const formData = await request.formData();
    const assessmentDefId = formData.get('assessmentDefId');
    const file = formData.get('file');

    if (typeof assessmentDefId !== 'string' || !assessmentDefId) {
      return NextResponse.json({ success: false, message: 'assessmentDefId requis.' }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: 'Fichier Excel Massar requis.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await parseAndImportMassarMarks(tenantId, assessmentDefId, buffer);

    return NextResponse.json({
      success: true,
      data: result,
      message: `${result.importedCount} note(s) importée(s) avec succès.${result.errorCount > 0 ? ` (${result.errorCount} avertissement(s))` : ''}`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
