import { and, count, eq, or, sql } from 'drizzle-orm';
import { recordAudit } from '@/libs/api/audit';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import {
  branches,
  classes,
  classSections,
  invoices,
  sections,
  sessionYears,
  studentPlacements,
  user,
} from '@/models/Schema';

export type TransferStudentInput = {
  tenantId: string;
  studentId: string;
  targetBranchId: string;
  targetClassSectionId?: string | null;
  reason?: string | null;
  effectiveDate?: string;
  actor: {
    userId: string;
    branchId?: string | null;
    role: string;
    name?: string;
  };
  notifyGuardian?: boolean;
  generateCertificate?: boolean;
};

export type TransferStudentResult = {
  success: boolean;
  studentId: string;
  studentName: string;
  fromBranchId: string | null;
  fromBranchName: string | null;
  toBranchId: string;
  toBranchName: string;
  fromClassSectionId: string | null;
  toClassSectionId: string | null;
  effectiveDate: string;
  isSameCampusSectionMove: boolean;
  warnings: string[];
  message: string;
};

/**
 * Authoritative Canonical Student Transfer Service.
 *
 * Atomically orchestrates:
 * 1. Concurrency isolation via pg_advisory_xact_lock(tenantId:studentId)
 * 2. Operator branch authorization guard
 * 3. Target branch & target class section referential validation
 * 4. Destination section capacity truth enforcement (maxStudents)
 * 5. No-op transfer rejection
 * 6. Placement history closure & new placement insertion in student_placements
 * 7. user.branchId & user.classSectionId projection synchronization
 * 8. Immutable CNDP Law 09-08 audit trail entry
 */
export async function executeStudentTransfer(input: TransferStudentInput): Promise<TransferStudentResult> {
  const { tenantId, studentId, targetBranchId, actor } = input;
  const effectiveDate = input.effectiveDate?.trim() || new Date().toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  // 1. Date format and future scheduling rejection
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
    throw new ApiError(400, 'INVALID_DATE', 'Le format de la date d\'effet est invalide (AAAA-MM-JJ requis).');
  }

  if (effectiveDate > todayStr) {
    throw new ApiError(
      422,
      'FUTURE_TRANSFERS_UNSUPPORTED',
      'Les mutations différées ne sont pas encore supportées. La date d\'effet doit être la date du jour ou antérieure.',
    );
  }

  return await db.transaction(async (tx) => {
    // 2. Concurrency Safety: Serialize concurrent transfers / placement mutations per student
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${tenantId}:${studentId}`}, 0))`);

    // 3. Query student with tenant isolation
    const [student] = await tx
      .select({
        id: user.id,
        name: user.name,
        role: user.role,
        userStatus: user.userStatus,
        branchId: user.branchId,
        classSectionId: user.classSectionId,
        matricule: user.matricule,
        nationalId: user.nationalId,
      })
      .from(user)
      .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId), eq(user.role, 'student')))
      .limit(1);

    if (!student) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'Élève introuvable pour cet établissement.');
    }

    if (student.userStatus !== 'active') {
      throw new ApiError(409, 'STUDENT_NOT_ACTIVE', 'Seul un élève actif peut faire l\'objet d\'une mutation.');
    }

    // 4. Branch / IDOR Security Enforcement
    if (actor.branchId) {
      const isSourceAuthorized = !student.branchId || student.branchId === actor.branchId;
      const isDestAuthorized = targetBranchId === actor.branchId;
      if (!isSourceAuthorized && !isDestAuthorized) {
        throw new ApiError(
          403,
          'FORBIDDEN_BRANCH_SCOPE',
          'Accès refusé : Votre périmètre d\'autorité ne vous permet pas d\'ordonnancer cette mutation.',
        );
      }
    }

    // 5. Query source branch name
    let fromBranchName: string | null = null;
    if (student.branchId) {
      const [srcBranch] = await tx
        .select({ name: branches.name })
        .from(branches)
        .where(and(eq(branches.id, student.branchId), eq(branches.tenantId, tenantId)))
        .limit(1);
      fromBranchName = srcBranch?.name ?? null;
    }

    // 6. Validate target branch
    const [targetBranch] = await tx
      .select({ id: branches.id, name: branches.name, isActive: branches.isActive })
      .from(branches)
      .where(and(eq(branches.id, targetBranchId), eq(branches.tenantId, tenantId)))
      .limit(1);

    if (!targetBranch) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'Le campus de destination indiqué n\'existe pas.');
    }

    if (!targetBranch.isActive) {
      throw new ApiError(409, 'BRANCH_INACTIVE', 'Le campus de destination est inactif.');
    }

    // 7. Validate target section & section capacity truth
    const warnings: string[] = [];
    const normTargetSectionId = input.targetClassSectionId?.trim() || null;

    if (normTargetSectionId) {
      const [targetSection] = await tx
        .select({
          id: classSections.id,
          classId: classSections.classId,
          maxStudents: classSections.maxStudents,
          branchId: classes.branchId,
          className: classes.name,
          sectionName: sections.name,
        })
        .from(classSections)
        .innerJoin(classes, eq(classSections.classId, classes.id))
        .innerJoin(sections, eq(classSections.sectionId, sections.id))
        .where(and(eq(classSections.id, normTargetSectionId), eq(classSections.tenantId, tenantId)))
        .limit(1);

      if (!targetSection) {
        throw new ApiError(422, 'INVALID_REFERENCE', 'La section de destination indiquée n\'existe pas.');
      }

      // Verify that the section's parent class is affiliated with the target branch
      if (targetSection.branchId && targetSection.branchId !== targetBranchId) {
        throw new ApiError(
          409,
          'BRANCH_SECTION_MISMATCH',
          'La section de classe sélectionnée n\'appartient pas au campus de destination.',
        );
      }

      // Check capacity truth only if student is changing into a different section
      if (normTargetSectionId !== student.classSectionId) {
        const [enrolledRow] = await tx
          .select({ enrolledCount: count() })
          .from(studentPlacements)
          .where(and(
            eq(studentPlacements.tenantId, tenantId),
            eq(studentPlacements.classSectionId, normTargetSectionId),
            eq(studentPlacements.isCurrent, true),
          ));
        const enrolledCount = Number(enrolledRow?.enrolledCount ?? 0);

        if (targetSection.maxStudents == null) {
          throw new ApiError(
            422,
            'CAPACITY_NOT_CONFIGURED',
            `La capacité maximale de cette section (${targetSection.className} - ${targetSection.sectionName}) n'est pas configurée.`,
          );
        }

        if (enrolledCount >= targetSection.maxStudents) {
          throw new ApiError(
            409,
            'CAPACITY_EXCEEDED',
            `La capacité maximale de cette section (${targetSection.maxStudents} élèves) est déjà atteinte.`,
          );
        }
      }
    }

    // 8. Distinguish No-Op vs Intra-Campus vs Inter-Campus
    const isSameBranch = student.branchId === targetBranchId;
    const isSameSection = (student.classSectionId ?? null) === normTargetSectionId;

    if (isSameBranch && isSameSection) {
      throw new ApiError(409, 'NO_OP_TRANSFER', 'Cet élève est déjà affecté à ce campus et à cette section.');
    }

    const isSameCampusSectionMove = isSameBranch && !isSameSection;

    // 9. Inspect current active placement in student_placements
    const [currentPlacement] = await tx
      .select({
        id: studentPlacements.id,
        sessionYearId: studentPlacements.sessionYearId,
        classSectionId: studentPlacements.classSectionId,
        startDate: studentPlacements.startDate,
        notes: studentPlacements.notes,
      })
      .from(studentPlacements)
      .where(and(
        eq(studentPlacements.tenantId, tenantId),
        eq(studentPlacements.studentId, studentId),
        eq(studentPlacements.isCurrent, true),
      ))
      .limit(1);

    if (currentPlacement && effectiveDate < currentPlacement.startDate) {
      throw new ApiError(
        409,
        'PLACEMENT_DATE_CONFLICT',
        'La date d\'effet ne peut pas être antérieure à la date de début du placement actuel.',
      );
    }

    // 10. Determine active session year id
    let sessionYearId = currentPlacement?.sessionYearId;
    if (!sessionYearId && normTargetSectionId) {
      const [activeYear] = await tx
        .select({ id: sessionYears.id })
        .from(sessionYears)
        .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.isDefault, true)))
        .limit(1);
      sessionYearId = activeYear?.id;
    }

    const now = new Date().toISOString();
    const resolvedReason = input.reason?.trim() || 'Mutation administrative';

    // 11. Authoritative Placement Transition Logic
    if (currentPlacement && currentPlacement.startDate === effectiveDate) {
      // Same-day edge case: Avoids database check violation (endDate > startDate)
      if (normTargetSectionId) {
        await tx
          .update(studentPlacements)
          .set({
            classSectionId: normTargetSectionId,
            sessionYearId: sessionYearId || currentPlacement.sessionYearId,
            notes: `${currentPlacement.notes ? `${currentPlacement.notes} | ` : ''}Mutation même jour : ${resolvedReason}`,
            updatedAt: now,
          })
          .where(eq(studentPlacements.id, currentPlacement.id));
      } else {
        // Zero-day placement deletion to satisfy check constraint (endDate > startDate)
        await tx.delete(studentPlacements).where(eq(studentPlacements.id, currentPlacement.id));
      }
    } else {
      // Standard transition: End current placement and create a new one
      if (currentPlacement) {
        await tx
          .update(studentPlacements)
          .set({
            isCurrent: false,
            endDate: effectiveDate,
            notes: `${currentPlacement.notes ? `${currentPlacement.notes} | ` : ''}Mutation vers ${targetBranch.name} : ${resolvedReason}`,
            updatedAt: now,
          })
          .where(eq(studentPlacements.id, currentPlacement.id));
      }

      if (normTargetSectionId && sessionYearId) {
        await tx.insert(studentPlacements).values({
          tenantId,
          studentId,
          sessionYearId,
          classSectionId: normTargetSectionId,
          status: 'enrolled',
          startDate: effectiveDate,
          endDate: null,
          isCurrent: true,
          promotedFromPlacementId: currentPlacement?.id ?? null,
          notes: `Mutation (${isSameCampusSectionMove ? 'Intra-campus' : 'Inter-campus'}) : ${resolvedReason}`,
        });
      }
    }

    // 12. Synchronize user projection table
    await tx
      .update(user)
      .set({
        branchId: targetBranchId,
        classSectionId: normTargetSectionId,
        updatedAt: now,
      })
      .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId)));

    // 13. Audit trail (Law 09-08 / CNDP traceability)
    recordAudit(
      {
        userId: actor.userId,
        tenantId,
        branchId: actor.branchId ?? null,
        role: actor.role as any,
        baseRole: actor.role as any,
        name: actor.name ?? 'Opérateur',
        email: '',
      },
      'update',
      'student_transfer',
      studentId,
      {
        studentName: student.name,
        studentMatricule: student.matricule,
        fromBranchId: student.branchId,
        fromBranchName,
        toBranchId: targetBranchId,
        toBranchName: targetBranch.name,
        fromClassSectionId: student.classSectionId,
        toClassSectionId: normTargetSectionId,
        reason: resolvedReason,
        effectiveDate,
        isSameCampusSectionMove,
      },
    );

    // 14. Advisory financial balance check
    const [unpaid] = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(
        eq(invoices.tenantId, tenantId),
        eq(invoices.studentId, studentId),
        or(eq(invoices.status, 'overdue'), eq(invoices.status, 'pending'), eq(invoices.status, 'partial')),
      ))
      .limit(1);

    if (unpaid) {
      warnings.push('Cet élève présente des factures en attente ou impayées dans son compte financier.');
    }

    const modeLabel = isSameCampusSectionMove ? 'Changement de section' : 'Mutation inter-campus';
    const message = `${modeLabel} de ${student.name} vers « ${targetBranch.name} » validée avec succès.`;

    return {
      success: true,
      studentId,
      studentName: student.name,
      fromBranchId: student.branchId,
      fromBranchName,
      toBranchId: targetBranchId,
      toBranchName: targetBranch.name,
      fromClassSectionId: student.classSectionId,
      toClassSectionId: normTargetSectionId,
      effectiveDate,
      isSameCampusSectionMove,
      warnings,
      message,
    };
  });
}
