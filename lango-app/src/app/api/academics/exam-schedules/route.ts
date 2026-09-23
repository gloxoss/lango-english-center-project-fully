import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  assessmentDefinitions,
  examHalls,
  examSchedules,
  examSeats,
  examSupervisors,
  examTerms,
} from '@/features/assessment/models/assessment-schema';
import { ExamMasterService } from '@/features/assessment/services/exam-master-service';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';

// Supervisors are real staff members, referenced by user.id. Free-text names
// were previously accepted here and stored in staff_id, which put invented
// people on official seating plans (audit 2026-09-22, P0-2).
const SUPERVISOR_STAFF_ROLES = ['teacher', 'school_admin', 'accountant', 'librarian', 'receptionist'] as const;

const createExamScheduleSchema = z.object({
  examTermId: z.string().uuid(),
  assessmentDefinitionId: z.string().uuid(),
  examHallId: z.string().uuid().optional(),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  supervisorStaffIds: z.array(z.string().uuid()).max(10).optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');

    const schedules = await db
      .select({
        id: examSchedules.id,
        examTermId: examSchedules.examTermId,
        examTermName: examTerms.name,
        assessmentDefinitionId: examSchedules.assessmentDefinitionId,
        subject: assessmentDefinitions.title,
        assessmentType: assessmentDefinitions.type,
        examHallId: examSchedules.examHallId,
        room: examHalls.name,
        hallCapacity: examHalls.capacity,
        startTime: examSchedules.startTime,
        endTime: examSchedules.endTime,
        status: examSchedules.status,
        createdAt: examSchedules.createdAt,
      })
      .from(examSchedules)
      .leftJoin(examTerms, eq(examSchedules.examTermId, examTerms.id))
      .leftJoin(assessmentDefinitions, eq(examSchedules.assessmentDefinitionId, assessmentDefinitions.id))
      .leftJoin(examHalls, eq(examSchedules.examHallId, examHalls.id))
      .where(eq(examSchedules.tenantId, tenantId))
      .orderBy(desc(examSchedules.startTime));

    const scheduleIds = schedules.map(s => s.id);
    const termIds = [...new Set(schedules.map(s => s.examTermId))];

    const supervisorsBySchedule: Record<string, Array<{ staffId: string; name: string | null; role: string; attendanceStatus: string }>> = {};
    const seatsByTerm: Record<string, Array<{ seatNumber: number; deskLabel: string | null; candidateNumber: string; studentId: string; studentName: string | null; matricule: string | null }>> = {};
    const seatCountByTerm: Record<string, number> = {};

    if (scheduleIds.length > 0) {
      // Supervisors resolved to real staff names via the user table. A staffId
      // with no matching tenant user (e.g. legacy free-text rows) surfaces as
      // name: null and the UI shows it as unassigned — never an invented name.
      const sups = await db
        .select({
          examScheduleId: examSupervisors.examScheduleId,
          staffId: examSupervisors.staffId,
          name: user.name,
          role: examSupervisors.role,
          attendanceStatus: examSupervisors.attendanceStatus,
        })
        .from(examSupervisors)
        .leftJoin(user, and(eq(user.id, examSupervisors.staffId), eq(user.tenantId, tenantId)))
        .where(inArray(examSupervisors.examScheduleId, scheduleIds));

      for (const sup of sups) {
        (supervisorsBySchedule[sup.examScheduleId] ??= []).push({
          staffId: sup.staffId,
          name: sup.name,
          role: sup.role,
          attendanceStatus: sup.attendanceStatus,
        });
      }
    }

    if (termIds.length > 0) {
      // Seats are allocated per exam term (see exam-terms/[id]/seat-allocation).
      // Candidates for a schedule are the term's real allocated seats — never
      // a sample of the school directory.
      const [seatCounts, seatRows] = await Promise.all([
        db
          .select({ examTermId: examSeats.examTermId, total: sql<number>`count(*)::int` })
          .from(examSeats)
          .where(and(eq(examSeats.tenantId, tenantId), inArray(examSeats.examTermId, termIds)))
          .groupBy(examSeats.examTermId),
        db
          .select({
            examTermId: examSeats.examTermId,
            seatNumber: examSeats.seatNumber,
            deskLabel: examSeats.deskLabel,
            candidateNumber: examSeats.candidateNumber,
            studentId: examSeats.studentId,
            studentName: user.name,
            matricule: user.matricule,
          })
          .from(examSeats)
          .leftJoin(user, and(eq(user.id, examSeats.studentId), eq(user.tenantId, tenantId)))
          .where(and(eq(examSeats.tenantId, tenantId), inArray(examSeats.examTermId, termIds)))
          .orderBy(examSeats.seatNumber)
          .limit(300),
      ]);

      for (const row of seatCounts) {
        seatCountByTerm[row.examTermId] = row.total;
      }
      for (const row of seatRows) {
        const { examTermId: termId, ...seatInfo } = row;
        (seatsByTerm[termId] ??= []).push(seatInfo);
      }
    }

    const enriched = schedules.map(s => ({
      ...s,
      supervisors: supervisorsBySchedule[s.id] ?? [],
      seats: seatsByTerm[s.examTermId] ?? [],
      seatCount: seatCountByTerm[s.examTermId] ?? 0,
    }));

    return NextResponse.json({ success: true, data: enriched });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');
    const body = await parseJson(request, createExamScheduleSchema);

    const [term] = await db.select({ id: examTerms.id }).from(examTerms).where(and(eq(examTerms.id, body.examTermId), eq(examTerms.tenantId, tenantId))).limit(1);
    if (!term) {
      throw new ApiError(404, 'NOT_FOUND', 'Session d\'examen introuvable.');
    }

    const [definition] = await db.select({ id: assessmentDefinitions.id }).from(assessmentDefinitions).where(and(eq(assessmentDefinitions.id, body.assessmentDefinitionId), eq(assessmentDefinitions.tenantId, tenantId))).limit(1);
    if (!definition) {
      throw new ApiError(404, 'NOT_FOUND', 'Épreuve introuvable.');
    }

    if (body.examHallId) {
      const [hall] = await db.select({ id: examHalls.id }).from(examHalls).where(and(eq(examHalls.id, body.examHallId), eq(examHalls.tenantId, tenantId))).limit(1);
      if (!hall) {
        throw new ApiError(404, 'NOT_FOUND', 'Salle d\'examen introuvable.');
      }
    }

    // Every supervisor must be a real, active staff member of THIS tenant.
    if (body.supervisorStaffIds && body.supervisorStaffIds.length > 0) {
      const staffRows = await db
        .select({ id: user.id, role: user.role })
        .from(user)
        .where(and(
          eq(user.tenantId, tenantId),
          eq(user.userStatus, 'active'),
          inArray(user.id, body.supervisorStaffIds),
        ));
      const found = new Map(staffRows.map(r => [r.id, r]));
      for (const staffId of body.supervisorStaffIds) {
        const row = found.get(staffId);
        if (!row || !(SUPERVISOR_STAFF_ROLES as readonly string[]).includes(row.role)) {
          throw new ApiError(422, 'INVALID_SUPERVISOR', 'Surveillant invalide : sélectionnez un membre du personnel de cet établissement.');
        }
      }
    }

    let schedule;
    try {
      schedule = await ExamMasterService.createExamSchedule({ tenantId, ...body });
    } catch (serviceError) {
      // ExamMasterService throws a plain Error for a real hall-time conflict -
      // surface it as a proper 409, not a generic 500.
      const message = serviceError instanceof Error ? serviceError.message : 'Conflit de planification.';
      throw new ApiError(409, 'SCHEDULE_CONFLICT', message);
    }

    recordAudit(context, 'create', 'exam_schedule', schedule!.id, { examTermId: body.examTermId });

    return NextResponse.json({ success: true, data: schedule }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
