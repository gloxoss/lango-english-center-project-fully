import { and, count, eq, ne, sql } from 'drizzle-orm';
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

const MASSAR_CODE_REGEX = /^[A-Z]\d{9}$/i;

// GET is a non-mutating preview: returns the next matricule that *would* be
// generated without consuming or mutating any sequence counter, along with
// authoritative school-wide matricule & Code Massar stats.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);

    const conditions = [
      eq(user.role, 'student'),
      eq(user.tenantId, tenantId),
    ];
    if (context.branchId) {
      conditions.push(eq(user.branchId, context.branchId));
    }

    const [nextMatricule, [stats]] = await Promise.all([
      previewMatricule(db, tenantId),
      db
        .select({
          total: count(),
          assigned: count(sql`CASE WHEN ${user.matricule} IS NOT NULL AND ${user.matricule} != '' THEN 1 END`),
          missing: count(sql`CASE WHEN ${user.matricule} IS NULL OR ${user.matricule} = '' THEN 1 END`),
          assignedMassar: count(sql`CASE WHEN ${user.nationalId} IS NOT NULL AND ${user.nationalId} != '' THEN 1 END`),
          missingMassar: count(sql`CASE WHEN ${user.nationalId} IS NULL OR ${user.nationalId} = '' THEN 1 END`),
          incomplete: count(sql`CASE WHEN (${user.matricule} IS NULL OR ${user.matricule} = '') OR (${user.nationalId} IS NULL OR ${user.nationalId} = '') THEN 1 END`),
        })
        .from(user)
        .where(and(...conditions)),
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
        incomplete: Number(stats?.incomplete ?? 0),
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// POST assigns the next sequential matricule to a target student or to the first
// unmatriculated student in the tenant. It NEVER burns an orphan sequence into the void.
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'students.update');

    let bodyStudentId: string | undefined;
    try {
      const parsed = await request.json();
      if (parsed && typeof parsed.studentId === 'string') {
        bodyStudentId = parsed.studentId.trim();
      }
    } catch {
      // Empty body is accepted when requesting assignment to first unmatriculated student
    }

    let targetStudentId = bodyStudentId;
    let targetStudentName = '';

    if (targetStudentId) {
      const studentConditions = [
        eq(user.id, targetStudentId),
        eq(user.tenantId, tenantId),
        eq(user.role, 'student'),
      ];
      if (context.branchId) {
        studentConditions.push(eq(user.branchId, context.branchId));
      }
      const [found] = await db
        .select({ id: user.id, name: user.name, matricule: user.matricule })
        .from(user)
        .where(and(...studentConditions))
        .limit(1);

      if (!found) {
        throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Élève spécifié introuvable ou non autorisé.');
      }
      targetStudentName = found.name;
    } else {
      // Find the first student without a matricule in this tenant
      const unassignedConditions = [
        eq(user.tenantId, tenantId),
        eq(user.role, 'student'),
        sql`(${user.matricule} IS NULL OR ${user.matricule} = '')`,
      ];
      if (context.branchId) {
        unassignedConditions.push(eq(user.branchId, context.branchId));
      }

      const [candidate] = await db
        .select({ id: user.id, name: user.name })
        .from(user)
        .where(and(...unassignedConditions))
        .orderBy(user.createdAt)
        .limit(1);

      if (!candidate) {
        // Invariant: no orphan numbers burned when all students already have a matricule
        const currentPreview = await previewMatricule(db, tenantId);
        return NextResponse.json({
          success: true,
          allAssigned: true,
          matricule: currentPreview,
          message: 'Tous les élèves de l\'établissement disposent déjà d\'un matricule attribué.',
        });
      }

      targetStudentId = candidate.id;
      targetStudentName = candidate.name;
    }

    // Reserve and assign atomically inside a transaction
    const newMatricule = await db.transaction(async (tx) => {
      const matricule = await reserveMatricule(tx, tenantId);
      await tx
        .update(user)
        .set({
          matricule,
          updatedAt: sql`now()`,
        })
        .where(and(eq(user.id, targetStudentId!), eq(user.tenantId, tenantId)));
      return matricule;
    });

    recordAudit(context, 'update', 'student_matricule', targetStudentId, {
      action: 'auto_assign_sequential',
      matricule: newMatricule,
    });

    return NextResponse.json({
      success: true,
      matricule: newMatricule,
      assignedStudent: {
        id: targetStudentId,
        fullName: targetStudentName,
      },
      message: `Matricule ${newMatricule} attribué avec succès à ${targetStudentName}.`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// PATCH updates an individual student's internal matricule and/or Code Massar.
// Enforces tenant isolation, Moroccan Massar format, and duplicate conflict rejection (409).
export async function PATCH(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'students.update');
    const body = await parseJson(request, updateStudentMatriculeSchema);

    // Verify student belongs to this tenant and branch
    const studentConditions = [
      eq(user.id, body.studentId),
      eq(user.tenantId, tenantId),
      eq(user.role, 'student'),
    ];
    if (context.branchId) {
      studentConditions.push(eq(user.branchId, context.branchId));
    }

    const [existingStudent] = await db
      .select({
        id: user.id,
        name: user.name,
        matricule: user.matricule,
        nationalId: user.nationalId,
      })
      .from(user)
      .where(and(...studentConditions))
      .limit(1);

    if (!existingStudent) {
      throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Élève non trouvé ou non autorisé pour votre succursale.');
    }

    let newMatricule: string | null | undefined;
    if (body.useNextGenerated) {
      newMatricule = await db.transaction(tx => reserveMatricule(tx, tenantId));
    } else if (body.matricule !== undefined) {
      const normMat = body.matricule?.trim().toUpperCase() || null;
      if (normMat) {
        // Enforce tenant-scoped uniqueness
        const [dupMat] = await db
          .select({ id: user.id })
          .from(user)
          .where(
            and(
              eq(user.tenantId, tenantId),
              eq(user.role, 'student'),
              eq(user.matricule, normMat),
              ne(user.id, body.studentId),
            ),
          )
          .limit(1);

        if (dupMat) {
          throw new ApiError(
            409,
            'MATRICULE_CONFLICT',
            `Le matricule "${normMat}" est déjà attribué à un autre élève dans votre établissement.`,
          );
        }
      }
      newMatricule = normMat;
    }

    let newCodeMassar: string | null | undefined;
    if (body.codeMassar !== undefined) {
      const normMassar = body.codeMassar?.trim().toUpperCase() || null;
      if (normMassar) {
        // Format validation: 1 letter + 9 digits (CNE / Code Massar standard)
        if (!MASSAR_CODE_REGEX.test(normMassar)) {
          throw new ApiError(
            422,
            'FORMAT_INVALID',
            `Le Code Massar "${normMassar}" est invalide (format attendu : 1 lettre suivie de 9 chiffres, ex: G134567890).`,
          );
        }

        // Enforce tenant-scoped uniqueness
        const [dupMassar] = await db
          .select({ id: user.id })
          .from(user)
          .where(
            and(
              eq(user.tenantId, tenantId),
              eq(user.role, 'student'),
              eq(user.nationalId, normMassar),
              ne(user.id, body.studentId),
            ),
          )
          .limit(1);

        if (dupMassar) {
          throw new ApiError(
            409,
            'MASSAR_CONFLICT',
            `Le Code Massar "${normMassar}" est déjà attribué à un autre élève dans votre établissement.`,
          );
        }
      }
      newCodeMassar = normMassar;
    }

    const patch: Record<string, any> = { updatedAt: sql`now()` };
    if (newMatricule !== undefined) {
      patch.matricule = newMatricule;
    }
    if (newCodeMassar !== undefined) {
      patch.nationalId = newCodeMassar;
    }

    const [updated] = await db
      .update(user)
      .set(patch)
      .where(and(eq(user.id, body.studentId), eq(user.tenantId, tenantId), eq(user.role, 'student')))
      .returning({ id: user.id, name: user.name, matricule: user.matricule, nationalId: user.nationalId });

    recordAudit(context, 'update', 'student_matricule', body.studentId, {
      previous: {
        matricule: existingStudent.matricule,
        codeMassar: existingStudent.nationalId,
      },
      next: {
        matricule: updated!.matricule,
        codeMassar: updated!.nationalId,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated!.id,
        fullName: updated!.name,
        matricule: updated!.matricule,
        codeMassar: updated!.nationalId,
      },
      message: 'Identifiants de l\'élève mis à jour avec succès',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
