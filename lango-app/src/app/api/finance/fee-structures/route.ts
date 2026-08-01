import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { feeStructureCreateSchema, feeStructureUpdateSchema, parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { feeStructures } from '@/models/Schema';

// ponytail: `feeStructures` has no link to a real class (its only FK,
// `programId`, points at the dead LMS `programs` table) - so this is a flat
// list of named pricing plans (amount + description), not "per-class fee
// structures" the way the old UI implied. Per-class assignment, itemized
// components (transport/cantine), discounts, and payment schedules have no
// real schema backing at all - see MIGRATION-NOTES.md.

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);

    const rows = await db
      .select()
      .from(feeStructures)
      .where(eq(feeStructures.tenantId, tenantId))
      .limit(pagination.limit)
      .offset(pagination.offset);

    return NextResponse.json({ success: true, data: rows, total: rows.length, page: pagination.page, pageSize: pagination.pageSize });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, feeStructureCreateSchema);

    const [inserted] = await db
      .insert(feeStructures)
      .values({
        tenantId,
        name: body.name,
        amount: body.amount,
        description: body.description,
        isActive: body.isActive ?? true,
      })
      .returning();

    recordAudit(context, 'create', 'fee_structure', inserted!.id);

    return NextResponse.json({ success: true, data: inserted, message: 'Structure tarifaire créée avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, feeStructureUpdateSchema);

    const [updated] = await db
      .update(feeStructures)
      .set({
        name: body.name,
        amount: body.amount,
        description: body.description,
        isActive: body.isActive,
      })
      .where(and(eq(feeStructures.id, body.id), eq(feeStructures.tenantId, tenantId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Structure tarifaire non trouvée' }, { status: 404 });
    }

    recordAudit(context, 'update', 'fee_structure', body.id);

    return NextResponse.json({ success: true, data: updated, message: 'Structure tarifaire mise à jour' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID non fourni' }, { status: 400 });
    }

    await db.delete(feeStructures).where(and(eq(feeStructures.id, id), eq(feeStructures.tenantId, tenantId)));
    recordAudit(context, 'delete', 'fee_structure', id);

    return NextResponse.json({ success: true, message: 'Structure tarifaire supprimée', id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
