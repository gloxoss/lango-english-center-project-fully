import type { NextRequest } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { recordStudentPlacement } from '@/libs/services/student-placement';
import { sessionYears, studentPlacements, user } from '@/models/Schema';

const postPlacementSchema = z.object({
  studentId: z.string().min(1, 'studentId est requis'),
  sessionYearId: z.string().uuid('sessionYearId invalide'),
  classSectionId: z.string().uuid('classSectionId invalide'),
  startDate: z.string().date('startDate doit être une date ISO (YYYY-MM-DD)').optional(),
  status: z.enum(['enrolled', 'dropped', 'graduated']).optional(),
  promotedFromPlacementId: z.string().uuid().optional(),
  notes: z.string().trim().max(1000).optional(),
}).strict();

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'students.read');

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get('studentId');
    const sessionYearId = searchParams.get('sessionYearId');
    const { page, limit, offset } = parsePagination(searchParams);

    const conditions = [eq(studentPlacements.tenantId, ctx.tenantId!)];

    if (studentId) {
      conditions.push(eq(studentPlacements.studentId, studentId));
    }
    if (sessionYearId) {
      conditions.push(eq(studentPlacements.sessionYearId, sessionYearId));
    }

    const placements = await db
      .select({
        id: studentPlacements.id,
        tenantId: studentPlacements.tenantId,
        studentId: studentPlacements.studentId,
        sessionYearId: studentPlacements.sessionYearId,
        classSectionId: studentPlacements.classSectionId,
        status: studentPlacements.status,
        startDate: studentPlacements.startDate,
        endDate: studentPlacements.endDate,
        isCurrent: studentPlacements.isCurrent,
        promotedFromPlacementId: studentPlacements.promotedFromPlacementId,
        notes: studentPlacements.notes,
        createdAt: studentPlacements.createdAt,
        updatedAt: studentPlacements.updatedAt,
        studentName: user.name,
        studentMatricule: user.matricule,
        sessionYearName: sessionYears.name,
      })
      .from(studentPlacements)
      .innerJoin(user, eq(studentPlacements.studentId, user.id))
      .innerJoin(sessionYears, eq(studentPlacements.sessionYearId, sessionYears.id))
      .where(and(...conditions))
      .orderBy(desc(studentPlacements.startDate), desc(studentPlacements.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      success: true,
      data: placements,
      meta: { page, limit },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'students.update');

    const body = await req.json();
    const validated = postPlacementSchema.parse(body);

    const newPlacement = await recordStudentPlacement({
      tenantId: ctx.tenantId!,
      studentId: validated.studentId,
      sessionYearId: validated.sessionYearId,
      classSectionId: validated.classSectionId,
      startDate: validated.startDate,
      status: validated.status,
      promotedFromPlacementId: validated.promotedFromPlacementId,
      notes: validated.notes,
    });

    return NextResponse.json({
      success: true,
      data: newPlacement,
    }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
