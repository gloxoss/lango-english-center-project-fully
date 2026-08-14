import { and, eq, gte } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { computeHmacHash } from '@/libs/api/badge-crypto';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { getEffectiveValueWithLegacyFallback } from '@/libs/settings/registry';
import {
  attendance,
  attendanceRegisters,
  attendanceScanEvents,
  classSections,
  identityBadgeCredentials,
  scannerSessions,
  user,
} from '@/models/Schema';

const DEFAULT_TIMEZONE = 'Africa/Casablanca';

// Returns a Date whose UTC fields carry the tenant's wall-clock time, so date /
// lateness decisions are made in the school's timezone, not the server's.
function nowInTimezone(timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string): number => Number(parts.find(p => p.type === type)?.value ?? '0');
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')));
}

// Before (period start + grace): present. After: late.
function computeStagedStatus(tenantNow: Date, periodStart: string, graceMinutes: number): 'present' | 'late' {
  const [hRaw = '08', mRaw = '00'] = periodStart.split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  const threshold = new Date(tenantNow);
  threshold.setUTCHours(h, m + graceMinutes, 0, 0);
  return tenantNow.getTime() <= threshold.getTime() ? 'present' : 'late';
}

const verifyQrSchema = z.object({
  rawToken: z.string().trim().min(1),
  classSectionId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  period: z.number().int().min(1).max(12).optional().default(1),
  idempotencyKey: z.string().max(255).optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'attendance.manage');
    const body = await parseJson(request, verifyQrSchema);

    // Compute HMAC hash of incoming raw token
    const tokenHash = computeHmacHash(body.rawToken);

    // Resolve credential strictly by (tenantId, tokenHash) — never by name/id
    const [badge] = await db
      .select()
      .from(identityBadgeCredentials)
      .where(
        and(
          eq(identityBadgeCredentials.tenantId, tenantId),
          eq(identityBadgeCredentials.tokenHash, tokenHash)
        )
      )
      .limit(1);

    const recordRejected = (
      rejectionReason: string,
      overrides: Partial<typeof attendanceScanEvents.$inferInsert> = {},
    ) => db.insert(attendanceScanEvents).values({
      tenantId,
      sessionId: body.sessionId || null,
      classSectionId: body.classSectionId || null,
      resultStatus: 'rejected',
      rejectionReason,
      idempotencyKey: body.idempotencyKey || null,
      ...overrides,
    });

    if (!badge) {
      await recordRejected('INVALID_CREDENTIAL');
      throw new ApiError(404, 'BADGE_INVALID', 'Badge QR non reconnu ou expiré.');
    }

    if (badge.status !== 'active') {
      await recordRejected(`BADGE_${badge.status.toUpperCase()}`, {
        credentialId: badge.id,
        studentId: badge.userId,
      });

      throw new ApiError(422, `BADGE_${badge.status.toUpperCase()}`, `Ce badge est ${badge.status}.`);
    }

    // Resolve user details (tenant-scoped)
    const [scannedUser] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        classSectionId: user.classSectionId,
      })
      .from(user)
      .where(and(eq(user.id, badge.userId), eq(user.tenantId, tenantId)))
      .limit(1);

    if (!scannedUser) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'Élève / Utilisateur introuvable.');
    }

    // Resolve the class context: an active scanner session wins (it carries the
    // roster-scoped classSectionId), otherwise fall back to body.classSectionId.
    let resolvedClassSectionId: string | null = body.classSectionId ?? null;
    if (body.sessionId) {
      const [session] = await db
        .select()
        .from(scannerSessions)
        .where(and(eq(scannerSessions.id, body.sessionId), eq(scannerSessions.tenantId, tenantId)))
        .limit(1);

      if (!session) {
        await recordRejected('SESSION_INVALID');
        throw new ApiError(404, 'SESSION_NOT_FOUND', 'Session de scan introuvable.');
      }
      if (session.status !== 'active' || (session.endedAt && session.endedAt !== null)) {
        await recordRejected('SESSION_CLOSED');
        throw new ApiError(409, 'SESSION_CLOSED', 'Session de scan fermée.');
      }
      if (session.classSectionId) {
        resolvedClassSectionId = session.classSectionId;
      }
    }

    if (!resolvedClassSectionId) {
      await recordRejected('CLASS_CONTEXT_REQUIRED');
      throw new ApiError(400, 'CLASS_CONTEXT_REQUIRED', 'Une classe (ou session de scan) est requise pour valider le badge.');
    }

    // Validate the class section belongs to this tenant and resolve its classId
    const [section] = await db
      .select({ id: classSections.id, classId: classSections.classId })
      .from(classSections)
      .where(and(eq(classSections.id, resolvedClassSectionId), eq(classSections.tenantId, tenantId)))
      .limit(1);

    if (!section) {
      await recordRejected('INVALID_CLASS');
      throw new ApiError(404, 'CLASS_NOT_FOUND', 'Classe/section introuvable pour cet établissement.');
    }

    // Roster check: the scanned student's real class-section must match the one
    // the scan targets. Unplaced students cannot be staged either.
    if (scannedUser.classSectionId !== resolvedClassSectionId) {
      await recordRejected('WRONG_CLASS', {
        credentialId: badge.id,
        studentId: scannedUser.id,
        classSectionId: resolvedClassSectionId,
      });
      throw new ApiError(422, 'WRONG_CLASS', `Ce badge (${scannedUser.name}) n'appartient pas à cette classe/section.`);
    }

    const [tzEff, graceEff, periodEff] = await Promise.all([
      getEffectiveValueWithLegacyFallback(tenantId, null, 'localization.timezone'),
      getEffectiveValueWithLegacyFallback(tenantId, null, 'attendance.lateGraceMinutes'),
      getEffectiveValueWithLegacyFallback(tenantId, null, 'attendance.periodStartTime'),
    ]);
    const localeTimezone = (tzEff.value as string) || DEFAULT_TIMEZONE;
    const graceMinutes = typeof graceEff.value === 'number' ? graceEff.value : 15;
    const periodStart = (periodEff.value as string) || '08:00';

    const tenantNow = nowInTimezone(localeTimezone);
    const targetDate = tenantNow.toISOString().slice(0, 10);
    const period = body.period;

    // Locked-register check: a LOCKED register (outside a REOPENED window) cannot be mutated.
    const [register] = await db
      .select({ id: attendanceRegisters.id, status: attendanceRegisters.status, reference: attendanceRegisters.reference })
      .from(attendanceRegisters)
      .where(and(
        eq(attendanceRegisters.tenantId, tenantId),
        eq(attendanceRegisters.classId, section.classId),
        eq(attendanceRegisters.date, targetDate),
        eq(attendanceRegisters.period, period),
      ))
      .limit(1);

    if (register && register.status === 'LOCKED') {
      await recordRejected('REGISTER_LOCKED', {
        credentialId: badge.id,
        studentId: scannedUser.id,
        classSectionId: resolvedClassSectionId,
        registerId: register.id,
      });
      throw new ApiError(409, 'REGISTER_LOCKED', `Le registre (${register.reference}) est verrouillé.`);
    }

    // Idempotency: an already-accepted scan of the same credential in the same
    // session (or same class-section today) must not stage a second attendance row.
    const dupConditions = [
      eq(attendanceScanEvents.tenantId, tenantId),
      eq(attendanceScanEvents.credentialId, badge.id),
      eq(attendanceScanEvents.resultStatus, 'accepted'),
    ];
    if (body.sessionId) {
      dupConditions.push(eq(attendanceScanEvents.sessionId, body.sessionId));
    } else {
      dupConditions.push(
        eq(attendanceScanEvents.classSectionId, resolvedClassSectionId),
        gte(attendanceScanEvents.scannedAt, `${targetDate}T00:00:00.000Z`),
      );
    }

    const [duplicateEvent] = await db
      .select()
      .from(attendanceScanEvents)
      .where(and(...dupConditions))
      .limit(1);

    if (duplicateEvent) {
      // Log the duplicate attempt as its own scan event so the audit trail and
      // the "Déjà scannés" aggregate stay meaningful. No attendance row is
      // written and already_scanned events never feed the duplicate check
      // (which filters on 'accepted'), so idempotency is preserved.
      const [duplicateScanEvent] = await db
        .insert(attendanceScanEvents)
        .values({
          tenantId,
          sessionId: body.sessionId || null,
          credentialId: badge.id,
          studentId: scannedUser.id,
          classSectionId: resolvedClassSectionId,
          registerId: register?.id ?? null,
          resultStatus: 'already_scanned',
          stagedStatus: duplicateEvent.stagedStatus || null,
          idempotencyKey: body.idempotencyKey || null,
        })
        .returning();

      return NextResponse.json({
        success: true,
        data: {
          student: {
            id: scannedUser.id,
            name: scannedUser.name,
            email: scannedUser.email,
            image: scannedUser.image,
          },
          stagedStatus: duplicateEvent.stagedStatus || 'present',
          scanEvent: duplicateScanEvent,
          resultStatus: 'already_scanned',
        },
      });
    }

    const stagedStatus = computeStagedStatus(tenantNow, periodStart, graceMinutes);

    const staged = await db.transaction(async (tx) => {
      const [scanEvent] = await tx
        .insert(attendanceScanEvents)
        .values({
          tenantId,
          sessionId: body.sessionId || null,
          credentialId: badge.id,
          studentId: scannedUser.id,
          classSectionId: resolvedClassSectionId,
          registerId: register?.id ?? null,
          resultStatus: 'accepted',
          stagedStatus,
          idempotencyKey: body.idempotencyKey || null,
        })
        .returning();

      // Upsert the real attendance row for (classId, date, period) so a scan both
      // stages and overwrites cleanly without duplicating rows.
      const [existing] = await tx
        .select({ id: attendance.id })
        .from(attendance)
        .where(and(
          eq(attendance.tenantId, tenantId),
          eq(attendance.studentId, scannedUser.id),
          eq(attendance.studentGroupId, section.classId),
          eq(attendance.date, targetDate),
          eq(attendance.period, period),
        ))
        .limit(1);

      const attendanceRow = existing
        ? (await tx
            .update(attendance)
            .set({
              status: stagedStatus,
              markedById: context.userId,
              scanEventId: scanEvent!.id,
              isVoided: false,
              lateMinutes: stagedStatus === 'late' ? 0 : null,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(attendance.id, existing.id))
            .returning())[0]
        : (await tx
            .insert(attendance)
            .values({
              tenantId,
              studentId: scannedUser.id,
              studentGroupId: section.classId,
              period,
              date: targetDate,
              status: stagedStatus,
              markedById: context.userId,
              isVoided: false,
              registerId: register?.id ?? null,
              scanEventId: scanEvent!.id,
            })
            .returning())[0];

      // Complete the evidence chain: scan event -> attendance row.
      await tx
        .update(attendanceScanEvents)
        .set({ attendanceRecordId: attendanceRow!.id })
        .where(eq(attendanceScanEvents.id, scanEvent!.id));

      return { scanEvent: scanEvent!, attendanceRow: attendanceRow! };
    });

    recordAudit(context, 'create', 'attendance_scan', staged.scanEvent.id, {
      stagedStatus,
      classSectionId: resolvedClassSectionId,
      period,
    });

    return NextResponse.json({
      success: true,
      data: {
        student: {
          id: scannedUser.id,
          name: scannedUser.name,
          email: scannedUser.email,
          image: scannedUser.image,
        },
        stagedStatus,
        scanEvent: staged.scanEvent,
        attendance: staged.attendanceRow,
        resultStatus: 'accepted',
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
