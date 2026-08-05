import { and, desc, eq, max } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { classScheduleSlots, sessionYears, timetableVersions } from '@/models/Schema';

export const timetableVersionCreateSchema = z.object({
  sessionYearId: z.string().uuid({ message: 'L\'identifiant de la session est requis.' }),
  copiedFromVersionId: z.string().uuid().optional().nullable(),
  effectiveFrom: z.string().optional().nullable(),
  effectiveTo: z.string().optional().nullable(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    await requireCapability(context, 'academics.read');
    const tenantId = requireTenant(context);

    const { searchParams } = new URL(request.url);
    const sessionYearId = searchParams.get('sessionYearId');

    if (!sessionYearId) {
      throw new ApiError(400, 'BAD_REQUEST', 'L\'identifiant de la session (sessionYearId) est requis.');
    }

    const rows = await db
      .select()
      .from(timetableVersions)
      .where(and(eq(timetableVersions.tenantId, tenantId), eq(timetableVersions.sessionYearId, sessionYearId)))
      .orderBy(desc(timetableVersions.versionNumber));

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    await requireCapability(context, 'academics.manage');
    const tenantId = requireTenant(context);

    const body = await parseJson(request, timetableVersionCreateSchema);

    // Verify session belongs to tenant
    const [session] = await db
      .select({ id: sessionYears.id })
      .from(sessionYears)
      .where(and(eq(sessionYears.id, body.sessionYearId), eq(sessionYears.tenantId, tenantId)))
      .limit(1);

    if (!session) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'La session académique est introuvable.');
    }

    // Determine next version number
    const [maxVersion] = await db
      .select({ maxNum: max(timetableVersions.versionNumber) })
      .from(timetableVersions)
      .where(and(eq(timetableVersions.tenantId, tenantId), eq(timetableVersions.sessionYearId, body.sessionYearId)));

    const nextVersionNumber = (maxVersion?.maxNum ?? 0) + 1;

    const result = await db.transaction(async (tx) => {
      const [newVersion] = await tx
        .insert(timetableVersions)
        .values({
          tenantId,
          sessionYearId: body.sessionYearId,
          status: 'draft',
          versionNumber: nextVersionNumber,
          effectiveFrom: body.effectiveFrom ?? null,
          effectiveTo: body.effectiveTo ?? null,
          createdBy: context.userId,
          copiedFromVersionId: body.copiedFromVersionId ?? null,
        })
        .returning();

      // Clone slots from source version if requested
      if (body.copiedFromVersionId) {
        const sourceSlots = await tx
          .select()
          .from(classScheduleSlots)
          .where(and(eq(classScheduleSlots.tenantId, tenantId), eq(classScheduleSlots.versionId, body.copiedFromVersionId)));

        for (const slot of sourceSlots) {
          await tx.insert(classScheduleSlots).values({
            tenantId,
            classSectionId: slot.classSectionId,
            classSubjectId: slot.classSubjectId,
            teacherId: slot.teacherId,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            roomLabel: slot.roomLabel,
            offeringId: slot.offeringId,
            versionId: newVersion!.id,
          });
        }
      }

      recordAudit(context, 'create', 'timetable_version', newVersion!.id);

      return newVersion!;
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
