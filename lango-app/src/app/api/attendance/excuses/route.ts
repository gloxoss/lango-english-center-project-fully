import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { resolveUnjustifiedAbsenceFlagsForDate } from '@/libs/api/attendance-flags';
import { recalculateStudentAttendanceSummary } from '@/libs/api/attendance-summary';
import { recordAudit } from '@/libs/api/audit';
import { sendSmsMessage } from '@/features/broadcast/services/sms-delivery';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { getGuardianChildIds } from '@/libs/api/guardian-scope';
import { requireCapability } from '@/libs/api/permissions';
import { assertStudentAccess } from '@/libs/api/student-access';
import { getTeacherClassSectionIds } from '@/libs/api/teacher-scope';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { attendance, attendanceExcuses, attendanceRegisters, classSections, guardians, guardianStudents, sessionYears, user } from '@/models/Schema';

const createExcuseSchema = z.object({
  studentId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD attendu'),
  // EXACT SCOPE (P0): the excuse justifies one authoritative mark context —
  // (student, section, date, period). Broad student+date justification is no
  // longer accepted for new excuses.
  classSectionId: z.string().uuid(),
  period: z.number().int().min(1).max(12),
  reason: z.string().trim().min(3).max(500),
  documentUrl: z.string().url().optional().or(z.literal('')),
}).strict();

const reviewExcuseSchema = z.object({
  excuseId: z.string().uuid(),
  status: z.enum(['approved', 'rejected']),
  rejectionReason: z.string().trim().min(3).max(500).optional(),
  // Re-reviewing an already-reviewed excuse is a deliberate authorized
  // correction, never an accidental status flip.
  allowRereview: z.boolean().optional(),
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

    // BOUNDED LIST (scale): excuses are paginated server-side; the default
    // keeps the staff queue complete for normal volumes without ever returning
    // an unbounded tenant dataset.
    const page = Math.max(Number.parseInt(searchParams.get('page') ?? '1', 10) || 1, 1);
    const pageSize = Math.min(Math.max(Number.parseInt(searchParams.get('pageSize') ?? '200', 10) || 200, 1), 500);

    const [totalRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(attendanceExcuses)
      .where(and(...conditions));

    const rows = await db
      .select({
        id: attendanceExcuses.id,
        studentId: attendanceExcuses.studentId,
        studentName: user.name,
        classSectionId: attendanceExcuses.classSectionId,
        period: attendanceExcuses.period,
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
      .orderBy(desc(attendanceExcuses.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

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
      total: totalRow?.total ?? enrichedRows.length,
      page,
      pageSize,
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

    // The target section must belong to this tenant (never trust the id).
    const [targetSection] = await db
      .select({ id: classSections.id })
      .from(classSections)
      .where(and(eq(classSections.tenantId, tenantId), eq(classSections.id, body.classSectionId)))
      .limit(1);
    if (!targetSection) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'Section de classe introuvable pour cet établissement.');
    }

    // SESSION TRUTH (Phase 4): the excuse belongs to the session whose date
    // bounds contain its date; a date outside every session is refused.
    const [sessionForDate] = await db
      .select({ id: sessionYears.id })
      .from(sessionYears)
      .where(and(
        eq(sessionYears.tenantId, tenantId),
        sql`${sessionYears.startDate}::date <= ${body.date}::date`,
        sql`${sessionYears.endDate}::date >= ${body.date}::date`,
      ))
      .limit(1);
    if (!sessionForDate) {
      throw new ApiError(422, 'DATE_OUTSIDE_SESSION', 'Cette date ne fait partie d\'aucune année scolaire de cet établissement.');
    }

    const [inserted] = await db
      .insert(attendanceExcuses)
      .values({
        tenantId,
        studentId: targetStudentId,
        classSectionId: body.classSectionId,
        period: body.period,
        sessionYearId: sessionForDate.id,
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
    await requireCapability(context, 'attendance.manage');
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

    // LIFECYCLE (P0): pending -> approved/rejected only. Re-reviewing an
    // already-reviewed excuse is an explicit authorized correction.
    if (existingExcuse.status !== 'pending' && !body.allowRereview) {
      throw new ApiError(
        409,
        'ALREADY_REVIEWED',
        'Cette justification a déjà été traitée. Confirmez une relecture explicite (allowRereview) pour la modifier.',
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
        // EXACT-SCOPE MUTATION (P0): only the authoritative mark for this
        // excuse's (student, section, date, period) may change. Never another
        // period, section, student or branch.
        if (!existingExcuse.classSectionId || !existingExcuse.period) {
          throw new ApiError(
            422,
            'EXCUSE_SCOPE_REQUIRED',
            'Cette justification historique n\'a pas de portée (section/période) : elle ne peut pas être appliquée automatiquement.',
          );
        }

        // REGISTER LOCK (P0): a locked register is corrected through the
        // explicit reopen flow, never silently rewritten by an approval.
        const [register] = await tx
          .select({ status: attendanceRegisters.status })
          .from(attendanceRegisters)
          .where(and(
            eq(attendanceRegisters.tenantId, tenantId),
            eq(attendanceRegisters.classSectionId, existingExcuse.classSectionId),
            eq(attendanceRegisters.date, existingExcuse.date),
            eq(attendanceRegisters.period, existingExcuse.period),
          ))
          .limit(1);
        if (register?.status === 'LOCKED') {
          throw new ApiError(
            409,
            'REGISTER_LOCKED',
            'Le registre de cette séance est verrouillé : rouvrez-le pour correction avant de valider la justification.',
          );
        }

        const marks = await tx
          .select({ id: attendance.id, status: attendance.status, lateMinutes: attendance.lateMinutes, note: attendance.note })
          .from(attendance)
          .where(and(
            eq(attendance.tenantId, tenantId),
            eq(attendance.studentId, existingExcuse.studentId),
            eq(attendance.classSectionId, existingExcuse.classSectionId),
            eq(attendance.date, existingExcuse.date),
            eq(attendance.period, existingExcuse.period),
            eq(attendance.isVoided, false),
            // SESSION TRUTH: an excuse never mutates a mark from another year.
            ...(existingExcuse.sessionYearId ? [eq(attendance.academicYearId, existingExcuse.sessionYearId)] : []),
          ));

        for (const mark of marks) {
          if (mark.status === 'excused') {
            continue;
          }
          await tx
            .update(attendance)
            .set({
              status: 'excused',
              note: `Excuse validée: ${existingExcuse.reason}`,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(attendance.id, mark.id));

          // History stays answerable: before/after + the excuse that caused it.
          recordAudit(context, 'update', 'attendance', mark.id, {
            studentId: existingExcuse.studentId,
            date: existingExcuse.date,
            period: existingExcuse.period,
            classSectionId: existingExcuse.classSectionId,
            before: { status: mark.status, lateMinutes: mark.lateMinutes, note: mark.note },
            after: { status: 'excused' },
            reason: 'excuse_approved',
            excuseId: existingExcuse.id,
          });
        }

        await recalculateStudentAttendanceSummary(tenantId, existingExcuse.studentId, tx);
        await resolveUnjustifiedAbsenceFlagsForDate(tenantId, existingExcuse.studentId, existingExcuse.date, tx);
      }

      return excuse;
    });

    recordAudit(context, 'update', 'attendance_excuses', body.excuseId, {
      status: body.status,
      previousStatus: existingExcuse.status,
      studentId: existingExcuse.studentId,
      classSectionId: existingExcuse.classSectionId,
      period: existingExcuse.period,
    });

    // The decision is what the family is waiting on, and until now nothing told
    // them. Sent AFTER the transaction — an SMS is not transactional, and a
    // failed send must not roll back a decision already made.
    //
    // The delivery state is reported exactly as the provider gave it. A
    // simulated or failed send is never presented as delivered.
    let notification: { delivery: string; simulated: boolean } | null = null;

    const [guardian] = await db
      .select({ phone: guardians.phone })
      .from(guardianStudents)
      .innerJoin(guardians, eq(guardianStudents.guardianId, guardians.id))
      .where(and(
        eq(guardianStudents.tenantId, tenantId),
        eq(guardianStudents.studentId, existingExcuse.studentId),
      ))
      .limit(1);

    if (guardian?.phone) {
      const sent = await sendSmsMessage(tenantId, {
        to: guardian.phone,
        // Tied to the student so the message log answers "what was the family
        // told about THIS child", not just "an SMS went out".
        studentId: existingExcuse.studentId,
        body: body.status === 'approved'
          ? `Justification acceptée pour l'absence du ${existingExcuse.date}.`
          : `Justification refusée pour l'absence du ${existingExcuse.date}.`,
        createdById: context.userId,
      });
      notification = { delivery: sent.delivery, simulated: sent.delivery === 'simulated' };
    }

    return NextResponse.json({
      success: true,
      data: updatedExcuse,
      notification,
      message: `Justification ${body.status === 'approved' ? 'approuvée' : 'refusée'}.`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
