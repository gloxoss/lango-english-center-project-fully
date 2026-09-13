import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import {
  totalWeight,
  validateCoefficientSet,
} from '@/features/academics/services/filiere-structure';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson, streamCoefficientsSchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { streams, streamSubjectCoefficients, subjects } from '@/models/Schema';

/** Proves the filière belongs to the caller's school before anything else runs. */
async function requireOwnFiliere(tenantId: string, streamId: string) {
  const [filiere] = await db
    .select()
    .from(streams)
    .where(and(eq(streams.id, streamId), eq(streams.tenantId, tenantId)))
    .limit(1);

  if (!filiere) {
    throw new ApiError(404, 'NOT_FOUND', 'Filière introuvable.');
  }

  return filiere;
}

/** The coefficient table for one filière, with subject names for display. */
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'academics.read');

    const streamId = new URL(request.url).searchParams.get('streamId');
    if (!streamId) {
      throw new ApiError(400, 'BAD_REQUEST', 'L\'identifiant de la filière est requis.');
    }

    const filiere = await requireOwnFiliere(tenantId, streamId);

    const rows = await db
      .select({
        subjectId: streamSubjectCoefficients.subjectId,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        coefficient: streamSubjectCoefficients.coefficient,
        isCore: streamSubjectCoefficients.isCore,
      })
      .from(streamSubjectCoefficients)
      .innerJoin(subjects, eq(subjects.id, streamSubjectCoefficients.subjectId))
      .where(and(
        eq(streamSubjectCoefficients.tenantId, tenantId),
        eq(streamSubjectCoefficients.streamId, streamId),
      ))
      .orderBy(subjects.name);

    const coefficients = rows.map(r => ({ ...r, coefficient: Number(r.coefficient) }));

    return NextResponse.json({
      success: true,
      data: {
        stream: { id: filiere.id, name: filiere.name, code: filiere.code, cycle: filiere.cycle },
        coefficients,
        // The denominator of the moyenne générale, returned so the UI can show it
        // rather than each client re-deriving it.
        totalWeight: totalWeight(coefficients),
        coreSubjectCount: coefficients.filter(c => c.isCore).length,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/**
 * Replaces a filière's whole coefficient set.
 *
 * Replace rather than merge, in one transaction: a coefficient table is read as a
 * whole when computing an average, so a half-applied edit would produce a
 * plausible but wrong moyenne for every student in the filière.
 */
export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'academics.manage');

    const body = await parseJson(request, streamCoefficientsSchema);
    await requireOwnFiliere(tenantId, body.streamId);

    const incoming = body.coefficients.map(c => ({
      subjectId: c.subjectId,
      coefficient: c.coefficient,
      isCore: c.isCore ?? false,
    }));

    const issues = validateCoefficientSet(incoming);
    if (issues.length > 0) {
      throw new ApiError(422, issues[0]!.code, issues[0]!.message);
    }

    // Every subject must belong to this school. Without this a caller could
    // attach another tenant's subject id to their own filière and learn that it
    // exists.
    const subjectIds = [...new Set(incoming.map(c => c.subjectId))];
    const owned = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.tenantId, tenantId)));
    const ownedIds = new Set(owned.map(s => s.id));

    const foreign = subjectIds.filter(id => !ownedIds.has(id));
    if (foreign.length > 0) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Une ou plusieurs matières n\'appartiennent pas à cet établissement.');
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(streamSubjectCoefficients)
        .where(and(
          eq(streamSubjectCoefficients.tenantId, tenantId),
          eq(streamSubjectCoefficients.streamId, body.streamId),
        ));

      await tx.insert(streamSubjectCoefficients).values(incoming.map(c => ({
        tenantId,
        streamId: body.streamId,
        subjectId: c.subjectId,
        coefficient: c.coefficient.toFixed(2),
        isCore: c.isCore,
      })));
    });

    recordAudit(context, 'update', 'stream_coefficients', body.streamId, { count: incoming.length });

    return NextResponse.json({
      success: true,
      data: { streamId: body.streamId, count: incoming.length, totalWeight: totalWeight(incoming) },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
