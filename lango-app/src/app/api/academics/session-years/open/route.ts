import { and, count, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { getCurrentSessionYear } from '@/libs/services/school-year';
import { feeStructures, sessionYears, studentPlacements, timetableVersions } from '@/models/Schema';

/**
 * "Ouvrir la nouvelle année scolaire" — OD1.
 *
 * Rolling the school year over used to be an implicit side effect of the
 * calendar: whichever year's date range contained today became "current". That
 * silently moved the whole app on 1 September with nothing prepared. Switching
 * is now a deliberate act with a checklist in front of it.
 *
 * GET  ?preview=1&sessionYearId=…  read-only checklist (never writes)
 * POST { sessionYearId }           make that year the current one
 *
 * The checklist WARNS, it does not block: a director may legitimately open the
 * year before the timetable is published. It exists so the decision is informed.
 */

const openYearSchema = z.object({ sessionYearId: z.string().uuid() }).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'academics.manage');

    const { searchParams } = new URL(request.url);
    const sessionYearId = searchParams.get('sessionYearId');
    if (!sessionYearId) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'sessionYearId est requis.' } },
        { status: 400 },
      );
    }

    const [target] = await db
      .select()
      .from(sessionYears)
      .where(and(eq(sessionYears.id, sessionYearId), eq(sessionYears.tenantId, tenantId)))
      .limit(1);

    // Cross-tenant ids are indistinguishable from unknown ones on purpose.
    if (!target) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Année scolaire introuvable.' } },
        { status: 404 },
      );
    }

    const current = await getCurrentSessionYear(tenantId);

    const [placedRows, publishedRows, feeRows] = await Promise.all([
      db
        .select({ total: count() })
        .from(studentPlacements)
        .where(and(
          eq(studentPlacements.tenantId, tenantId),
          eq(studentPlacements.sessionYearId, target.id),
        )),
      db
        .select({
          versionNumber: timetableVersions.versionNumber,
          publishedAt: timetableVersions.publishedAt,
        })
        .from(timetableVersions)
        .where(and(
          eq(timetableVersions.tenantId, tenantId),
          eq(timetableVersions.sessionYearId, target.id),
          eq(timetableVersions.status, 'published'),
        ))
        .orderBy(desc(timetableVersions.versionNumber))
        .limit(1),
      // NOTE: fee_structures carries no session_year_id (it scopes by program /
      // academic term / branch), so this counts the tenant's ACTIVE structures
      // rather than a year-specific set. Reported as such in the payload so the
      // UI cannot imply a link the schema does not have.
      db
        .select({ total: count() })
        .from(feeStructures)
        .where(and(eq(feeStructures.tenantId, tenantId), eq(feeStructures.isActive, true))),
    ]);

    const studentsPlaced = placedRows[0]?.total ?? 0;
    const published = publishedRows[0] ?? null;
    const activeFeeStructures = feeRows[0]?.total ?? 0;

    return NextResponse.json({
      success: true,
      data: {
        target: {
          id: target.id,
          name: target.name,
          startDate: target.startDate,
          endDate: target.endDate,
          isDefault: target.isDefault,
        },
        current,
        checks: {
          // The only check that is a real precondition: opening an earlier year
          // would move the school backwards.
          startsAfterCurrent: current ? target.startDate > current.startDate : true,
          studentsPlacedInTarget: studentsPlaced,
          publishedTimetable: published
            ? { exists: true, versionNumber: published.versionNumber, publishedAt: published.publishedAt }
            : { exists: false, versionNumber: null, publishedAt: null },
          activeFeeStructures,
          activeFeeStructuresScope: 'tenant' as const,
        },
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'academics.manage');
    const body = await parseJson(request, openYearSchema);

    const [target] = await db
      .select()
      .from(sessionYears)
      .where(and(eq(sessionYears.id, body.sessionYearId), eq(sessionYears.tenantId, tenantId)))
      .limit(1);

    if (!target) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Année scolaire introuvable.' } },
        { status: 404 },
      );
    }

    const previous = await getCurrentSessionYear(tenantId);

    if (previous?.id === target.id) {
      return NextResponse.json({ success: true, data: { id: target.id, alreadyCurrent: true } });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(sessionYears)
        .set({ isDefault: false })
        .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.isDefault, true)));
      await tx
        .update(sessionYears)
        .set({ isDefault: true })
        .where(and(eq(sessionYears.id, target.id), eq(sessionYears.tenantId, tenantId)));
    });

    recordAudit(context, 'update', 'session_year', target.id, {
      action: 'open_session_year',
      changed: { isDefault: { before: false, after: true } },
      previousDefaultYearId: previous?.id ?? null,
      newDefaultYearId: target.id,
    });

    return NextResponse.json({
      success: true,
      data: { id: target.id, name: target.name, previousDefaultYearId: previous?.id ?? null },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
