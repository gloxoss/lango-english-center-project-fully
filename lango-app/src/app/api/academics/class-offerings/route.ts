import { and, eq, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { academicClassOfferings, classes, sections, sessionYears } from '@/models/Schema';

export const classOfferingCreateSchema = z.object({
  sessionYearId: z.string().uuid({ message: 'L\'identifiant de la session est requis.' }),
  classId: z.string().uuid({ message: 'L\'identifiant de la classe est requis.' }),
  sectionId: z.string().uuid({ message: 'L\'identifiant de la section est requis.' }),
  capacity: z.number().int().positive().nullable().optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional().default('active'),
  displayOrder: z.number().int().optional().default(0),
}).strict();

export const classOfferingUpdateSchema = z.object({
  id: z.string().uuid(),
  capacity: z.number().int().positive().nullable().optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
  displayOrder: z.number().int().optional(),
}).strict();

async function assertReferencesBelongToTenant(tenantId: string, refs: { sessionYearId: string; classId: string; sectionId: string }) {
  const [sessionRow] = await db.select({ id: sessionYears.id }).from(sessionYears).where(and(eq(sessionYears.id, refs.sessionYearId), eq(sessionYears.tenantId, tenantId))).limit(1);
  if (!sessionRow) {
    throw new ApiError(422, 'INVALID_REFERENCE', 'La session académique indiquée n\'existe pas pour cet établissement.');
  }
  const [classRow] = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.id, refs.classId), eq(classes.tenantId, tenantId))).limit(1);
  if (!classRow) {
    throw new ApiError(422, 'INVALID_REFERENCE', 'La classe indiquée n\'existe pas pour cet établissement.');
  }
  const [sectionRow] = await db.select({ id: sections.id }).from(sections).where(and(eq(sections.id, refs.sectionId), eq(sections.tenantId, tenantId))).limit(1);
  if (!sectionRow) {
    throw new ApiError(422, 'INVALID_REFERENCE', 'La section indiquée n\'existe pas pour cet établissement.');
  }
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'accountant', 'receptionist']);
    await requireCapability(context, 'academics.read');
    const tenantId = requireTenant(context);

    const { searchParams } = new URL(request.url);
    const sessionYearId = searchParams.get('sessionYearId');
    const includeArchived = searchParams.get('includeArchived') === 'true';

    const conditions = [eq(academicClassOfferings.tenantId, tenantId)];
    if (sessionYearId) {
      conditions.push(eq(academicClassOfferings.sessionYearId, sessionYearId));
    }
    if (!includeArchived) {
      conditions.push(ne(academicClassOfferings.status, 'archived'));
    }

    const rows = await db
      .select({
        id: academicClassOfferings.id,
        tenantId: academicClassOfferings.tenantId,
        sessionYearId: academicClassOfferings.sessionYearId,
        sessionYearName: sessionYears.name,
        classId: academicClassOfferings.classId,
        className: classes.name,
        sectionId: academicClassOfferings.sectionId,
        sectionName: sections.name,
        capacity: academicClassOfferings.capacity,
        status: academicClassOfferings.status,
        displayOrder: academicClassOfferings.displayOrder,
        createdAt: academicClassOfferings.createdAt,
        updatedAt: academicClassOfferings.updatedAt,
      })
      .from(academicClassOfferings)
      .innerJoin(sessionYears, eq(academicClassOfferings.sessionYearId, sessionYears.id))
      .innerJoin(classes, eq(academicClassOfferings.classId, classes.id))
      .innerJoin(sections, eq(academicClassOfferings.sectionId, sections.id))
      .where(and(...conditions))
      .orderBy(academicClassOfferings.displayOrder, classes.name, sections.name);

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    await requireCapability(context, 'academics.manage');
    const tenantId = requireTenant(context);

    const body = await parseJson(request, classOfferingCreateSchema);

    await assertReferencesBelongToTenant(tenantId, {
      sessionYearId: body.sessionYearId,
      classId: body.classId,
      sectionId: body.sectionId,
    });

    const [existing] = await db
      .select({ id: academicClassOfferings.id })
      .from(academicClassOfferings)
      .where(and(
        eq(academicClassOfferings.tenantId, tenantId),
        eq(academicClassOfferings.sessionYearId, body.sessionYearId),
        eq(academicClassOfferings.classId, body.classId),
        eq(academicClassOfferings.sectionId, body.sectionId),
      ))
      .limit(1);

    if (existing) {
      throw new ApiError(409, 'ALREADY_EXISTS', 'Une offre de classe existe déjà pour cette session, classe et section.');
    }

    const [saved] = await db
      .insert(academicClassOfferings)
      .values({
        tenantId,
        sessionYearId: body.sessionYearId,
        classId: body.classId,
        sectionId: body.sectionId,
        capacity: body.capacity ?? null,
        status: body.status ?? 'active',
        displayOrder: body.displayOrder ?? 0,
      })
      .returning();

    recordAudit(context, 'create', 'academic_class_offering', saved!.id);

    return NextResponse.json({ success: true, data: saved }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    await requireCapability(context, 'academics.manage');
    const tenantId = requireTenant(context);

    const body = await parseJson(request, classOfferingUpdateSchema);

    const [existing] = await db
      .select({ id: academicClassOfferings.id })
      .from(academicClassOfferings)
      .where(and(eq(academicClassOfferings.id, body.id), eq(academicClassOfferings.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'L\'offre de classe spécifiée est introuvable.');
    }

    const updatePayload: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };
    if (body.capacity !== undefined) updatePayload.capacity = body.capacity;
    if (body.status !== undefined) updatePayload.status = body.status;
    if (body.displayOrder !== undefined) updatePayload.displayOrder = body.displayOrder;

    const [updated] = await db
      .update(academicClassOfferings)
      .set(updatePayload)
      .where(and(eq(academicClassOfferings.id, body.id), eq(academicClassOfferings.tenantId, tenantId)))
      .returning();

    recordAudit(context, 'update', 'academic_class_offering', updated!.id);

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    await requireCapability(context, 'academics.manage');
    const tenantId = requireTenant(context);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      throw new ApiError(400, 'BAD_REQUEST', 'L\'identifiant de l\'offre est requis.');
    }

    const [existing] = await db
      .select({ id: academicClassOfferings.id })
      .from(academicClassOfferings)
      .where(and(eq(academicClassOfferings.id, id), eq(academicClassOfferings.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'L\'offre de classe spécifiée est introuvable.');
    }

    // Soft archive rather than hard delete to prevent orphan FK references
    const [archived] = await db
      .update(academicClassOfferings)
      .set({ status: 'archived', updatedAt: new Date().toISOString() })
      .where(and(eq(academicClassOfferings.id, id), eq(academicClassOfferings.tenantId, tenantId)))
      .returning();

    recordAudit(context, 'update', 'academic_class_offering', archived!.id, { archived: true });

    return NextResponse.json({ success: true, message: 'Offre de classe archivée avec succès.', data: archived });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
