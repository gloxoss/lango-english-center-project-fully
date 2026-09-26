import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '@/libs/DB';
import { getClassReportCards } from '@/features/academics/services/report-card-service';
import { issueReportCardPdf } from '@/features/academics/services/report-card-document-service';
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

// Audit 3, P0-F: report cards averaged EVERY mark a student ever had — a
// term-1 bulletin included last year's marks and other terms' marks. The
// service now scopes to the requested term window (and to the current class's
// class_subjects). This test plants marks in two terms and demands the
// term-1 bulletin use only term-1 marks.

const dbReachable = Boolean(process.env.DATABASE_URL);

const tenantId = crypto.randomUUID();
const studentId = `STU-${crypto.randomUUID()}`;
const mediumId = crypto.randomUUID();
const classId = crypto.randomUUID();
const sectionId = crypto.randomUUID();
const classSectionId = crypto.randomUUID();
const subjectId = crypto.randomUUID();
const classSubjectId = crypto.randomUUID();
const term1DefId = crypto.randomUUID();
const term2DefId = crypto.randomUUID();
// An assessment attached to ANOTHER class's plan (last year) — must never reach a
// current-class bulletin.
const oldClassId = crypto.randomUUID();
const oldClassSubjectId = crypto.randomUUID();
const oldDefId = crypto.randomUUID();

const TERM1 = { start: '2026-09-01', end: '2026-11-30' };
const TERM2 = { start: '2026-12-01', end: '2027-02-28' };

describe.skipIf(!dbReachable)('getClassReportCards — term scoping (canonical store)', () => {
  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'Term Scope Test', slug: `ts-${tenantId}` });
    await db.insert(mediums).values({ id: mediumId, tenantId, name: 'Arabe' });
    await db.insert(sections).values({ id: sectionId, tenantId, name: 'A' });
    await db.insert(classes).values({ id: classId, tenantId, name: '1BAC', mediumId });
    await db.insert(classSections).values({ id: classSectionId, tenantId, classId, sectionId, mediumId });
    await db.insert(user).values({
      id: studentId,
      tenantId,
      name: 'Term Scope Student',
      email: `ts-${tenantId}@test.local`,
      role: 'student',
      classSectionId,
    });
    await db.insert(subjects).values({ id: subjectId, tenantId, name: 'Mathématiques', mediumId, type: 'theory' });
    await db.insert(classSubjects).values({
      id: classSubjectId,
      tenantId,
      classId,
      subjectId,
      type: 'compulsory',
      coefficient: '4.00',
    });
    // Last year's class: same subject, different coefficient.
    await db.insert(classes).values({ id: oldClassId, tenantId, name: 'TC', mediumId });
    await db.insert(classSubjects).values({
      id: oldClassSubjectId,
      tenantId,
      classId: oldClassId,
      subjectId,
      type: 'compulsory',
      coefficient: '2.00',
    });

    await db.insert(assessmentDefinitions).values([
      { id: term1DefId, tenantId, classSubjectId, title: 'Maths T1', maximumScore: '20.00', coefficient: '1.00', status: 'draft' },
      { id: term2DefId, tenantId, classSubjectId, title: 'Maths T2', maximumScore: '20.00', coefficient: '1.00', status: 'draft' },
      { id: oldDefId, tenantId, classSubjectId: oldClassSubjectId, title: 'Maths TC (last year)', maximumScore: '20.00', coefficient: '1.00', status: 'draft' },
    ]);

    const o1 = await OutcomeService.recordOutcome({
      tenantId,
      assessmentDefinitionId: term1DefId,
      studentId,
      rawScore: 12,
      status: 'graded',
      sourceType: 'paper_exam',
      markerId: 'marker-1',
    });
    await db.update(assessmentOutcomes).set({ createdAt: '2026-10-15 08:00:00' }).where(eq(assessmentOutcomes.id, o1!.id));

    const o2 = await OutcomeService.recordOutcome({
      tenantId,
      assessmentDefinitionId: term2DefId,
      studentId,
      rawScore: 18,
      status: 'graded',
      sourceType: 'paper_exam',
      markerId: 'marker-1',
    });
    await db.update(assessmentOutcomes).set({ createdAt: '2027-01-15 08:00:00' }).where(eq(assessmentOutcomes.id, o2!.id));

    const oOld = await OutcomeService.recordOutcome({
      tenantId,
      assessmentDefinitionId: oldDefId,
      studentId,
      rawScore: 20,
      status: 'graded',
      sourceType: 'paper_exam',
      markerId: 'marker-1',
    });
    await db.update(assessmentOutcomes).set({ createdAt: '2025-10-15 08:00:00' }).where(eq(assessmentOutcomes.id, oOld!.id));
  });

  afterAll(async () => {
    await db.delete(assessmentOutcomes).where(eq(assessmentOutcomes.tenantId, tenantId));
    await db.delete(assessmentDefinitions).where(eq(assessmentDefinitions.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('a term-1 bulletin uses ONLY term-1 marks (not term 2, not last year)', async () => {
    const { cards } = await getClassReportCards(tenantId, classSectionId, {
      termStart: TERM1.start,
      termEnd: TERM1.end,
    });
    const card = cards.find(c => c.student.id === studentId);
    expect(card).toBeDefined();
    expect(card!.subjects).toHaveLength(1);
    const subject = card!.subjects[0]!;
    expect(subject.average).toBe(12); // only the 12/20 term-1 mark
    expect(subject.assessmentCount).toBe(1);
    expect(card!.generalAverage).toBe(12);
  });

  it('a term-2 bulletin uses ONLY term-2 marks', async () => {
    const { cards } = await getClassReportCards(tenantId, classSectionId, {
      termStart: TERM2.start,
      termEnd: TERM2.end,
    });
    const card = cards.find(c => c.student.id === studentId);
    expect(card!.subjects[0]!.average).toBe(18);
  });

  it('coefficients come from the CURRENT class (4.00), not the old class (2.00)', async () => {
    const { cards } = await getClassReportCards(tenantId, classSectionId, {
      termStart: TERM1.start,
      termEnd: TERM1.end,
    });
    const card = cards.find(c => c.student.id === studentId);
    expect(card!.subjects[0]!.coefficient).toBe(4);
  });

  it('a grade entered through recordOutcome changes the bulletin', async () => {
    const term1Def2Id = crypto.randomUUID();
    await db.insert(assessmentDefinitions).values({
      id: term1Def2Id,
      tenantId,
      classSubjectId,
      title: 'Maths T1 - Devoir 2',
      maximumScore: '20.00',
      coefficient: '1.00',
      status: 'draft',
    });
    const oExtra = await OutcomeService.recordOutcome({
      tenantId,
      assessmentDefinitionId: term1Def2Id,
      studentId,
      rawScore: 16, // (12 + 16) / 2 = 14
      status: 'graded',
      sourceType: 'paper_exam',
      markerId: 'marker-1',
    });
    await db.update(assessmentOutcomes).set({ createdAt: '2026-10-20 08:00:00' }).where(eq(assessmentOutcomes.id, oExtra!.id));

    const { cards } = await getClassReportCards(tenantId, classSectionId, {
      termStart: TERM1.start,
      termEnd: TERM1.end,
    });
    const card = cards.find(c => c.student.id === studentId);
    expect(card!.subjects[0]!.average).toBe(14);
    expect(card!.subjects[0]!.assessmentCount).toBe(2);
    expect(card!.generalAverage).toBe(14);
  });

  it('refuses to issue a report card for a term without graded subjects', async () => {
    await expect(issueReportCardPdf({
      tenantId, studentId, issuedBy: studentId, templateVersionId: crypto.randomUUID(),
      termWindow: { termStart: '2028-01-01', termEnd: '2028-03-31' },
    })).rejects.toMatchObject({ status: 409, code: 'NO_GRADED_SUBJECTS' });
  });
});
