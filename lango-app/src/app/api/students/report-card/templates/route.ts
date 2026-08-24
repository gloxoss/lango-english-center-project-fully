import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { documentTemplates } from '@/features/cards/models/cards-schema';

// GET /api/students/report-card/templates — report_card templates for this
// tenant (self-contained under grading, not gated on the card-management addon).
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');

    const templates = await db.select().from(documentTemplates)
      .where(eq(documentTemplates.tenantId, tenantId))
      .orderBy(desc(documentTemplates.createdAt));

    return NextResponse.json({ success: true, data: templates.filter(t => t.type === 'report_card') });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
