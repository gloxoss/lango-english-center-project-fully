import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '@/libs/DB';
import { getClassReportCards } from '@/features/academics/services/report-card-service';
import { OutcomeService } from '@/features/assessment/services/outcome-service';
import {
  assessmentDefinitions,
  assessmentOutcomes,
} from '@/features/assessment/models/assessment-schema';
import {
  classSections,
  classSubjects,
  classes,
  mediums,
  sections,
  subjects,
  tenants,
  user,
} from '@/models/Schema';

const dbReachable = Boolean(process.env.DATABASE_URL);

const tenantId = crypto.randomUUID();
const studentId = `STU-${crypto.randomUUID()}`;
const classSectionId = crypto.randomUUID();
const mediumId = crypto.randomUUID();
const classId = crypto.randomUUID();
const sectionId = crypto.randomUUID();
const subjectId = crypto.randomUUID();
const classSubjectId = crypto.randomUUID();
const assessmentDefinitionId = crypto.randomUUID();

describe.skipIf(!dbReachable)('getClassReportCards — percentage to /20 scale (canonical store)', () => {
  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'Report Card Test', slug: `rc-${tenantId}` });
    await db.insert(mediums).values({ id: mediumId, tenantId, name: 'Arabe' });
    await db.insert(sections).values({ id: sectionId, tenantId, name: 'A' });
    await db.insert(classes).values({ id: classId, tenantId, name: '3ème', mediumId });
    await db.insert(classSections).values({ id: classSectionId, tenantId, classId, sectionId, mediumId });
    await db.insert(user).values({
      id: studentId,
      tenantId,
      name: 'Sabrine Test',
      email: `s-${tenantId}@test.local`,
      role: 'student',
      classSectionId,
    });
    await db.insert(subjects).values({ id: subjectId, tenantId, name: 'Français', mediumId, type: 'theory' });
    await db.insert(classSubjects).values({
      id: classSubjectId,
      tenantId,
      classId,
      subjectId,
      type: 'compulsory',
      coefficient: '1.00',
    });
    await db.insert(assessmentDefinitions).values({
      id: assessmentDefinitionId,
      tenantId,
      classSubjectId,
      type: 'homework',
      title: 'Français – CC1',
      maximumScore: '20.00',
      coefficient: '1.00',
      status: 'draft',
    });
  });

  afterAll(async () => {
    await db.delete(assessmentOutcomes).where(eq(assessmentOutcomes.tenantId, tenantId));
    await db.delete(assessmentDefinitions).where(eq(assessmentDefinitions.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('computes a bulletin from canonical outcome recorded via OutcomeService', async () => {
    await OutcomeService.recordOutcome({
      tenantId,
      assessmentDefinitionId,
      studentId,
      rawScore: 16,
      status: 'graded',
      sourceType: 'paper_exam',
      markerId: 'marker-1',
    });

    const { cards } = await getClassReportCards(tenantId, classSectionId);
    const card = cards.find(c => c.student.id === studentId);

    expect(card).toBeDefined();
    expect(card!.subjects[0]!.average).toBe(16);
    expect(card!.generalAverage).toBe(16);
    expect(card!.mention).toBe('Très Bien');
  });

  it('ranks students on the /20 scale, so class is ordered correctly', async () => {
    const lowerId = `STU-${crypto.randomUUID()}`;
    await db.insert(user).values({
      id: lowerId,
      tenantId,
      name: 'Lower Test',
      email: `l-${tenantId}@test.local`,
      role: 'student',
      classSectionId,
    });
    await OutcomeService.recordOutcome({
      tenantId,
      assessmentDefinitionId,
      studentId,
      rawScore: 18,
      status: 'graded',
      sourceType: 'paper_exam',
      markerId: 'marker-1',
    });
    await OutcomeService.recordOutcome({
      tenantId,
      assessmentDefinitionId,
      studentId: lowerId,
      rawScore: 8,
      status: 'graded',
      sourceType: 'paper_exam',
      markerId: 'marker-1',
    });

    const { cards } = await getClassReportCards(tenantId, classSectionId);
    const top = cards.find(c => c.student.id === studentId)!;
    const bottom = cards.find(c => c.student.id === lowerId)!;

    expect(top.generalAverage).toBe(18);
    expect(bottom.generalAverage).toBe(8);
    expect(top.rank).toBe(1);
    expect(bottom.rank).toBe(2);
    expect(bottom.mention).toBe('Insuffisant');
  });
});
