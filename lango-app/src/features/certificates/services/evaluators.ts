import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { studentPlacements, classSections, attendance, employeeProfiles } from '@/models/Schema';
import { certificateEventRosters } from '@/features/certificates/models/certificates-schema';
import { assessmentOutcomes } from '@/features/assessment/models/assessment-schema';

export type EligibilityResult =
  | { eligible: false; reason: string }
  | { eligible: true; evidenceSnapshot: Record<string, unknown> };

export type EvaluatorFn = (
  tenantId: string,
  recipientId: string,
  ruleParams: Record<string, any>
) => Promise<EligibilityResult>;

/**
 * 1. Manual Authorization
 * Always eligible if this rule is selected, relying on the human's manual review.
 * Snapshot captures who authorized it (passed via ruleParams).
 */
export const evaluateManualAuthorized: EvaluatorFn = async (tenantId, recipientId, ruleParams) => {
  if (!ruleParams.authorizedBy) {
    return { eligible: false, reason: "Identifiant de l'autorisateur (authorizedBy) manquant." };
  }

  // The issuing route passes context.userId server-side; 'unknown' must never
  // be recorded as the actor who authorized a certificate (FIX-PLAN §8).
  if (ruleParams.authorizedBy === 'unknown') {
    return { eligible: false, reason: "L'autorisateur ne peut pas être 'unknown' : l'identité de session doit être fournie." };
  }

  return {
    eligible: true,
    evidenceSnapshot: {
      type: 'manual_authorized',
      authorizedBy: ruleParams.authorizedBy,
      authorizedAt: new Date().toISOString(),
      notes: ruleParams.notes || '',
    },
  };
};

/**
 * 2. Enrollment Active
 * Checks if the student was actively enrolled in a specific class section during a date range.
 * ruleParams: { classSectionId: string }
 */
export const evaluateEnrollmentActive: EvaluatorFn = async (tenantId, recipientId, ruleParams) => {
  const { classSectionId } = ruleParams;
  if (!classSectionId) {
    return { eligible: false, reason: 'classSectionId manquant dans la règle.' };
  }

  // Find the placement
  const placements = await db
    .select({
      id: studentPlacements.id,
      status: studentPlacements.status,
      startDate: studentPlacements.startDate,
      endDate: studentPlacements.endDate,
    })
    .from(studentPlacements)
    .innerJoin(classSections, eq(studentPlacements.classSectionId, classSections.id))
    .where(
      and(
        eq(studentPlacements.tenantId, tenantId),
        eq(studentPlacements.studentId, recipientId),
        eq(studentPlacements.classSectionId, classSectionId)
      )
    )
    .limit(1);

  const placement = placements[0];

  if (!placement) {
    return { eligible: false, reason: 'Aucune inscription trouvée pour cette classe.' };
  }

  if (placement.status !== 'enrolled' && placement.status !== 'graduated') {
    return { eligible: false, reason: `Le statut d'inscription est invalide: ${placement.status}` };
  }

  return {
    eligible: true,
    evidenceSnapshot: {
      type: 'enrollment_active',
      placementId: placement.id,
      classSectionId,
      status: placement.status,
      startDate: placement.startDate,
      endDate: placement.endDate,
      evaluatedAt: new Date().toISOString(),
    },
  };
};

// Dispatcher
export const evaluateAssessmentThreshold: EvaluatorFn = async (tenantId, recipientId, ruleParams) => {
  const { assessmentDefinitionId, minScore } = ruleParams;
  if (!assessmentDefinitionId || minScore === undefined) {
    return { eligible: false, reason: 'assessmentDefinitionId ou minScore manquant.' };
  }

  const outcomes = await db
    .select({
      id: assessmentOutcomes.id,
      normalizedScore: assessmentOutcomes.normalizedScore,
    })
    .from(assessmentOutcomes)
    .where(
      and(
        eq(assessmentOutcomes.tenantId, tenantId),
        eq(assessmentOutcomes.studentId, recipientId),
        eq(assessmentOutcomes.assessmentDefinitionId, assessmentDefinitionId)
      )
    )
    .limit(1);

  const outcome = outcomes[0];
  if (!outcome) {
    return { eligible: false, reason: "Aucun résultat d'évaluation trouvé." };
  }

  const score = Number(outcome.normalizedScore || 0);
  if (score < Number(minScore)) {
    return { eligible: false, reason: `Le score (${score}) est inférieur au minimum requis (${minScore}).` };
  }

  return {
    eligible: true,
    evidenceSnapshot: {
      type: 'assessment_threshold',
      outcomeId: outcome.id,
      assessmentDefinitionId,
      achievedScore: score,
      minScore,
      evaluatedAt: new Date().toISOString(),
    },
  };
};

export const evaluateAttendancePercentage: EvaluatorFn = async (tenantId, recipientId, ruleParams) => {
  const { studentGroupId, minPercentage } = ruleParams;
  if (!studentGroupId || minPercentage === undefined) {
    return { eligible: false, reason: 'studentGroupId ou minPercentage manquant.' };
  }

  const records = await db
    .select({
      status: attendance.status,
    })
    .from(attendance)
    .where(
      and(
        eq(attendance.tenantId, tenantId),
        eq(attendance.studentId, recipientId),
        eq(attendance.studentGroupId, studentGroupId),
        eq(attendance.isVoided, false)
      )
    );

  if (records.length === 0) {
    return { eligible: false, reason: 'Aucun relevé de présence trouvé.' };
  }

  const presentCount = records.filter(r => r.status === 'present' || r.status === 'late').length;
  const percentage = (presentCount / records.length) * 100;

  if (percentage < Number(minPercentage)) {
    return { eligible: false, reason: `Le taux de présence (${percentage.toFixed(2)}%) est inférieur au minimum requis (${minPercentage}%).` };
  }

  return {
    eligible: true,
    evidenceSnapshot: {
      type: 'attendance_percentage',
      studentGroupId,
      presentCount,
      totalCount: records.length,
      achievedPercentage: percentage,
      minPercentage,
      evaluatedAt: new Date().toISOString(),
    },
  };
};

export const evaluateEventParticipation: EvaluatorFn = async (tenantId, recipientId, ruleParams) => {
  const { eventName } = ruleParams;
  if (!eventName) {
    return { eligible: false, reason: 'eventName manquant dans la règle.' };
  }

  const rosters = await db
    .select({
      id: certificateEventRosters.id,
      status: certificateEventRosters.status,
    })
    .from(certificateEventRosters)
    .where(
      and(
        eq(certificateEventRosters.tenantId, tenantId),
        eq(certificateEventRosters.participantId, recipientId),
        eq(certificateEventRosters.eventName, eventName)
      )
    )
    .limit(1);

  const roster = rosters[0];
  if (!roster) {
    return { eligible: false, reason: 'Aucune participation trouvée pour cet événement (absent du registre).' };
  }

  if (roster.status === 'not_going') {
    return { eligible: false, reason: `Le statut de participation est invalide: ${roster.status}` };
  }

  return {
    eligible: true,
    evidenceSnapshot: {
      type: 'event_participation',
      rosterId: roster.id,
      eventName,
      status: roster.status,
      evaluatedAt: new Date().toISOString(),
    },
  };
};

export const evaluateHrEmployment: EvaluatorFn = async (tenantId, recipientId, ruleParams) => {
  // L'audit de code a révélé que la table employeeProfiles ne contient pas de
  // champ "active", "status" ou "end_date". On ne peut donc pas vérifier la
  // validité *actuelle* de l'emploi (un historique ne suffit pas).
  // Par conséquent, cette évaluation échouera systématiquement tant que
  // le modèle de données RH n'est pas corrigé.
  return { 
    eligible: false, 
    reason: "Impossible de vérifier si l'emploi est actif car le profil employé ne contient pas de champ de statut ou de date de fin." 
  };
};

export const EVALUATORS: Record<string, EvaluatorFn> = {
  'manual_authorized': evaluateManualAuthorized,
  'enrollment_active': evaluateEnrollmentActive,
  'assessment_threshold': evaluateAssessmentThreshold,
  'attendance_percentage': evaluateAttendancePercentage,
  'event_participation': evaluateEventParticipation,
  'hr_employment': evaluateHrEmployment,
};

export async function evaluateRule(
  tenantId: string,
  recipientId: string,
  ruleType: string,
  ruleParams: Record<string, any>
): Promise<EligibilityResult> {
  const evaluator = EVALUATORS[ruleType];
  if (!evaluator) {
    return { eligible: false, reason: `Type de règle inconnu: ${ruleType}` };
  }
  return evaluator(tenantId, recipientId, ruleParams);
}
