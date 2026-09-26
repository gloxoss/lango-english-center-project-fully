import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '@/libs/DB';
import {
  assessmentDefinitions,
  assessmentOutcomes,
} from '@/features/assessment/models/assessment-schema';
import {
  classes,
  classSections,
  classSubjects,
  mediums,
  sections,
  subjects,
  tenants,
  user,
} from '@/models/Schema';
import { getSectionOutcomes, getStudentOutcomes } from '../services/staff-results';
import { OutcomeService } from '../services/outcome-service';
import { eq, inArray } from 'drizzle-orm';

describe('Staff Results Helper - getSectionOutcomes (schoolos_audit)', () => {
  const tenantA = crypto.randomUUID();
  const tenantB = crypto.randomUUID();

  const student1 = `stu-1-${crypto.randomUUID()}`;
  const student2 = `stu-2-${crypto.randomUUID()}`;
  const studentB = `stu-b-${crypto.randomUUID()}`;
  const teacherId = `tch-${crypto.randomUUID()}`;

  const mediumId = crypto.randomUUID();
  const classId = crypto.randomUUID();
  const sectionId = crypto.randomUUID();
  const classSectionId = crypto.randomUUID();

  const subject1Id = crypto.randomUUID();
  const subject2Id = crypto.randomUUID();

  const classSubject1Id = crypto.randomUUID();
  const classSubject2Id = crypto.randomUUID();

  const def1Sub1 = crypto.randomUUID();
  const def2Sub1 = crypto.randomUUID();
  const def1Sub2 = crypto.randomUUID();
  const def2Sub2 = crypto.randomUUID();

  beforeAll(async () => {
    // 1. Tenants
    await db.insert(tenants).values([
      { id: tenantA, name: 'Staff Results Tenant A', slug: `staff-a-${tenantA.slice(0, 8)}` },
      { id: tenantB, name: 'Staff Results Tenant B', slug: `staff-b-${tenantB.slice(0, 8)}` },
    ]);

    // 2. Academic structure
    await db.insert(mediums).values({ id: mediumId, tenantId: tenantA, name: 'Francophone' });
    await db.insert(classes).values({ id: classId, tenantId: tenantA, name: '3ème AC', mediumId });
    await db.insert(sections).values({ id: sectionId, tenantId: tenantA, name: 'Section A' });
    await db.insert(classSections).values({ id: classSectionId, tenantId: tenantA, classId, sectionId, mediumId, maxStudents: 35 });

    // 3. Subjects & Class Subjects
    await db.insert(subjects).values([
      { id: subject1Id, tenantId: tenantA, name: 'Mathématiques', code: 'MATH', mediumId, type: 'theory' },
      { id: subject2Id, tenantId: tenantA, name: 'Français', code: 'FRAN', mediumId, type: 'theory' },
    ]);

    await db.insert(classSubjects).values([
      { id: classSubject1Id, tenantId: tenantA, classId, subjectId: subject1Id, type: 'compulsory', coefficient: '3.00' },
      { id: classSubject2Id, tenantId: tenantA, classId, subjectId: subject2Id, type: 'compulsory', coefficient: '2.00' },
    ]);

    // 4. Students
    await db.insert(user).values([
      { id: student1, tenantId: tenantA, email: `${student1}@atlas.ma`, name: 'Ali Berrada', role: 'student', classSectionId },
      { id: student2, tenantId: tenantA, email: `${student2}@atlas.ma`, name: 'Nadia Mansouri', role: 'student', classSectionId },
      { id: studentB, tenantId: tenantB, email: `${studentB}@ninos.ma`, name: 'Tenant B Student', role: 'student' },
      { id: teacherId, tenantId: tenantA, email: `${teacherId}@atlas.ma`, name: 'Professeur Test', role: 'teacher' },
    ]);

    // 5. 2 assessments per subject (4 total)
    await db.insert(assessmentDefinitions).values([
      { id: def1Sub1, tenantId: tenantA, classSubjectId: classSubject1Id, title: 'Maths Devoir 1', type: 'homework', maximumScore: '20.00', coefficient: '1.00' },
      { id: def2Sub1, tenantId: tenantA, classSubjectId: classSubject1Id, title: 'Maths Examen 1', type: 'paper_exam', maximumScore: '20.00', coefficient: '1.00' },
      { id: def1Sub2, tenantId: tenantA, classSubjectId: classSubject2Id, title: 'Français Contrôle 1', type: 'quiz', maximumScore: '20.00', coefficient: '1.00' },
      { id: def2Sub2, tenantId: tenantA, classSubjectId: classSubject2Id, title: 'Français Examen 1', type: 'paper_exam', maximumScore: '20.00', coefficient: '1.00' },
    ]);

    // 6. Record outcomes for 2 students × 2 subjects × 2 assessments = 8 outcomes
    // Student 1
    await OutcomeService.recordOutcome({ tenantId: tenantA, assessmentDefinitionId: def1Sub1, studentId: student1, rawScore: 16, status: 'graded', sourceType: 'paper_exam', markerId: teacherId });
    await OutcomeService.recordOutcome({ tenantId: tenantA, assessmentDefinitionId: def2Sub1, studentId: student1, rawScore: 14, status: 'graded', sourceType: 'paper_exam', markerId: teacherId });
    await OutcomeService.recordOutcome({ tenantId: tenantA, assessmentDefinitionId: def1Sub2, studentId: student1, rawScore: 12, status: 'graded', sourceType: 'paper_exam', markerId: teacherId });
    await OutcomeService.recordOutcome({ tenantId: tenantA, assessmentDefinitionId: def2Sub2, studentId: student1, rawScore: 18, status: 'graded', sourceType: 'paper_exam', markerId: teacherId });

    // Student 2
    await OutcomeService.recordOutcome({ tenantId: tenantA, assessmentDefinitionId: def1Sub1, studentId: student2, rawScore: 10, status: 'graded', sourceType: 'paper_exam', markerId: teacherId });
    await OutcomeService.recordOutcome({ tenantId: tenantA, assessmentDefinitionId: def2Sub1, studentId: student2, rawScore: 11, status: 'graded', sourceType: 'paper_exam', markerId: teacherId });
    await OutcomeService.recordOutcome({ tenantId: tenantA, assessmentDefinitionId: def1Sub2, studentId: student2, rawScore: 13, status: 'graded', sourceType: 'paper_exam', markerId: teacherId });
    await OutcomeService.recordOutcome({ tenantId: tenantA, assessmentDefinitionId: def2Sub2, studentId: student2, rawScore: 15, status: 'graded', sourceType: 'paper_exam', markerId: teacherId });

    // Publish some, leave some draft to verify GD2 (staff reads both draft and published)
    await OutcomeService.publishOutcomes({ tenantId: tenantA, userId: teacherId, role: 'school_admin' }, { assessmentDefinitionId: def1Sub1 });
  });

  afterAll(async () => {
    await db.delete(assessmentOutcomes).where(inArray(assessmentOutcomes.tenantId, [tenantA, tenantB]));
    await db.delete(assessmentDefinitions).where(inArray(assessmentDefinitions.tenantId, [tenantA, tenantB]));
    await db.delete(classSubjects).where(inArray(classSubjects.tenantId, [tenantA, tenantB]));
    await db.delete(subjects).where(inArray(subjects.tenantId, [tenantA, tenantB]));
    await db.delete(classSections).where(inArray(classSections.tenantId, [tenantA, tenantB]));
    await db.delete(sections).where(inArray(sections.tenantId, [tenantA, tenantB]));
    await db.delete(classes).where(inArray(classes.tenantId, [tenantA, tenantB]));
    await db.delete(mediums).where(inArray(mediums.tenantId, [tenantA, tenantB]));
    await db.delete(user).where(inArray(user.tenantId, [tenantA, tenantB]));
    await db.delete(tenants).where(inArray(tenants.id, [tenantA, tenantB]));
  });

  it('retrieves all outcomes for the section across 2 students × 2 subjects × 2 assessments (8 rows)', async () => {
    const rows = await getSectionOutcomes(tenantA, classSectionId);

    expect(rows).toHaveLength(8);

    const s1Rows = rows.filter(r => r.studentId === student1);
    const s2Rows = rows.filter(r => r.studentId === student2);

    expect(s1Rows).toHaveLength(4);
    expect(s2Rows).toHaveLength(4);

    // Verify GD2: both published and draft outcomes are returned
    const published = rows.filter(r => r.moderationState === 'published');
    const draft = rows.filter(r => r.moderationState === 'draft');

    expect(published.length).toBeGreaterThan(0);
    expect(draft.length).toBeGreaterThan(0);

    // Verify subject metadata
    const mathsRows = rows.filter(r => r.subjectName === 'Mathématiques');
    const frenchRows = rows.filter(r => r.subjectName === 'Français');

    expect(mathsRows).toHaveLength(4);
    expect(mathsRows[0]!.coefficient).toBe(3);

    expect(frenchRows).toHaveLength(4);
    expect(frenchRows[0]!.coefficient).toBe(2);
  });

  it('supports single-student lookup via getStudentOutcomes', async () => {
    const s1Rows = await getStudentOutcomes(tenantA, student1);

    expect(s1Rows).toHaveLength(4);
    expect(s1Rows.every(r => r.studentId === student1)).toBe(true);
  });

  it('strictly respects tenant isolation', async () => {
    const rowsB = await getSectionOutcomes(tenantB, classSectionId);
    expect(rowsB).toHaveLength(0);
  });
});
