import { and, count, eq } from 'drizzle-orm';
import { recordAudit } from '@/libs/api/audit';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import {
  attendance,
  certificates,
  guardianStudents,
  invoices,
  payments,
  studentDocuments,
  studentPlacements,
  user,
} from '@/models/Schema';
import { homeworkAttempts, examSeats, assessmentOutcomes } from '@/features/assessment/models/assessment-schema';
import { studentCredits } from '@/features/finance/models/student-accounting-schema';

export type StudentLifecycleStatus = 'active' | 'withdrawn' | 'transferred' | 'graduated' | 'archived';

export interface TransitionStudentInput {
  tenantId: string;
  branchId?: string | null;
  studentId: string;
  targetStatus: StudentLifecycleStatus;
  reason?: string;
  effectiveDate?: string;
  actor: any;
}

export interface DependencyCheckResult {
  hasDependencies: boolean;
  reasons: string[];
  counts: Record<string, number>;
}

/**
 * Transactionally checks all referential dependencies across the entire system
 * before any destructive action is permitted.
 */
export async function checkStudentDependencies(tenantId: string, studentId: string): Promise<DependencyCheckResult> {
  const [
    invCount,
    payCount,
    attCount,
    gradeCount,
    placementCount,
    docCount,
    certCount,
    seatCount,
    homeworkCount,
    creditCount,
  ] = await Promise.all([
    db.select({ c: count() }).from(invoices).where(and(eq(invoices.tenantId, tenantId), eq(invoices.studentId, studentId))),
    db.select({ c: count() }).from(payments).where(and(eq(payments.tenantId, tenantId), eq(payments.studentId, studentId))),
    db.select({ c: count() }).from(attendance).where(and(eq(attendance.tenantId, tenantId), eq(attendance.studentId, studentId))),
    db.select({ c: count() }).from(assessmentOutcomes).where(and(eq(assessmentOutcomes.tenantId, tenantId), eq(assessmentOutcomes.studentId, studentId))),
    db.select({ c: count() }).from(studentPlacements).where(and(eq(studentPlacements.tenantId, tenantId), eq(studentPlacements.studentId, studentId))),
    db.select({ c: count() }).from(studentDocuments).where(and(eq(studentDocuments.tenantId, tenantId), eq(studentDocuments.studentId, studentId))),
    db.select({ c: count() }).from(certificates).where(and(eq(certificates.tenantId, tenantId), eq(certificates.studentId, studentId))),
    db.select({ c: count() }).from(examSeats).where(and(eq(examSeats.tenantId, tenantId), eq(examSeats.studentId, studentId))),
    db.select({ c: count() }).from(homeworkAttempts).where(eq(homeworkAttempts.studentId, studentId)),
    db.select({ c: count() }).from(studentCredits).where(and(eq(studentCredits.tenantId, tenantId), eq(studentCredits.studentId, studentId))),
  ]);

  const counts = {
    invoices: invCount[0]?.c ?? 0,
    payments: payCount[0]?.c ?? 0,
    attendance: attCount[0]?.c ?? 0,
    assessmentOutcomes: gradeCount[0]?.c ?? 0,
    studentPlacements: placementCount[0]?.c ?? 0,
    studentDocuments: docCount[0]?.c ?? 0,
    certificates: certCount[0]?.c ?? 0,
    examSeats: seatCount[0]?.c ?? 0,
    homeworkAttempts: homeworkCount[0]?.c ?? 0,
    studentCredits: creditCount[0]?.c ?? 0,
  };

  const reasons: string[] = [];
  if (counts.invoices > 0) reasons.push(`${counts.invoices} facture(s)`);
  if (counts.payments > 0) reasons.push(`${counts.payments} règlement(s)`);
  if (counts.attendance > 0) reasons.push(`${counts.attendance} pointage(s) de présence`);
  if (counts.assessmentOutcomes > 0) reasons.push(`${counts.assessmentOutcomes} note(s)/évaluation(s)`);
  if (counts.studentPlacements > 0) reasons.push(`${counts.studentPlacements} affectation(s) de classe`);
  if (counts.studentDocuments > 0) reasons.push(`${counts.studentDocuments} document(s) déposé(s)`);
  if (counts.certificates > 0) reasons.push(`${counts.certificates} certificat(s)`);
  if (counts.examSeats > 0) reasons.push(`${counts.examSeats} place(s) d'examen`);
  if (counts.homeworkAttempts > 0) reasons.push(`${counts.homeworkAttempts} devoir(s)`);
  if (counts.studentCredits > 0) reasons.push(`${counts.studentCredits} avoir(s) comptable(s)`);

  return {
    hasDependencies: reasons.length > 0,
    reasons,
    counts,
  };
}

/**
 * Authoritative Student Lifecycle State Transition.
 * Safely transitions student status without erasing pedagogical context (classSectionId is preserved).
 */
export async function transitionStudentLifecycle(input: TransitionStudentInput) {
  const { tenantId, branchId, studentId, targetStatus, reason, effectiveDate, actor } = input;
  const nowStr = new Date().toISOString();
  const dateStr = effectiveDate || nowStr.slice(0, 10);

  return db.transaction(async (tx) => {
    const studentConditions = [
      eq(user.id, studentId),
      eq(user.tenantId, tenantId),
    ];
    if (branchId) {
      studentConditions.push(eq(user.branchId, branchId));
    }

    const [existingStudent] = await tx
      .select({
        id: user.id,
        role: user.role,
        userStatus: user.userStatus,
        branchId: user.branchId,
        classSectionId: user.classSectionId,
      })
      .from(user)
      .where(and(...studentConditions))
      .limit(1);

    if (!existingStudent) {
      throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Élève non trouvé ou hors de votre périmètre autorité/succursale.');
    }

    let newUserStatus: 'active' | 'inactive' | 'archived' = 'active';
    let newRole: any = existingStudent.role;
    let alumniTransitionedAt: string | null = null;
    let placementStatus: 'enrolled' | 'dropped' | 'graduated' = 'enrolled';
    let closePlacement = false;

    switch (targetStatus) {
      case 'active':
        newUserStatus = 'active';
        newRole = 'student';
        placementStatus = 'enrolled';
        break;

      case 'withdrawn':
        newUserStatus = 'inactive';
        closePlacement = true;
        placementStatus = 'dropped';
        break;

      case 'transferred':
        newUserStatus = 'inactive';
        closePlacement = true;
        placementStatus = 'dropped';
        break;

      case 'graduated':
        newUserStatus = 'active';
        newRole = 'alumni';
        alumniTransitionedAt = nowStr;
        closePlacement = true;
        placementStatus = 'graduated';
        break;

      case 'archived':
        newUserStatus = 'archived';
        closePlacement = true;
        placementStatus = 'dropped';
        break;

      default:
        throw new ApiError(400, 'INVALID_STATUS', `Statut de cycle de vie non supporté: ${targetStatus}`);
    }

    // Update user record: PRESERVE classSectionId to maintain historical class attribution!
    const userUpdate: Record<string, any> = {
      userStatus: newUserStatus,
      role: newRole,
      updatedAt: nowStr,
    };
    if (alumniTransitionedAt) {
      userUpdate.alumniTransitionedAt = alumniTransitionedAt;
      userUpdate.alumniTransitionedBy = actor.userId || actor.id || null;
    }

    await tx.update(user).set(userUpdate).where(and(eq(user.id, studentId), eq(user.tenantId, tenantId)));

    // Update student placement history
    if (closePlacement) {
      await tx
        .update(studentPlacements)
        .set({
          isCurrent: false,
          endDate: dateStr,
          status: placementStatus,
          notes: reason ? `${reason} (Clôture: ${targetStatus})` : `Statut élève: ${targetStatus}`,
          updatedAt: nowStr,
        })
        .where(and(
          eq(studentPlacements.tenantId, tenantId),
          eq(studentPlacements.studentId, studentId),
          eq(studentPlacements.isCurrent, true),
        ));
    }

    recordAudit(actor, 'update', 'student', studentId, {
      action: 'lifecycle_transition',
      previousStatus: existingStudent.userStatus,
      targetStatus,
      reason: reason || null,
      effectiveDate: dateStr,
    });

    return {
      success: true,
      studentId,
      status: targetStatus,
      userStatus: newUserStatus,
      message: `Statut de l'élève mis à jour : ${targetStatus}`,
    };
  });
}

/**
 * Hard deletion: Strictly permitted ONLY for clean draft records without dependencies.
 */
export async function hardDeleteStudent(params: {
  tenantId: string;
  branchId?: string | null;
  studentId: string;
  actor: any;
}) {
  const { tenantId, branchId, studentId, actor } = params;

  const studentConditions = [
    eq(user.id, studentId),
    eq(user.tenantId, tenantId),
    eq(user.role, 'student'),
  ];
  if (branchId) {
    studentConditions.push(eq(user.branchId, branchId));
  }

  const [student] = await db.select({ id: user.id, branchId: user.branchId }).from(user).where(and(...studentConditions)).limit(1);
  if (!student) {
    throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Élève non trouvé ou non autorisé pour cette succursale.');
  }

  const deps = await checkStudentDependencies(tenantId, studentId);
  if (deps.hasDependencies) {
    throw new ApiError(
      409,
      'CANNOT_HARD_DELETE',
      `Suppression impossible : cet élève possède des enregistrements rattachés (${deps.reasons.join(', ')}). Utilisez l'archivage ou le retrait pour préserver l'intégrité légale et pédagogique.`
    );
  }

  try {
    return await db.transaction(async (tx) => {
      await tx.delete(guardianStudents).where(and(eq(guardianStudents.tenantId, tenantId), eq(guardianStudents.studentId, studentId)));
      await tx.delete(user).where(and(eq(user.id, studentId), eq(user.tenantId, tenantId)));

      recordAudit(actor, 'delete', 'student', studentId, {
        action: 'hard_delete',
        reason: 'Suppression définitive d\'une fiche élève vierge de tout historique',
      });

      return {
        success: true,
        action: 'deleted',
        message: 'Fiche élève supprimée définitivement.',
        id: studentId,
      };
    });
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }
    // Catch PostgreSQL foreign-key violation (code 23503) from any unlisted dependent tables
    if (error?.code === '23503' || String(error?.message || '').toLowerCase().includes('foreign key')) {
      throw new ApiError(
        409,
        'CANNOT_HARD_DELETE',
        "Suppression impossible : cet élève possède des dépendances référentielles en base de données. Utilisez l'archivage ou le retrait pour préserver l'intégrité de l'établissement."
      );
    }
    throw error;
  }
}
