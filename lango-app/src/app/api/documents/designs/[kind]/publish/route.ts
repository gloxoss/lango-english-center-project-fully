import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { documentKindSchema } from '@/features/documents/contracts';
import { publishDraft } from '@/features/documents/services/designs';

export async function POST(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.organization.manage');
    const kind = documentKindSchema.parse((await params).kind);
    const version = await publishDraft(tenantId, kind, context.userId);
    if (!version) throw new ApiError(404, 'NOT_FOUND', 'Brouillon introuvable.');
    recordAudit(context, 'settings_change', 'document_design', kind, { status: 'published', versionNumber: version.versionNumber });
    return NextResponse.json({ success: true, data: { versionId: version.id, versionNumber: version.versionNumber } });
  } catch (error) { return apiErrorResponse(error); }
}
