import type { MarkStatus } from './marksheet-grid';
import { and, eq, inArray, or } from 'drizzle-orm';
import {
  assessmentAudiences,
  assessmentDefinitions,
  assessmentOutcomes,
} from '@/features/assessment/models/assessment-schema';
import { db } from '@/libs/DB';
import { academicClassOfferings, classSections, user } from '@/models/Schema';

export type MarksheetStudent = {
  studentId: string;
  name: string;
  /** Shown alongside the name so two "Youssef"s can be told apart. */
  nationalId: string | null;
  classSectionId: string | null;
};

export type MarksheetExistingMark = {
  studentId: string;
  rawScore: number | null;
  status: MarkStatus | 'pending';
  moderationState: string;
};

export type MarksheetPayload = {
  definition: {
    id: string;
    title: string;
    type: string;
    maximumScore: number;
    passMark: number;
    coefficient: number;
    status: string;
  };
  students: MarksheetStudent[];
  existingMarks: MarksheetExistingMark[];
};

/**
 * Which students a marksheet covers.
 *
 * An assessment's audience can be written three ways — an explicit student, a
 * section, or a class offering — and real data uses a mix, so all three are
 * resolved and unioned. Students who already hold an outcome row are folded in
 * too: an audience edited after marking must never make an existing mark
 * invisible, because a mark you cannot see is a mark you cannot correct.
 *
 * Every branch is tenant-scoped independently. assessment_audiences carries no
 * tenant_id of its own, so it is only ever reached through a definition already
 * proven to belong to the caller's tenant.
 */
export async function resolveMarksheetRoster(
  tenantId: string,
  assessmentDefinitionId: string,
): Promise<MarksheetPayload | null> {
  const [definition] = await db
    .select()
    .from(assessmentDefinitions)
    .where(and(
      eq(assessmentDefinitions.id, assessmentDefinitionId),
      eq(assessmentDefinitions.tenantId, tenantId),
    ))
    .limit(1);

  if (!definition) {
    return null;
  }

  const audiences = await db
    .select()
    .from(assessmentAudiences)
    .where(eq(assessmentAudiences.assessmentDefinitionId, definition.id));

  const outcomes = await db
    .select({
      studentId: assessmentOutcomes.studentId,
      rawScore: assessmentOutcomes.rawScore,
      status: assessmentOutcomes.status,
      moderationState: assessmentOutcomes.moderationState,
    })
    .from(assessmentOutcomes)
    .where(and(
      eq(assessmentOutcomes.assessmentDefinitionId, definition.id),
      eq(assessmentOutcomes.tenantId, tenantId),
    ));

  const directStudentIds = audiences.map(a => a.studentId).filter((id): id is string => Boolean(id));
  const offeringIds = audiences.map(a => a.classOfferingId).filter((id): id is string => Boolean(id));
  const sectionIds = audiences.map(a => a.sectionId).filter((id): id is string => Boolean(id));
  const outcomeStudentIds = outcomes.map(o => o.studentId);

  const classSectionIds = new Set<string>();

  if (offeringIds.length > 0) {
    const offerings = await db
      .select({ classId: academicClassOfferings.classId, sectionId: academicClassOfferings.sectionId })
      .from(academicClassOfferings)
      .where(and(
        eq(academicClassOfferings.tenantId, tenantId),
        inArray(academicClassOfferings.id, offeringIds),
      ));

    for (const offering of offerings) {
      const matches = await db
        .select({ id: classSections.id })
        .from(classSections)
        .where(and(
          eq(classSections.tenantId, tenantId),
          eq(classSections.classId, offering.classId),
          eq(classSections.sectionId, offering.sectionId),
        ));

      for (const match of matches) {
        classSectionIds.add(match.id);
      }
    }
  }

  if (sectionIds.length > 0) {
    // assessment_audiences.section_id is written inconsistently across the
    // codebase — sometimes a class_sections id, sometimes the underlying
    // sections id — so both are accepted rather than silently returning nobody.
    const matches = await db
      .select({ id: classSections.id })
      .from(classSections)
      .where(and(
        eq(classSections.tenantId, tenantId),
        or(
          inArray(classSections.id, sectionIds),
          inArray(classSections.sectionId, sectionIds),
        ),
      ));

    for (const match of matches) {
      classSectionIds.add(match.id);
    }
  }

  const studentFilters = [];
  if (classSectionIds.size > 0) {
    studentFilters.push(inArray(user.classSectionId, [...classSectionIds]));
  }
  const explicitIds = [...new Set([...directStudentIds, ...outcomeStudentIds])];
  if (explicitIds.length > 0) {
    studentFilters.push(inArray(user.id, explicitIds));
  }

  const students: MarksheetStudent[] = studentFilters.length === 0
    ? []
    : await db
        .select({
          studentId: user.id,
          name: user.name,
          nationalId: user.nationalId,
          classSectionId: user.classSectionId,
        })
        .from(user)
        .where(and(
          eq(user.tenantId, tenantId),
          eq(user.role, 'student'),
          studentFilters.length === 1 ? studentFilters[0]! : or(...studentFilters)!,
        ))
        .orderBy(user.name);

  return {
    definition: {
      id: definition.id,
      title: definition.title,
      type: definition.type,
      maximumScore: Number(definition.maximumScore),
      passMark: definition.passMark === null ? 10 : Number(definition.passMark),
      coefficient: Number(definition.coefficient),
      status: definition.status,
    },
    students,
    existingMarks: outcomes.map(o => ({
      studentId: o.studentId,
      rawScore: o.rawScore === null ? null : Number(o.rawScore),
      status: o.status as MarkStatus | 'pending',
      moderationState: o.moderationState,
    })),
  };
}
