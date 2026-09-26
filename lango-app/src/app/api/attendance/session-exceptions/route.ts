import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkConsent } from '@/features/broadcast/services/consent-service';
import { sendSmsMessage } from '@/features/broadcast/services/sms-delivery';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { assertBranchScope } from '@/libs/api/portal-scope';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { casablancaTodayIso } from '@/libs/finance/today';
import {
  classes,
  classScheduleSlots,
  classSections,
  classSessionExceptions,
  classSubjects,
  guardians,
  guardianStudents,
  notifications,
  subjects,
  user,
} from '@/models/Schema';

/**
 * A dated deviation from the weekly timetable (phase 6).
 *
 * One exception per occurrence: writing a second one for the same lesson and day
 * replaces the first rather than accumulating contradictory rows, which is what
 * the unique index enforces. The base timetable is never touched — cancelling a
 * lesson for a day must not rewrite the school's weekly schedule.
 *
 * Every exception requires a reason: an unexplained cancellation is
 * indistinguishable from an oversight, and the reason is the history.
 */

const createExceptionSchema = z.object({
  classScheduleSlotId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD attendu'),
  type: z.enum(['CANCELLED', 'SUBSTITUTE', 'ROOM_CHANGE', 'RESCHEDULE']),
  reason: z.string().trim().min(3).max(500),
  substituteTeacherId: z.string().min(1).nullable().optional(),
  roomLabel: z.string().trim().min(1).max(100).nullable().optional(),
  startTime: z.string().regex(/^\d{1,2}:\d{2}$/).nullable().optional(),
  endTime: z.string().regex(/^\d{1,2}:\d{2}$/).nullable().optional(),
}).strict();

const TIME_RE = /^\d{1,2}:\d{2}$/;

function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

const EXCEPTION_SMS_TEMPLATES = {
  ar: {
    CANCELLED: (p: { subject: string; date: string }) =>
      `إشعار: تم إلغاء حصة ${p.subject} المقررة بتاريخ ${p.date}.`,
    RESCHEDULE: (p: { subject: string; date: string; start?: string | null; end?: string | null }) =>
      `إشعار: تم تعديل توقيت حصة ${p.subject} بتاريخ ${p.date} إلى ${p.start ?? ''}-${p.end ?? ''}.`,
    REINSTATED: (p: { subject: string; date: string }) =>
      `إشعار: تم استئناف حصة ${p.subject} بتاريخ ${p.date} وفق جدولها المعتاد.`,
  },
  fr: {
    CANCELLED: (p: { subject: string; date: string }) =>
      `Avis: Le cours de ${p.subject} du ${p.date} est annulé.`,
    RESCHEDULE: (p: { subject: string; date: string; start?: string | null; end?: string | null }) =>
      `Avis: Le cours de ${p.subject} du ${p.date} est déplacé à ${p.start ?? ''}-${p.end ?? ''}.`,
    REINSTATED: (p: { subject: string; date: string }) =>
      `Avis: Le cours de ${p.subject} du ${p.date} est rétabli selon l'horaire habituel.`,
  },
} as const;

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'attendance.manage');

    const body = await parseJson(request, createExceptionSchema);

    // Each type changes exactly one thing; requiring its field stops a
    // ROOM_CHANGE being saved with no room, which would silently do nothing.
    if (body.type === 'SUBSTITUTE' && !body.substituteTeacherId) {
      throw new ApiError(422, 'SUBSTITUTE_REQUIRED', 'Un remplaçant est requis pour une substitution.');
    }
    if (body.type === 'ROOM_CHANGE' && !body.roomLabel) {
      throw new ApiError(422, 'ROOM_REQUIRED', 'Une salle est requise pour un changement de salle.');
    }
    if (body.type === 'RESCHEDULE') {
      if (!body.startTime || !body.endTime) {
        throw new ApiError(422, 'TIME_REQUIRED', 'Une heure de début et de fin sont requises pour un déplacement.');
      }
      if (!TIME_RE.test(body.startTime) || !TIME_RE.test(body.endTime) || minutesOf(body.endTime) <= minutesOf(body.startTime)) {
        throw new ApiError(422, 'TIME_INVALID', "L'heure de fin doit être postérieure à l'heure de début.");
      }
    }

    const [slot] = await db
      .select({
        id: classScheduleSlots.id,
        teacherId: classScheduleSlots.teacherId,
        classSectionId: classScheduleSlots.classSectionId,
        branchId: classes.branchId,
        subjectName: subjects.name,
      })
      .from(classScheduleSlots)
      .innerJoin(classSections, eq(classScheduleSlots.classSectionId, classSections.id))
      .innerJoin(classes, eq(classSections.classId, classes.id))
      .leftJoin(classSubjects, eq(classScheduleSlots.classSubjectId, classSubjects.id))
      .leftJoin(subjects, eq(classSubjects.subjectId, subjects.id))
      .where(and(eq(classScheduleSlots.id, body.classScheduleSlotId), eq(classScheduleSlots.tenantId, tenantId)))
      .limit(1);

    if (!slot) {
      throw new ApiError(404, 'NOT_FOUND', 'Créneau introuvable');
    }
    // An exception is campus data of the slot's class.
    assertBranchScope(context, slot.branchId);

    // Idempotency: check if an exception already exists with the same configuration
    const [existingException] = await db
      .select({
        id: classSessionExceptions.id,
        type: classSessionExceptions.type,
        startTime: classSessionExceptions.startTime,
        endTime: classSessionExceptions.endTime,
        substituteTeacherId: classSessionExceptions.substituteTeacherId,
        roomLabel: classSessionExceptions.roomLabel,
      })
      .from(classSessionExceptions)
      .where(and(
        eq(classSessionExceptions.tenantId, tenantId),
        eq(classSessionExceptions.classScheduleSlotId, body.classScheduleSlotId),
        eq(classSessionExceptions.date, body.date),
      ))
      .limit(1);

    const isNewOrChanged = !existingException
      || existingException.type !== body.type
      || existingException.startTime !== (body.startTime ?? null)
      || existingException.endTime !== (body.endTime ?? null)
      || existingException.substituteTeacherId !== (body.substituteTeacherId ?? null)
      || existingException.roomLabel !== (body.roomLabel ?? null);

    // Only the field the type is about is stored, so a room change cannot carry
    // a stale substitute forward.
    const values = {
      tenantId,
      classScheduleSlotId: body.classScheduleSlotId,
      date: body.date,
      type: body.type,
      reason: body.reason,
      substituteTeacherId: body.type === 'SUBSTITUTE' ? body.substituteTeacherId ?? null : null,
      roomLabel: body.type === 'ROOM_CHANGE' ? body.roomLabel ?? null : null,
      startTime: body.type === 'RESCHEDULE' ? body.startTime ?? null : null,
      endTime: body.type === 'RESCHEDULE' ? body.endTime ?? null : null,
      createdById: context.userId,
      updatedAt: new Date().toISOString(),
    };

    const [exception] = await db
      .insert(classSessionExceptions)
      .values(values)
      .onConflictDoUpdate({
        target: [classSessionExceptions.tenantId, classSessionExceptions.classScheduleSlotId, classSessionExceptions.date],
        set: {
          type: values.type,
          reason: values.reason,
          substituteTeacherId: values.substituteTeacherId,
          roomLabel: values.roomLabel,
          startTime: values.startTime,
          endTime: values.endTime,
          createdById: values.createdById,
          updatedAt: values.updatedAt,
        },
      })
      .returning();

    recordAudit(context, 'create', 'class_session_exception', exception!.id, {
      type: body.type,
      date: body.date,
      slotId: body.classScheduleSlotId,
      reason: body.reason,
    });

    // Notify teacher, students, guardians, and admins only if new or changed, and date >= today
    const today = casablancaTodayIso();
    const isTodayOrFuture = body.date >= today;
    let smsStatus: 'sent' | 'simulated' | 'skipped' = 'skipped';
    let teachersCount = 0;
    let studentsCount = 0;
    let guardiansCount = 0;
    let noAccountCount = 0;
    let skippedNoConsentCount = 0;
    let adminsCount = 0;

    if (isTodayOrFuture && isNewOrChanged) {
      const teacherIds = Array.from(new Set([slot.teacherId, body.substituteTeacherId].filter(Boolean) as string[]));
      teachersCount = teacherIds.length;
      for (const tId of teacherIds) {
        await db.insert(notifications).values({
          tenantId,
          recipientId: tId,
          channel: 'in_app',
          template: `attendance_exception_${body.type.toLowerCase()}`,
          data: { slotId: slot.id, date: body.date, type: body.type, reason: body.reason, subject: slot.subjectName },
          status: 'sent',
          sentAt: new Date().toISOString(),
        });
      }

      const studentRows = await db
        .select({ id: user.id })
        .from(user)
        .where(and(
          eq(user.tenantId, tenantId),
          eq(user.classSectionId, slot.classSectionId),
          eq(user.role, 'student'),
          eq(user.userStatus, 'active'),
        ));
      studentsCount = studentRows.length;
      for (const s of studentRows) {
        await db.insert(notifications).values({
          tenantId,
          recipientId: s.id,
          channel: 'in_app',
          template: `attendance_exception_${body.type.toLowerCase()}`,
          data: { slotId: slot.id, date: body.date, type: body.type, reason: body.reason, subject: slot.subjectName },
          status: 'sent',
          sentAt: new Date().toISOString(),
        });
      }

      const studentIds = studentRows.map(s => s.id);
      if (studentIds.length > 0) {
        const guardianRows = await db
          .select({
            guardianId: guardianStudents.guardianId,
            userId: guardians.userId,
            phone: guardians.phone,
            smsOptIn: guardians.smsOptIn,
            preferredLanguage: guardians.preferredLanguage,
          })
          .from(guardianStudents)
          .innerJoin(guardians, eq(guardianStudents.guardianId, guardians.id))
          .where(and(eq(guardianStudents.tenantId, tenantId), inArray(guardianStudents.studentId, studentIds)));

        const uniqueGuardians = new Map<string, typeof guardianRows[number]>();
        for (const g of guardianRows) {
          if (!uniqueGuardians.has(g.guardianId)) {
            uniqueGuardians.set(g.guardianId, g);
          }
        }

        for (const g of uniqueGuardians.values()) {
          // In-app notification routes to guardians.userId so the bell icon displays it
          if (g.userId) {
            await db.insert(notifications).values({
              tenantId,
              recipientId: g.userId,
              channel: 'in_app',
              template: `attendance_exception_${body.type.toLowerCase()}`,
              data: { slotId: slot.id, date: body.date, type: body.type, reason: body.reason, subject: slot.subjectName },
              status: 'sent',
              sentAt: new Date().toISOString(),
            });
            guardiansCount++;
          } else {
            noAccountCount++;
          }

          // SMS dispatch with Law 09-08 consent and suppression checks
          if (body.type === 'CANCELLED' || body.type === 'RESCHEDULE') {
            if (!g.phone || !g.smsOptIn) {
              skippedNoConsentCount++;
              continue;
            }
            const consentDecision = await checkConsent(tenantId, 'guardian', g.guardianId, 'sms');
            if (!consentDecision.allowed) {
              skippedNoConsentCount++;
              continue;
            }

            const lang = g.preferredLanguage === 'ar' ? 'ar' : 'fr';
            const templateFn = EXCEPTION_SMS_TEMPLATES[lang][body.type];
            const smsText = templateFn({
              subject: slot.subjectName ?? 'cours',
              date: body.date,
              start: body.startTime,
              end: body.endTime,
            });

            const smsRes = await sendSmsMessage(tenantId, {
              to: g.phone,
              body: smsText,
              createdById: context.userId,
            });
            if (smsRes.delivery === 'sent') {
              smsStatus = 'sent';
            } else if (smsStatus !== 'sent' && smsRes.delivery === 'simulated') {
              smsStatus = 'simulated';
            }
          }
        }
      }

      const adminRows = await db
        .select({ id: user.id })
        .from(user)
        .where(and(
          eq(user.tenantId, tenantId),
          eq(user.role, 'school_admin'),
          slot.branchId ? or(eq(user.branchId, slot.branchId), isNull(user.branchId)) : undefined,
        ));
      adminsCount = adminRows.length;
      for (const a of adminRows) {
        await db.insert(notifications).values({
          tenantId,
          recipientId: a.id,
          channel: 'in_app',
          template: `attendance_exception_${body.type.toLowerCase()}`,
          data: { slotId: slot.id, date: body.date, type: body.type, reason: body.reason, subject: slot.subjectName },
          status: 'sent',
          sentAt: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: exception,
      notified: {
        teachers: teachersCount,
        students: studentsCount,
        guardians: guardiansCount,
        noAccount: noAccountCount,
        admins: adminsCount,
        sms: smsStatus,
        skippedNoConsent: skippedNoConsentCount,
      },
      message: 'Exception enregistrée.',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'attendance.manage');

    const { searchParams } = new URL(request.url);
    const slotId = searchParams.get('classScheduleSlotId');
    const date = searchParams.get('date');

    if (!slotId || !date) {
      throw new ApiError(422, 'MISSING_SCOPE', 'Le créneau et la date sont requis.');
    }

    const [slot] = await db
      .select({
        id: classScheduleSlots.id,
        teacherId: classScheduleSlots.teacherId,
        classSectionId: classScheduleSlots.classSectionId,
        branchId: classes.branchId,
        subjectName: subjects.name,
      })
      .from(classScheduleSlots)
      .innerJoin(classSections, eq(classScheduleSlots.classSectionId, classSections.id))
      .innerJoin(classes, eq(classSections.classId, classes.id))
      .leftJoin(classSubjects, eq(classScheduleSlots.classSubjectId, classSubjects.id))
      .leftJoin(subjects, eq(classSubjects.subjectId, subjects.id))
      .where(and(eq(classScheduleSlots.id, slotId), eq(classScheduleSlots.tenantId, tenantId)))
      .limit(1);

    // Removing an exception is campus data too; the same guard as creating one.
    if (slot) {
      assertBranchScope(context, slot.branchId);
    }

    const deleted = await db
      .delete(classSessionExceptions)
      .where(and(
        eq(classSessionExceptions.tenantId, tenantId),
        eq(classSessionExceptions.classScheduleSlotId, slotId),
        eq(classSessionExceptions.date, date),
      ))
      .returning({ id: classSessionExceptions.id, type: classSessionExceptions.type });

    if (deleted.length === 0) {
      throw new ApiError(404, 'NOT_FOUND', 'Aucune exception à retirer pour cette séance.');
    }

    recordAudit(context, 'delete', 'class_session_exception', deleted[0]!.id, { date, slotId });

    const shouldSendReinstatementSms = deleted[0]!.type === 'CANCELLED' || deleted[0]!.type === 'RESCHEDULE';
    const today = casablancaTodayIso();
    const isTodayOrFuture = date >= today;
    let smsStatus: 'sent' | 'simulated' | 'skipped' = 'skipped';
    let teachersCount = 0;
    let studentsCount = 0;
    let guardiansCount = 0;
    let noAccountCount = 0;
    let skippedNoConsentCount = 0;
    let adminsCount = 0;

    if (isTodayOrFuture && slot) {
      const teacherIds = [slot.teacherId].filter(Boolean);
      teachersCount = teacherIds.length;
      for (const tId of teacherIds) {
        await db.insert(notifications).values({
          tenantId,
          recipientId: tId,
          channel: 'in_app',
          template: 'attendance_exception_reinstated',
          data: { slotId: slot.id, date, subject: slot.subjectName },
          status: 'sent',
          sentAt: new Date().toISOString(),
        });
      }

      const studentRows = await db
        .select({ id: user.id })
        .from(user)
        .where(and(
          eq(user.tenantId, tenantId),
          eq(user.classSectionId, slot.classSectionId),
          eq(user.role, 'student'),
          eq(user.userStatus, 'active'),
        ));
      studentsCount = studentRows.length;
      for (const s of studentRows) {
        await db.insert(notifications).values({
          tenantId,
          recipientId: s.id,
          channel: 'in_app',
          template: 'attendance_exception_reinstated',
          data: { slotId: slot.id, date, subject: slot.subjectName },
          status: 'sent',
          sentAt: new Date().toISOString(),
        });
      }

      const studentIds = studentRows.map(s => s.id);
      if (studentIds.length > 0) {
        const guardianRows = await db
          .select({
            guardianId: guardianStudents.guardianId,
            userId: guardians.userId,
            phone: guardians.phone,
            smsOptIn: guardians.smsOptIn,
            preferredLanguage: guardians.preferredLanguage,
          })
          .from(guardianStudents)
          .innerJoin(guardians, eq(guardianStudents.guardianId, guardians.id))
          .where(and(eq(guardianStudents.tenantId, tenantId), inArray(guardianStudents.studentId, studentIds)));

        const uniqueGuardians = new Map<string, typeof guardianRows[number]>();
        for (const g of guardianRows) {
          if (!uniqueGuardians.has(g.guardianId)) {
            uniqueGuardians.set(g.guardianId, g);
          }
        }

        for (const g of uniqueGuardians.values()) {
          if (g.userId) {
            await db.insert(notifications).values({
              tenantId,
              recipientId: g.userId,
              channel: 'in_app',
              template: 'attendance_exception_reinstated',
              data: { slotId: slot.id, date, subject: slot.subjectName },
              status: 'sent',
              sentAt: new Date().toISOString(),
            });
            guardiansCount++;
          } else {
            noAccountCount++;
          }

          if (shouldSendReinstatementSms) {
            if (!g.phone || !g.smsOptIn) {
              skippedNoConsentCount++;
              continue;
            }
            const consentDecision = await checkConsent(tenantId, 'guardian', g.guardianId, 'sms');
            if (!consentDecision.allowed) {
              skippedNoConsentCount++;
              continue;
            }

            const lang = g.preferredLanguage === 'ar' ? 'ar' : 'fr';
            const smsText = EXCEPTION_SMS_TEMPLATES[lang].REINSTATED({
              subject: slot.subjectName ?? 'cours',
              date,
            });

            const smsRes = await sendSmsMessage(tenantId, {
              to: g.phone,
              body: smsText,
              createdById: context.userId,
            });
            if (smsRes.delivery === 'sent') {
              smsStatus = 'sent';
            } else if (smsStatus !== 'sent' && smsRes.delivery === 'simulated') {
              smsStatus = 'simulated';
            }
          }
        }
      }

      const adminRows = await db
        .select({ id: user.id })
        .from(user)
        .where(and(
          eq(user.tenantId, tenantId),
          eq(user.role, 'school_admin'),
          slot.branchId ? or(eq(user.branchId, slot.branchId), isNull(user.branchId)) : undefined,
        ));
      adminsCount = adminRows.length;
      for (const a of adminRows) {
        await db.insert(notifications).values({
          tenantId,
          recipientId: a.id,
          channel: 'in_app',
          template: 'attendance_exception_reinstated',
          data: { slotId: slot.id, date, subject: slot.subjectName },
          status: 'sent',
          sentAt: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({
      success: true,
      notified: {
        teachers: teachersCount,
        students: studentsCount,
        guardians: guardiansCount,
        noAccount: noAccountCount,
        admins: adminsCount,
        sms: smsStatus,
        skippedNoConsent: skippedNoConsentCount,
      },
      message: 'Exception retirée : la séance reprend l’emploi du temps.',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
