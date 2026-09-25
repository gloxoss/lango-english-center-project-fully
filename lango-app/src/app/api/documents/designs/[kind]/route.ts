import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { documentDesignSchema, documentKindSchema } from '@/features/documents/contracts';
import { resolveDesign, saveDraft } from '@/features/documents/services/designs';

type Params = { params: Promise<{ kind: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.organization.manage');
    const kind = documentKindSchema.parse((await params).kind);
    const [published, draft] = await Promise.all([resolveDesign(tenantId, kind), resolveDesign(tenantId, kind, true)]);
    return NextResponse.json({ success: true, data: { published, draft } });
  } catch (error) { return apiErrorResponse(error); }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.organization.manage');
    const kind = documentKindSchema.parse((await params).kind);
    const design = await parseJson(request, documentDesignSchema);
    await saveDraft(tenantId, kind, context.userId, design);
    recordAudit(context, 'settings_change', 'document_design', kind, { status: 'draft' });
    return NextResponse.json({ success: true });
  } catch (error) { return apiErrorResponse(error); }
}
