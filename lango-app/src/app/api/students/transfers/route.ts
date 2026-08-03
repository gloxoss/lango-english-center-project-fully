import { and, count, eq, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { recordStudentPlacement } from '@/libs/services/student-placement';
import { db } from '@/libs/DB';
import { classSections, invoices, sessionYears, user } from '@/models/Schema';

const studentTransferSchema = z.object({
  studentId: z.string().min(1),
  targetClassSectionId: z.string().uuid(),
  sessionYearId: z.string().uuid().optional(),
  reason: z.string().trim().max(500).optional(),
  transferType: z.enum(['Changement de classe', 'Changement de campus', 'Sortie définitive']).optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'students.read');

    const { searchParams } = new URL(request.url);
    const classSectionId = searchParams.get('classSectionId');

    const whereClause = and(
      eq(user.tenantId, tenantId),
      eq(user.role, 'student'),
      ...(classSectionId ? [eq(user.classSectionId, classSectionId)] : []),
    );

    const studentsList = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        classSectionId: user.classSectionId,
        matricule: user.matricule,
      })
      .from(user)
      .where(whereClause);

    return NextResponse.json({
      success: true,
      data: studentsList,
      total: studentsList.length,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'students.placements.manage');
    const body = await parseJson(request, studentTransferSchema);

    // Verify student belongs to tenant
    const [student] = await db
      .select({ id: user.id, name: user.name, classSectionId: user.classSectionId })
      .from(user)
      .where(and(eq(user.id, body.studentId), eq(user.tenantId, tenantId), eq(user.role, 'student')))
      .limit(1);

    if (!student) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'L\'élève indiqué n\'existe pas.');
    }

    // Verify target class section belongs to tenant
    const [targetSection] = await db
      .select({ id: classSections.id })
      .from(classSections)
      .where(and(eq(classSections.id, body.targetClassSectionId), eq(classSections.tenantId, tenantId)))
      .limit(1);

    if (!targetSection) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'La section de classe cible n\'existe pas.');
    }

    // Capacity check — classSections has no maxStudents column, so we return a soft warning
    // ponytail: count-only, no hard block — add migration + hard limit when school asks for it
    const enrolledCountResult = await db
      .select({ enrolledCount: count() })
      .from(user)
      .where(and(
        eq(user.tenantId, tenantId),
        eq(user.role, 'student'),
        eq(user.classSectionId, body.targetClassSectionId),
      ));
    const enrolledCount = enrolledCountResult[0]?.enrolledCount ?? 0;


    // Unpaid invoice check — advisory warning only, not a hard block
    const [unpaidInvoice] = await db
      .select({ id: invoices.id, amount: invoices.netAmount, paidAmount: invoices.paidAmount })
      .from(invoices)
      .where(and(
        eq(invoices.tenantId, tenantId),
        eq(invoices.studentId, body.studentId),
        ne(invoices.status, 'paid'),
      ))
      .limit(1);

    // Get session year id
    let sessionYearId = body.sessionYearId;
    if (!sessionYearId) {
      const [activeYear] = await db
        .select({ id: sessionYears.id })
        .from(sessionYears)
        .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.isDefault, true)))
        .limit(1);
      sessionYearId = activeYear?.id;
    }

    if (!sessionYearId) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'Aucune année scolaire active trouvée.');
    }

    // Execute placement transition using canonical service
    const newPlacement = await recordStudentPlacement({
      tenantId,
      studentId: body.studentId,
      sessionYearId,
      classSectionId: body.targetClassSectionId,
      notes: `Transfert (${body.transferType || 'Changement de classe'}): ${body.reason || 'Aucun motif renseigné'}`,
    });

    if (!newPlacement) {
      throw new ApiError(500, 'INTERNAL_ERROR', 'Impossible d enregistrer le placement de l élève.');
    }

    recordAudit(context, 'update', 'student', body.studentId, {
      previousClassSectionId: student.classSectionId,
      newClassSectionId: body.targetClassSectionId,
      reason: body.reason,
      transferType: body.transferType,
      placementId: newPlacement.id,
    });

    return NextResponse.json({
      success: true,
      data: newPlacement,
      warnings: [
        ...(enrolledCount >= 30 ? [`La section cible compte déjà ${enrolledCount} élèves.`] : []),
        ...(unpaidInvoice ? [`Cet élève a des factures impayées (solde dû).`] : []),
      ],
      message: `Le transfert de ${student.name} a été exécuté avec succès.`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
