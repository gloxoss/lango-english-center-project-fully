import { and, eq, isNull } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { classSections, classTeachers, user } from '@/models/Schema';

type RouteParams = { params: Promise<{ id: string }> };

const setHomeroomTeacherSchema = z.object({ teacherId: z.string().min(1) }).strict();

// Homeroom teacher reuses the already-real classTeachers table (role=primary)
// instead of a new FK (future-implementation/dropped-features-rebuild) - the
// DB's own partial unique index only guarantees one active primary per
// offeringId, which is commonly unset today, so this adds an explicit
// check-then-write transaction as the real guard (same TOCTOU pattern already
// used in the admission-approval flow).
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const context = await requireRequestContext(req, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'academics.manage');

    const { id: classSectionId } = await params;
    const body = await parseJson(req, setHomeroomTeacherSchema);

    const [section] = await db.select({ id: classSections.id }).from(classSections)
      .where(and(eq(classSections.id, classSectionId), eq(classSections.tenantId, tenantId)))
      .limit(1);
    if (!section) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'La section indiquée n\'existe pas pour cet établissement.');
    }

    const [teacher] = await db.select({ id: user.id }).from(user)
      .where(and(eq(user.id, body.teacherId), eq(user.tenantId, tenantId), eq(user.role, 'teacher')))
      .limit(1);
    if (!teacher) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'L\'enseignant indiqué n\'existe pas pour cet établissement.');
    }

    const inserted = await db.transaction(async (tx) => {
      const activePrimaries = await tx.select({ id: classTeachers.id }).from(classTeachers)
        .where(and(
          eq(classTeachers.classSectionId, classSectionId),
          eq(classTeachers.tenantId, tenantId),
          eq(classTeachers.role, 'primary'),
          isNull(classTeachers.endsOn),
        ));

      const today = new Date().toISOString().slice(0, 10);
      for (const row of activePrimaries) {
        await tx.update(classTeachers).set({ endsOn: today }).where(eq(classTeachers.id, row.id));
      }

      const [row] = await tx.insert(classTeachers).values({
        tenantId,
        classSectionId,
        teacherId: body.teacherId,
        role: 'primary',
        startsOn: today,
        assignedBy: context.userId,
      }).returning();
      return row;
    });

    recordAudit(context, 'update', 'class_section_homeroom_teacher', classSectionId, { teacherId: body.teacherId });

    return NextResponse.json({ success: true, data: inserted, message: 'Professeur principal assigné avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const context = await requireRequestContext(req, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'academics.manage');

    const { id: classSectionId } = await params;
    const today = new Date().toISOString().slice(0, 10);

    await db.update(classTeachers).set({ endsOn: today }).where(and(
      eq(classTeachers.classSectionId, classSectionId),
      eq(classTeachers.tenantId, tenantId),
      eq(classTeachers.role, 'primary'),
      isNull(classTeachers.endsOn),
    ));

    recordAudit(context, 'update', 'class_section_homeroom_teacher', classSectionId, { cleared: true });

    return NextResponse.json({ success: true, message: 'Professeur principal retiré' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
