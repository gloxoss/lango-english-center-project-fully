import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '@/libs/DB';
import { getClassReportCards } from '@/features/academics/services/report-card-service';
import {
  assessmentPlans,
  assessmentResults,
  assessments,
  classSections,
  classSubjects,
  classes,
  gradingScales,
  mediums,
  sections,
  subjects,
  tenants,
  user,
} from '@/models/Schema';

// Regression: /api/students/report-card returned 500 for every class.
//
// assessment_results.final_percentage holds a 0-100 percentage (the seed writes
// int(30, 98), and promotions/preview documents the same 0-100 contract), but
// the report-card service handed those values straight to
// calculateMoroccanAverage, which rejects anything above 20. Since every real
// grade is above 20, the whole class's bulletins 500'd, not just a high scorer.
//
// The test plants an 80% grade on purpose: that is the value that reproduced
// the original crash. A fixture graded on /20 could never fail here, which is
// exactly why this shipped.
const dbReachable = Boolean(process.env.DATABASE_URL);

const tenantId = crypto.randomUUID();
const studentId = `STU-${crypto.randomUUID()}`;
const classSectionId = crypto.randomUUID();
const mediumId = crypto.randomUUID();
const classId = crypto.randomUUID();
const sectionId = crypto.randomUUID();
const subjectId = crypto.randomUUID();
const classSubjectId = crypto.randomUUID();
const gradingScaleId = crypto.randomUUID();
const assessmentPlanId = crypto.randomUUID();
const assessmentId = crypto.randomUUID();

describe.skipIf(!dbReachable)('getClassReportCards — percentage to /20 scale', () => {
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
    await db.insert(gradingScales).values({ id: gradingScaleId, tenantId, name: 'Barème /20' });
    await db.insert(assessmentPlans).values({
      id: assessmentPlanId,
      tenantId,
      name: 'Contrôle Continu 1',
      classSubjectId,
      gradingScaleId,
    });
    await db.insert(assessments).values({
      id: assessmentId,
      tenantId,
      assessmentPlanId,
      title: 'Français – CC1',
      assessmentDate: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    // assessment_results cascades from assessment_results_student_id_fkey only
    // via the assessment, so clear results before the tenant cascade runs.
    await db.delete(assessmentResults).where(eq(assessmentResults.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('computes a bulletin from an above-20 percentage instead of throwing', async () => {
    await db.insert(assessmentResults).values({
      tenantId,
      assessmentId,
      studentId,
      finalPercentage: '80',
      gradeCode: 'Bien',
    });

    const { cards } = await getClassReportCards(tenantId, classSectionId);
    const card = cards.find(c => c.student.id === studentId);

    expect(card).toBeDefined();
    // 80% is 16/20, and 16/20 is "Très Bien" on the Moroccan scale. Before the
    // fix this line never ran: the call threw "Grade non valide pour Français: 80".
    expect(card!.subjects[0]!.average).toBe(16);
    expect(card!.generalAverage).toBe(16);
    expect(card!.mention).toBe('Très Bien');
  });

  it('ranks students on the /20 scale, so a percentage class is ordered correctly', async () => {
    await db.delete(assessmentResults).where(eq(assessmentResults.tenantId, tenantId));
    const lowerId = `STU-${crypto.randomUUID()}`;
    await db.insert(user).values({
      id: lowerId,
      tenantId,
      name: 'Lower Test',
      email: `l-${tenantId}@test.local`,
      role: 'student',
      classSectionId,
    });
    await db.insert(assessmentResults).values([
      { tenantId, assessmentId, studentId, finalPercentage: '90', gradeCode: 'Très Bien' },
      { tenantId, assessmentId, studentId: lowerId, finalPercentage: '40', gradeCode: 'Insuffisant' },
    ]);

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
