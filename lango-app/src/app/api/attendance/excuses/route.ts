import { and, desc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { resolveUnjustifiedAbsenceFlagsForDate } from '@/libs/api/attendance-flags';
import { recalculateStudentAttendanceSummary } from '@/libs/api/attendance-summary';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { getGuardianChildIds } from '@/libs/api/guardian-scope';
import { assertStudentAccess } from '@/libs/api/student-access';
import { getTeacherClassSectionIds } from '@/libs/api/teacher-scope';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { attendance, attendanceExcuses, guardians, guardianStudents, user } from '@/models/Schema';

const createExcuseSchema = z.object({
  studentId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD attendu'),
  reason: z.string().trim().min(3).max(500),
  documentUrl: z.string().url().optional().or(z.literal('')),
}).strict();

const reviewExcuseSchema = z.object({
  excuseId: z.string().uuid(),
  status: z.enum(['approved', 'rejected']),
  rejectionReason: z.string().trim().min(3).max(500).optional(),
}).strict().refine(
  data => data.status !== 'rejected' || !!data.rejectionReason,
  { message: 'Un motif de refus est requis.', path: ['rejectionReason'] },
);

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'student', 'parent']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const studentIdParam = searchParams.get('studentId');

    const conditions = [eq(attendanceExcuses.tenantId, tenantId)];

    if (context.role === 'student') {
      conditions.push(eq(attendanceExcuses.studentId, context.userId));
    } else if (context.role === 'parent') {
      // D-13 fix: a parent must never see another family's excuses - scope
      // strictly to their own linked children (studentIdParam, if given,
      // must be one of them; otherwise default to all of them, not the
      // whole tenant).
      const childIds = await getGuardianChildIds(tenantId, context.userId);
      if (studentIdParam) {
        if (!childIds.includes(studentIdParam)) {
          return NextResponse.json({ success: true, data: [] });
        }
        conditions.push(eq(attendanceExcuses.studentId, studentIdParam));
      } else if (childIds.length > 0) {
        conditions.push(inArray(attendanceExcuses.studentId, childIds));
      } else {
        return NextResponse.json({ success: true, data: [] });
      }
    } else if (studentIdParam) {
      conditions.push(eq(attendanceExcuses.studentId, studentIdParam));
    }

    // TEACHER SCOPE (P0): excuses only for students currently in the teacher's
    // authorized sections. BRANCH SCOPE: branch-limited admins only their
    // campus. Both are enforced through the student row, never the request.
    if (context.role === 'teacher') {
      const assignedIds = await getTeacherClassSectionIds(tenantId, context.userId);
      if (assignedIds.length === 0) {
        return NextResponse.json({ success: true, data: [], total: 0 });
      }
      conditions.push(inArray(
        attendanceExcuses.studentId,
        db.select({ id: user.id }).from(user).where(and(eq(user.tenantId, tenantId), inArray(user.classSectionId, assignedIds))),
      ));
    } else if (context.role === 'school_admin' && context.branchId) {
      conditions.push(inArray(
        attendanceExcuses.studentId,
        db.select({ id: user.id }).from(user).where(and(eq(user.tenantId, tenantId), eq(user.branchId, context.branchId))),
      ));
    }

    if (statusParam && ['pending', 'approved', 'rejected'].includes(statusParam)) {
      conditions.push(eq(attendanceExcuses.status, statusParam as any));
    }

    const rows = await db
      .select({
        id: attendanceExcuses.id,
        studentId: attendanceExcuses.studentId,
        studentName: user.name,
        date: attendanceExcuses.date,
        reason: attendanceExcuses.reason,
        documentUrl: attendanceExcuses.documentUrl,
        documentFileExt: attendanceExcuses.documentFileExt,
        status: attendanceExcuses.status,
        reviewedById: attendanceExcuses.reviewedById,
        reviewedAt: attendanceExcuses.reviewedAt,
        rejectionReason: attendanceExcuses.rejectionReason,
        createdAt: attendanceExcuses.createdAt,
      })
      .from(attendanceExcuses)
      .innerJoin(user, eq(attendanceExcuses.studentId, user.id))
      .where(and(...conditions))
      .orderBy(desc(attendanceExcuses.createdAt));

    // One guardian per student (primary if set, else any) - batched, not
    // per-row, to avoid duplicating excuse rows via a direct join.
    const studentIds = [...new Set(rows.map(r => r.studentId))];
    const guardianRows = studentIds.length
      ? await db
          .select({
            studentId: guardianStudents.studentId,
            guardianName: guardians.firstName,
            guardianLastName: guardians.lastName,
            guardianPhone: guardians.phone,
            guardianEmail: guardians.email,
            isPrimaryContact: guardianStudents.isPrimaryContact,
          })
          .from(guardianStudents)
          .innerJoin(guardians, eq(guardianStudents.guardianId, guardians.id))
          .where(and(eq(guardianStudents.tenantId, tenantId), inArray(guardianStudents.studentId, studentIds)))
      : [];
    const guardianByStudent = new Map<string, typeof guardianRows[number]>();
    for (const g of guardianRows) {
      const existing = guardianByStudent.get(g.studentId);
      if (!existing || (g.isPrimaryContact && !existing.isPrimaryContact)) {
        guardianByStudent.set(g.studentId, g);
      }
    }

    const enrichedRows = rows.map((r) => {
      const g = guardianByStudent.get(r.studentId);
      return {
        ...r,
        guardianName: g ? `${g.guardianName} ${g.guardianLastName}`.trim() : null,
        guardianPhone: g?.guardianPhone ?? null,
        guardianEmail: g?.guardianEmail ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      data: enrichedRows,
      total: enrichedRows.length,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'student', 'parent']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, createExcuseSchema);

    // If role is student, enforce studentId is context.userId. If role is
    // parent, the target must be one of their own linked children (D-13:
    // previously any parent could submit an excuse for any studentId in the
    // tenant with zero relationship check).
    let targetStudentId: string;
    if (context.role === 'student') {
      targetStudentId = context.userId;
    } else if (context.role === 'parent') {
      const childIds = await getGuardianChildIds(tenantId, context.userId);
      if (!childIds.includes(body.studentId)) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Cet élève n\'est pas lié à votre compte.' } },
          { status: 403 },
        );
      }
      targetStudentId = body.studentId;
    } else {
      // TEACHER/ADMIN SCOPE (P0): teacher -> own sections; branch-limited
      // admin -> own campus. Previously any teacher/admin could file an
      // excuse for any student in the tenant.
      await assertStudentAccess(context, tenantId, body.studentId);
      targetStudentId = body.studentId;
    }

    const [inserted] = await db
      .insert(attendanceExcuses)
      .values({
        tenantId,
        studentId: targetStudentId,
        date: body.date,
        reason: body.reason,
        documentUrl: body.documentUrl || null,
        status: 'pending',
      })
      .returning();

    if (!inserted) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Échec de création de la demande' } },
        { status: 500 },
      );
    }

    recordAudit(context, 'create', 'attendance_excuses', inserted.id, {
      studentId: targetStudentId,
      date: body.date,
    });

    return NextResponse.json({
      success: true,
      data: inserted,
      message: 'Demande de justification soumise avec succès.',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, reviewExcuseSchema);

    const [existingExcuse] = await db
      .select()
      .from(attendanceExcuses)
      .where(
        and(
          eq(attendanceExcuses.id, body.excuseId),
          eq(attendanceExcuses.tenantId, tenantId),
        ),
      );

    if (!existingExcuse) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Justification non trouvée' } },
        { status: 404 },
      );
    }

    const updatedExcuse = await db.transaction(async (tx) => {
      const [excuse] = await tx
        .update(attendanceExcuses)
        .set({
          status: body.status,
          reviewedById: context.userId,
          reviewedAt: new Date().toISOString(),
          rejectionReason: body.status === 'rejected' ? body.rejectionReason : null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(attendanceExcuses.id, body.excuseId))
        .returning();

      if (body.status === 'approved') {
        // Update existing attendance records for this student and date to 'excused'
        await tx
          .update(attendance)
          .set({
            status: 'excused',
            note: `Excuse validée: ${existingExcuse.reason}`,
            updatedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(attendance.tenantId, tenantId),
              eq(attendance.studentId, existingExcuse.studentId),
              eq(attendance.date, existingExcuse.date),
            ),
          );

        // Recalculate summary
        await recalculateStudentAttendanceSummary(tenantId, existingExcuse.studentId, tx);
        await resolveUnjustifiedAbsenceFlagsForDate(tenantId, existingExcuse.studentId, existingExcuse.date, tx);
      }

      return excuse;
    });

    recordAudit(context, 'update', 'attendance_excuses', body.excuseId, {
      status: body.status,
      studentId: existingExcuse.studentId,
    });

    return NextResponse.json({
      success: true,
      data: updatedExcuse,
      message: `Justification ${body.status === 'approved' ? 'approuvée' : 'refusée'}.`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
