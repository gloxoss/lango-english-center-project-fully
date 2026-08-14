import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { db } from '@/libs/DB';
import { issuedDocuments } from '@/features/cards/models/cards-schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'card-management');
    await requireCapability(context, 'cards.issue');

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');

    const conditions = [eq(issuedDocuments.tenantId, tenantId)];
    if (type) conditions.push(eq(issuedDocuments.type, type as any));
    if (status) conditions.push(eq(issuedDocuments.status, status as any));

    const rows = await db.select().from(issuedDocuments)
      .where(and(...conditions))
      .orderBy(desc(issuedDocuments.issuedAt));

    const data = rows.map(row => ({
      ...row,
      subjectName: (row.renderDataSnapshot as any)?.subjectName ?? '',
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
