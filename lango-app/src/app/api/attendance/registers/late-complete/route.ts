import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { assertBranchScope } from '@/libs/api/portal-scope';
import { parseJson } from '@/libs/api/validation';
import { isCancelled, listSessionOccurrences } from '@/libs/attendance/session-occurrence';
import { db } from '@/libs/DB';
import { casablancaTodayIso } from '@/libs/finance/today';
import { getEffectiveValueWithLegacyFallback } from '@/libs/settings/registry';
import { attendanceRegisters, classes, classScheduleSlots, classSections, sessionYears } from '@/models/Schema';

const lateCompleteSchema = z.object({
  slotId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD attendu'),
  reason: z.string().trim().min(3).max(500),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'attendance.manage');
    const body = await parseJson(request, lateCompleteSchema);

    const businessDate = casablancaTodayIso();
    if (body.date >= businessDate) {
      throw new ApiError(422, 'NOT_PAST_DATE', 'La complétion en retard est réservée aux jours passés.');
    }

    // Configurable teacher window limit (default 7 days)
    const daysEff = await getEffectiveValueWithLegacyFallback(tenantId, null, 'attendance.lateCompletionDays');
    const allowedDays = typeof daysEff.value === 'number' ? daysEff.value : 7;

    const diffMs = new Date(businessDate).getTime() - new Date(body.date).getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (context.role === 'teacher' && diffDays > allowedDays) {
      throw new ApiError(403, 'WINDOW_EXPIRED', `Le délai de complétion en retard pour les enseignants est dépassé (${allowedDays} jours max).`);
    }

    const occurrences = await listSessionOccurrences({
      tenantId,
      date: body.date,
      branchId: context.branchId,
      teacherId: context.role === 'teacher' ? context.userId : null,
    });

    const occurrence = occurrences.find(o => o.slotId === body.slotId);
    if (!occurrence) {
      throw new ApiError(404, 'LESSON_NOT_FOUND', 'Séance introuvable pour cette date.');
    }

    // Branch scope check for campus-limited admins (a NULL-branch occurrence
    // stays branch-agnostic, the helper's own rule).
    assertBranchScope(context, occurrence.branchId);

    if (isCancelled(occurrence)) {
      throw new ApiError(422, 'LESSON_CANCELLED', 'Ce cours a été annulé, aucun registre ne peut être créé.');
    }

    // Check if slot or occurrence already has a register
    const [existing] = await db
      .select({ id: attendanceRegisters.id })
      .from(attendanceRegisters)
      .where(and(
        eq(attendanceRegisters.tenantId, tenantId),
        eq(attendanceRegisters.date, body.date),
        eq(attendanceRegisters.classSectionId, occurrence.classSectionId),
        eq(attendanceRegisters.period, occurrence.period),
      ))
      .limit(1);

    if (existing) {
      throw new ApiError(409, 'ALREADY_EXISTS', 'Un registre existe déjà pour cette séance.');
    }

    const [sessionYear] = await db
      .select({ id: sessionYears.id })
      .from(sessionYears)
      .where(and(
        eq(sessionYears.tenantId, tenantId),
        sql`${sessionYears.startDate}::date <= ${body.date}::date`,
        sql`${sessionYears.endDate}::date >= ${body.date}::date`,
      ))
      .limit(1);

    const [sec] = await db
      .select({ classId: classSections.classId })
      .from(classSections)
      .where(and(eq(classSections.tenantId, tenantId), eq(classSections.id, occurrence.classSectionId)))
      .limit(1);

    if (!sec?.classId) {
      throw new ApiError(404, 'CLASS_NOT_FOUND', 'Classe introuvable pour cette section.');
    }

    const reference = `REG-${body.date.replace(/-/g, '')}-${occurrence.slotId.slice(0, 6).toUpperCase()}`;

    const [newRegister] = await db
      .insert(attendanceRegisters)
      .values({
        tenantId,
        classId: sec.classId,
        classSectionId: occurrence.classSectionId,
        classScheduleSlotId: occurrence.slotId,
        sessionYearId: sessionYear?.id ?? null,
        date: body.date,
        period: occurrence.period,
        reference,
        status: 'REOPENED',
        reopenedAt: new Date().toISOString(),
        reopenedById: context.userId,
        reopenReason: body.reason,
        correctionNote: 'LATE_COMPLETION',
        submittedById: context.userId,
      })
      .returning();

    recordAudit(context, 'create', 'attendance_register', newRegister!.id, {
      action: 'late_completion',
      reason: body.reason,
      slotId: body.slotId,
      date: body.date,
      lateCompletion: true,
    });

    return NextResponse.json({
      success: true,
      data: newRegister,
      message: `Registre ${reference} initialisé pour complétion en retard.`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
