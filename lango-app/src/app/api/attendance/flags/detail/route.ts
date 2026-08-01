import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { attendance, attendanceExcuses, attendanceFlags, attendanceSummary, guardians, guardianStudents, smsMessages, user } from '@/models/Schema';

const RECOMMENDED_ACTION: Record<string, string> = {
  CONSECUTIVE_ABSENCE: 'Entretien avec les parents + plan de suivi',
  UNJUSTIFIED_ABSENCE: 'Contacter le tuteur pour obtenir une justification',
  REPEATED_LATE: "Avertissement écrit + suivi hebdomadaire de l'assiduité",
};

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, message: 'id requis' }, { status: 400 });
    }

    const [flag] = await db
      .select({
        id: attendanceFlags.id,
        studentId: attendanceFlags.studentId,
        studentName: user.name,
        type: attendanceFlags.type,
        status: attendanceFlags.status,
        severity: attendanceFlags.severity,
        assignedToId: attendanceFlags.assignedToId,
        detectedAt: attendanceFlags.detectedAt,
        resolvedAt: attendanceFlags.resolvedAt,
      })
      .from(attendanceFlags)
      .innerJoin(user, eq(attendanceFlags.studentId, user.id))
      .where(and(eq(attendanceFlags.id, id), eq(attendanceFlags.tenantId, tenantId)))
      .limit(1);

    if (!flag) {
      return NextResponse.json({ success: false, message: 'Signalement introuvable' }, { status: 404 });
    }

    const detectedDate = flag.detectedAt.slice(0, 10);

    const [assignedTo, guardian, recentEvents, linkedExcuse, smsHistory] = await Promise.all([
      flag.assignedToId
        ? db.select({ id: user.id, name: user.name }).from(user).where(eq(user.id, flag.assignedToId)).limit(1).then(r => r[0] ?? null)
        : Promise.resolve(null),
      db
        .select({ name: guardians.firstName, lastName: guardians.lastName, phone: guardians.phone, email: guardians.email })
        .from(guardianStudents)
        .innerJoin(guardians, eq(guardianStudents.guardianId, guardians.id))
        .where(and(eq(guardianStudents.tenantId, tenantId), eq(guardianStudents.studentId, flag.studentId)))
        .orderBy(desc(guardianStudents.isPrimaryContact))
        .limit(1)
        .then(r => r[0] ?? null),
      db
        .select({ date: attendance.date, status: attendance.status, lateMinutes: attendance.lateMinutes, note: attendance.note })
        .from(attendance)
        .where(and(eq(attendance.tenantId, tenantId), eq(attendance.studentId, flag.studentId), eq(attendance.isVoided, false)))
        .orderBy(desc(attendance.date))
        .limit(10),
      db
        .select({ id: attendanceExcuses.id, status: attendanceExcuses.status, documentUrl: attendanceExcuses.documentUrl, reason: attendanceExcuses.reason })
        .from(attendanceExcuses)
        .where(and(eq(attendanceExcuses.tenantId, tenantId), eq(attendanceExcuses.studentId, flag.studentId), eq(attendanceExcuses.date, detectedDate)))
        .limit(1)
        .then(r => r[0] ?? null),
      db
        .select({ id: smsMessages.id, body: smsMessages.body, status: smsMessages.status, sentAt: smsMessages.sentAt, recipientPhone: smsMessages.recipientPhone })
        .from(smsMessages)
        .where(and(eq(smsMessages.tenantId, tenantId), eq(smsMessages.studentId, flag.studentId)))
        .orderBy(desc(smsMessages.createdAt))
        .limit(10),
    ]);

    const [summaryRow] = await db
      .select({ attendanceRate: attendanceSummary.attendanceRate })
      .from(attendanceSummary)
      .where(and(eq(attendanceSummary.tenantId, tenantId), eq(attendanceSummary.studentId, flag.studentId)))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: {
        ...flag,
        assignedToName: assignedTo?.name ?? null,
        guardianName: guardian ? `${guardian.name} ${guardian.lastName}`.trim() : null,
        guardianPhone: guardian?.phone ?? null,
        guardianEmail: guardian?.email ?? null,
        attendanceRate: summaryRow?.attendanceRate ? Number(summaryRow.attendanceRate) : null,
        recentEvents,
        linkedExcuse,
        smsHistory,
        recommendedAction: RECOMMENDED_ACTION[flag.type] ?? null,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
