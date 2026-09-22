import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { detectAndRecordFlags } from '@/libs/api/attendance-flags';
import { resolveRegisterForSubmission } from '@/libs/api/attendance-registers';
import { recalculateStudentAttendanceSummary } from '@/libs/api/attendance-summary';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { getTeacherClassSectionIds } from '@/libs/api/teacher-scope';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { attendance, classes, classSections, guardians, guardianStudents, smsMessages, user } from '@/models/Schema';

const attendanceRecordItemSchema = z.object({
  studentId: z.string().min(1),
  status: z.enum(['present', 'absent', 'late', 'excused']),
  note: z.string().trim().max(255).optional(),
  lateMinutes: z.number().int().min(1).max(600).optional(),
}).strict();

const batchAttendanceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD attendu'),
  studentGroupId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  period: z.number().int().min(1).max(12).optional().default(1),
  records: z.array(attendanceRecordItemSchema).min(1),
  correctionNote: z.string().trim().max(500).optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const classIdParam = searchParams.get('classId') || searchParams.get('studentGroupId');
    const subjectIdParam = searchParams.get('subjectId');
    const periodParam = searchParams.get('period');

    const conditions = [
      eq(attendance.tenantId, tenantId),
      eq(attendance.date, dateParam),
      eq(attendance.isVoided, false),
    ];

    if (classIdParam) {
      // SECTION SCOPE (migration 0147): when the caller passes an operating
      // class section, only that section's marks are returned. Legacy rows
      // (class_section_id IS NULL) stay visible through their class id —
      // their historical section identity is unknowable.
      const [sec] = await db
        .select({ classId: classSections.classId })
        .from(classSections)
        .where(and(eq(classSections.tenantId, tenantId), eq(classSections.id, classIdParam)))
        .limit(1);
      if (sec?.classId) {
        conditions.push(or(
          eq(attendance.classSectionId, classIdParam),
          and(isNull(attendance.classSectionId), eq(attendance.studentGroupId, sec.classId)),
        )!);
      } else {
        conditions.push(eq(attendance.studentGroupId, classIdParam));
      }
    }
    if (subjectIdParam) {
      conditions.push(eq(attendance.subjectId, subjectIdParam));
    }
    if (periodParam) {
      conditions.push(eq(attendance.period, Number.parseInt(periodParam, 10)));
    }

    if (context.role === 'teacher') {
      const assignedIds = await getTeacherClassSectionIds(tenantId, context.userId);
      if (assignedIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: [],
          total: 0,
        });
      }
      conditions.push(inArray(user.classSectionId, assignedIds));
    }

    // BRANCH SCOPE (P0): a branch-limited caller only sees marks of students
    // belonging to their own campus. Whole-school callers are unaffected.
    if (context.branchId) {
      conditions.push(eq(user.branchId, context.branchId));
    }

    const rows = await db
      .select({
        id: attendance.id,
        studentId: attendance.studentId,
        studentName: user.name,
        date: attendance.date,
        status: attendance.status,
        lateMinutes: attendance.lateMinutes,
        period: attendance.period,
        subjectId: attendance.subjectId,
        studentGroupId: attendance.studentGroupId,
        note: attendance.note,
      })
      .from(attendance)
      .innerJoin(user, eq(attendance.studentId, user.id))
      .where(and(...conditions));

    return NextResponse.json({
      success: true,
      data: rows,
      total: rows.length,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'attendance.manage');
    const body = await parseJson(request, batchAttendanceSchema);

    // D-16: GET scopes a teacher to their assigned sections, POST did not, so a
    // teacher could mark attendance for any student in the tenant. Marking a
    // student `absent` also sends an SMS to that child's guardian, so the write
    // path reached families outside the teacher's classes. Checked before the
    // transaction: the batch is refused whole rather than partially applied.
    if (context.role === 'teacher') {
      const assigned = new Set(await getTeacherClassSectionIds(tenantId, context.userId));
      const studentIds = body.records.map(r => r.studentId);
      const rows = await db
        .select({ id: user.id, classSectionId: user.classSectionId })
        .from(user)
        .where(and(eq(user.tenantId, tenantId), inArray(user.id, studentIds)));

      const known = new Set(rows.map(r => r.id));
      const outOfScope = rows.some(r => !r.classSectionId || !assigned.has(r.classSectionId));
      // An unknown id (other tenant, or nonexistent) is also out of scope.
      if (outOfScope || studentIds.some(id => !known.has(id))) {
        throw new ApiError(403, 'FORBIDDEN', 'Un ou plusieurs élèves ne font pas partie de vos classes.');
      }
    }

    // SECTION SCOPE (migration 0147): `studentGroupId` carries the operating
    // class section from the intake UI. Resolve its parent class for the
    // legacy FK column and store the section explicitly, so Section A and
    // Section B get independent registers instead of sharing (and locking)
    // one class-level register.
    let attendanceClassId: string | null = body.studentGroupId || null;
    let attendanceSectionId: string | null = null;
    if (body.studentGroupId) {
      const [sec] = await db
        .select({ classId: classSections.classId, branchId: classes.branchId })
        .from(classSections)
        .innerJoin(classes, eq(classSections.classId, classes.id))
        .where(and(eq(classSections.tenantId, tenantId), eq(classSections.id, body.studentGroupId)))
        .limit(1);
      if (sec?.classId) {
        // BRANCH SCOPE (P0): a branch-limited admin cannot mark another
        // campus's section, even with valid student ids.
        if (context.branchId && sec.branchId !== context.branchId) {
          throw new ApiError(403, 'FORBIDDEN', 'Cette section appartient à un autre campus.');
        }
        attendanceClassId = sec.classId;
        attendanceSectionId = body.studentGroupId;
      }
    }

    // BRANCH SCOPE (P0): a branch-limited admin may only mark students of their
    // own campus; ambiguous (branch-less) students are refused rather than
    // silently mutated. Teachers are already scoped to assigned sections above.
    if (context.role === 'school_admin' && context.branchId) {
      const studentIds = body.records.map(r => r.studentId);
      const rows = await db
        .select({ id: user.id, branchId: user.branchId })
        .from(user)
        .where(and(eq(user.tenantId, tenantId), inArray(user.id, studentIds)));

      const known = new Set(rows.map(r => r.id));
      const outOfScope = rows.some(r => !r.branchId || r.branchId !== context.branchId);
      if (outOfScope || studentIds.some(id => !known.has(id))) {
        throw new ApiError(403, 'FORBIDDEN', 'Un ou plusieurs élèves ne font pas partie de votre campus.');
      }
    }

    const savedRecords = await db.transaction(async (tx) => {
      // Registers are keyed per (section, date, period) when a section is
      // known — only enforced when a class context is actually selected,
      // matching how the real intake UI always submits. Ad hoc submissions
      // without a class context stay unregistered rather than being blocked.
      const register = attendanceClassId
        ? await resolveRegisterForSubmission(tenantId, attendanceClassId, body.date, body.period, context.userId, body.correctionNote, tx, attendanceSectionId)
        : null;

      const results = [];
      for (const rec of body.records) {
        // Delete existing attendance session for this student, date, and period under this tenant
        const deleteConditions = [
          eq(attendance.tenantId, tenantId),
          eq(attendance.studentId, rec.studentId),
          eq(attendance.date, body.date),
          eq(attendance.period, body.period),
        ];

        await tx
          .delete(attendance)
          .where(and(...deleteConditions));

        // Insert fresh record
        const [inserted] = await tx
          .insert(attendance)
          .values({
            tenantId,
            studentId: rec.studentId,
            studentGroupId: attendanceClassId,
            classSectionId: attendanceSectionId,
            subjectId: body.subjectId || null,
            period: body.period,
            date: body.date,
            status: rec.status,
            lateMinutes: rec.status === 'late' ? (rec.lateMinutes ?? null) : null,
            markedById: context.userId,
            note: rec.note || null,
            isVoided: false,
            registerId: register?.id ?? null,
          })
          .returning();

        results.push(inserted);

        // Recalculate summary cache for affected student
        await recalculateStudentAttendanceSummary(tenantId, rec.studentId, tx);
        await detectAndRecordFlags(tenantId, rec.studentId, body.date, rec.status, tx);

        if (rec.status === 'absent') {
          // Prefer the primary contact, but fall back to any linked guardian -
          // isPrimaryContact isn't always set (e.g. links made before that default
          // existed), and a real student having no SMS destination at all because
          // of that would be a silent, confusing failure.
          const [guardian] = await tx
            .select({ phone: guardians.phone })
            .from(guardianStudents)
            .innerJoin(guardians, eq(guardianStudents.guardianId, guardians.id))
            .where(and(
              eq(guardianStudents.tenantId, tenantId),
              eq(guardianStudents.studentId, rec.studentId),
            ))
            .orderBy(desc(guardianStudents.isPrimaryContact))
            .limit(1);

          if (guardian?.phone) {
            const [student] = await tx.select({ name: user.name }).from(user).where(eq(user.id, rec.studentId)).limit(1);
            const now = new Date().toISOString();
            await tx.insert(smsMessages).values({
              tenantId,
              recipientPhone: guardian.phone,
              studentId: rec.studentId,
              body: `Absence non justifiée signalée pour ${student?.name ?? 'votre enfant'} le ${body.date}.`,
              status: 'sent',
              sentAt: now,
              createdById: context.userId,
            });
          }
        }
      }
      return { results, register };
    });

    recordAudit(context, 'update', 'attendance', body.date, {
      count: body.records.length,
      studentGroupId: attendanceClassId,
      classSectionId: attendanceSectionId,
      subjectId: body.subjectId,
      period: body.period,
      registerReference: savedRecords.register?.reference,
    });

    return NextResponse.json({
      success: true,
      data: savedRecords.results,
      register: savedRecords.register,
      message: `Présences enregistrées pour ${body.records.length} élève(s) (Période ${body.period}) à la date du ${body.date}.${savedRecords.register ? ` Registre ${savedRecords.register.reference} verrouillé.` : ''}`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
