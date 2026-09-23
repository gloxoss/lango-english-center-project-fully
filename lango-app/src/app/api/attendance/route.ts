import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
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
import { attendance, classes, classSections, guardians, guardianStudents, sessionYears, smsMessages, user } from '@/models/Schema';

const attendanceRecordItemSchema = z.object({
  studentId: z.string().min(1),
  status: z.enum(['present', 'absent', 'late', 'excused']),
  note: z.string().trim().max(255).optional(),
  lateMinutes: z.number().int().min(1).max(600).optional(),
}).strict();

const batchAttendanceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD attendu'),
  // AUTHORITATIVE CONTEXT (P0): the operating class section is REQUIRED.
  // There is no unlocked ad-hoc downgrade on this route; specialized writers
  // (QR kiosk, live classrooms) have their own explicit paths.
  studentGroupId: z.string().uuid(),
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

    // Fail fast: a tenant with no academic sessions at all cannot take
    // attendance anywhere (checked before any reference resolution).
    const tenantSession = await db
      .select({ id: sessionYears.id })
      .from(sessionYears)
      .where(eq(sessionYears.tenantId, tenantId))
      .limit(1);
    if (tenantSession.length === 0) {
      throw new ApiError(422, 'MISSING_SESSION', 'Aucune année scolaire n\'est définie pour cet établissement.');
    }

    // SECTION SCOPE (migration 0147 + P0 lock-bypass fix): `studentGroupId`
    // carries the operating class section. It is resolved strictly — a forged
    // or unknown section is refused, never downgraded into an unlocked write.
    const [sec] = await db
      .select({ classId: classSections.classId, branchId: classes.branchId })
      .from(classSections)
      .innerJoin(classes, eq(classSections.classId, classes.id))
      .where(and(eq(classSections.tenantId, tenantId), eq(classSections.id, body.studentGroupId)))
      .limit(1);
    if (!sec) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'Section de classe introuvable pour cet établissement.');
    }
    // BRANCH SCOPE (P0): a branch-limited admin cannot mark another campus's
    // section, even with valid student ids.
    if (context.branchId && sec.branchId !== context.branchId) {
      throw new ApiError(403, 'FORBIDDEN', 'Cette section appartient à un autre campus.');
    }
    const attendanceClassId = sec.classId;
    const attendanceSectionId = body.studentGroupId;

    // PRE-FLIGHT BATCH VALIDATION (P0) — checked once, before the transaction,
    // so a forged/unauthorized student refuses the WHOLE batch atomically:
    //   1. every student exists in this tenant as an active student;
    //   2. every student is currently placed in THIS section (placement truth);
    //   3. teachers: the section must be one of their current assignments;
    //   4. branch-limited admins: the section must be on their campus (already
    //      enforced above) and students must be branch-resolvable.
    const studentIds = body.records.map(r => r.studentId);
    const studentRows = await db
      .select({ id: user.id, branchId: user.branchId, classSectionId: user.classSectionId })
      .from(user)
      .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), inArray(user.id, studentIds)));

    const studentById = new Map(studentRows.map(row => [row.id, row]));
    if (studentIds.some(id => !studentById.has(id))) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'Un ou plusieurs élèves sont introuvables pour cet établissement.');
    }

    const wrongSection = studentRows.some(row => row.classSectionId !== attendanceSectionId);
    if (wrongSection) {
      throw new ApiError(403, 'FORBIDDEN', 'Un ou plusieurs élèves n\'appartiennent pas à cette section.');
    }

    if (context.role === 'teacher') {
      const assigned = new Set(await getTeacherClassSectionIds(tenantId, context.userId));
      if (!assigned.has(attendanceSectionId)) {
        throw new ApiError(403, 'FORBIDDEN', 'Cette section ne fait pas partie de vos classes.');
      }
    }

    if (context.role === 'school_admin' && context.branchId) {
      const outOfScope = studentRows.some(row => !row.branchId || row.branchId !== context.branchId);
      if (outOfScope) {
        throw new ApiError(403, 'FORBIDDEN', 'Un ou plusieurs élèves ne font pas partie de votre campus.');
      }
    }

    // SESSION TRUTH (Phase 4): the mark's session is the one whose date bounds
    // contain the attendance date — never a "today" default.
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
    const sessionYearId = sessionForDate.id;

    const savedRecords = await db.transaction(async (tx) => {
      const register = await resolveRegisterForSubmission(tenantId, attendanceClassId, body.date, body.period, context.userId, body.correctionNote, tx, attendanceSectionId, sessionYearId);

      const studentIds = body.records.map(r => r.studentId);

      // Bulk-read the authoritative active marks for this exact context — one
      // query, not one per student.
      const existingRows = await tx
        .select()
        .from(attendance)
        .where(and(
          eq(attendance.tenantId, tenantId),
          inArray(attendance.studentId, studentIds),
          eq(attendance.date, body.date),
          eq(attendance.period, body.period),
          eq(attendance.classSectionId, attendanceSectionId),
          eq(attendance.isVoided, false),
        ));
      const existingByStudent = new Map(existingRows.map(row => [row.studentId, row]));

      const results = [];
      const changedStudentIds = new Set<string>();
      const absentStudentIds = new Set<string>();

      for (const rec of body.records) {
        const lateMinutes = rec.status === 'late' ? (rec.lateMinutes ?? null) : null;
        const note = rec.note || null;
        const existing = existingByStudent.get(rec.studentId);

        if (existing
          && existing.status === rec.status
          && existing.lateMinutes === lateMinutes
          && (existing.note ?? null) === note) {
          // No change: keep the authoritative mark untouched (no re-SMS, no
          // summary churn, no history rewrite).
          results.push(existing);
          continue;
        }

        const after = { status: rec.status, lateMinutes, note };

        if (existing) {
          // CORRECTION (P0): update in place and audit before/after — the
          // previous mark stays answerable in audit_logs; nothing is deleted.
          const [updated] = await tx
            .update(attendance)
            .set({
              status: rec.status,
              lateMinutes,
              note,
              markedById: context.userId,
              registerId: register?.id ?? null,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(attendance.id, existing.id))
            .returning();

          recordAudit(context, 'update', 'attendance', existing.id, {
            studentId: rec.studentId,
            date: body.date,
            period: body.period,
            classSectionId: attendanceSectionId,
            before: { status: existing.status, lateMinutes: existing.lateMinutes, note: existing.note },
            after,
            reason: body.correctionNote ?? null,
          });
          results.push(updated);
        } else {
          // Insert path, race-safe via the partial unique index: two
          // simultaneous submissions can never create duplicate active marks.
          const [inserted] = await tx
            .insert(attendance)
            .values({
              tenantId,
              studentId: rec.studentId,
              studentGroupId: attendanceClassId,
              classSectionId: attendanceSectionId,
              subjectId: body.subjectId || null,
              academicYearId: sessionYearId,
              period: body.period,
              date: body.date,
              status: rec.status,
              lateMinutes,
              markedById: context.userId,
              note,
              isVoided: false,
              registerId: register?.id ?? null,
            })
            .onConflictDoUpdate({
              target: [attendance.tenantId, attendance.studentId, attendance.academicYearId, attendance.date, attendance.period, attendance.classSectionId],
              targetWhere: sql`${attendance.isVoided} = false AND ${attendance.classSectionId} IS NOT NULL`,
              set: {
                status: rec.status,
                lateMinutes,
                note,
                markedById: context.userId,
                registerId: register?.id ?? null,
                updatedAt: new Date().toISOString(),
              },
            })
            .returning();

          recordAudit(context, 'create', 'attendance', inserted!.id, {
            studentId: rec.studentId,
            date: body.date,
            period: body.period,
            classSectionId: attendanceSectionId,
            after,
          });
          results.push(inserted);
        }

        changedStudentIds.add(rec.studentId);
        if (rec.status === 'absent') {
          absentStudentIds.add(rec.studentId);
        }
      }

      // Side effects run once per CHANGED student — not once per record, and
      // never for unchanged re-submissions.
      for (const studentId of changedStudentIds) {
        await recalculateStudentAttendanceSummary(tenantId, studentId, tx);
      }
      for (const studentId of changedStudentIds) {
        const rec = body.records.find(r => r.studentId === studentId);
        if (rec) {
          await detectAndRecordFlags(tenantId, studentId, body.date, rec.status, tx);
        }
      }

      for (const studentId of absentStudentIds) {
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
            eq(guardianStudents.studentId, studentId),
          ))
          .orderBy(desc(guardianStudents.isPrimaryContact))
          .limit(1);

        if (guardian?.phone) {
          const [student] = await tx.select({ name: user.name }).from(user).where(eq(user.id, studentId)).limit(1);
          const now = new Date().toISOString();
          await tx.insert(smsMessages).values({
            tenantId,
            recipientPhone: guardian.phone,
            studentId,
            body: `Absence non justifiée signalée pour ${student?.name ?? 'votre enfant'} le ${body.date}.`,
            status: 'sent',
            sentAt: now,
            createdById: context.userId,
          });
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
