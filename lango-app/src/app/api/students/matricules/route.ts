import { and, count, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { previewMatricule, reserveMatricule } from '@/libs/services/matricule';
import { user } from '@/models/Schema';

const updateStudentMatriculeSchema = z.object({
  studentId: z.string().min(1),
  matricule: z.string().trim().max(50).nullable().optional(),
  codeMassar: z.string().trim().max(100).nullable().optional(),
  useNextGenerated: z.boolean().optional(),
}).strict();

// GET is a non-mutating preview: it returns the next matricule that *would* be
// reserved without touching the counter, along with school-wide matricule & Massar stats.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);

    const [nextMatricule, [stats]] = await Promise.all([
      previewMatricule(db, tenantId),
      db
        .select({
          total: count(),
          assigned: count(sql`CASE WHEN ${user.matricule} IS NOT NULL AND ${user.matricule} != '' THEN 1 END`),
          missing: count(sql`CASE WHEN ${user.matricule} IS NULL OR ${user.matricule} = '' THEN 1 END`),
          assignedMassar: count(sql`CASE WHEN ${user.nationalId} IS NOT NULL AND ${user.nationalId} != '' THEN 1 END`),
          missingMassar: count(sql`CASE WHEN ${user.nationalId} IS NULL OR ${user.nationalId} = '' THEN 1 END`),
        })
        .from(user)
        .where(and(eq(user.role, 'student'), eq(user.tenantId, tenantId))),
    ]);

    return NextResponse.json({
      success: true,
      matricule: nextMatricule,
      stats: {
        total: Number(stats?.total ?? 0),
        assigned: Number(stats?.assigned ?? 0),
        missing: Number(stats?.missing ?? 0),
        assignedMassar: Number(stats?.assignedMassar ?? 0),
        missingMassar: Number(stats?.missingMassar ?? 0),
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// POST actually reserves (increments and persists) the next matricule.
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);

    const nextMatricule = await db.transaction(tx => reserveMatricule(tx, tenantId));

    recordAudit(context, 'create', 'naming_series', `STD-${new Date().getFullYear()}-`);

    return NextResponse.json({
      success: true,
      matricule: nextMatricule,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// PATCH updates an individual student's internal matricule and/or Code Massar.
export async function PATCH(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'students.update');
    const body = await parseJson(request, updateStudentMatriculeSchema);

    let newMatricule = body.matricule;
    if (body.useNextGenerated) {
      newMatricule = await db.transaction(tx => reserveMatricule(tx, tenantId));
    }

    const patch: Record<string, any> = { updatedAt: sql`now()` };
    if (newMatricule !== undefined) {
      patch.matricule = newMatricule;
    }
    if (body.codeMassar !== undefined) {
      patch.nationalId = body.codeMassar;
    }

    const [updated] = await db
      .update(user)
      .set(patch)
      .where(and(eq(user.id, body.studentId), eq(user.tenantId, tenantId), eq(user.role, 'student')))
      .returning({ id: user.id, name: user.name, matricule: user.matricule, nationalId: user.nationalId });

    if (!updated) {
      throw new ApiError(404, 'NOT_FOUND', 'Élève non trouvé');
    }

    recordAudit(context, 'update', 'student_matricule', body.studentId, patch);

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        fullName: updated.name,
        matricule: updated.matricule,
        codeMassar: updated.nationalId,
      },
      message: 'Identifiants de l\'élève mis à jour avec succès',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
