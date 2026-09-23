import { and, count, countDistinct, eq, isNotNull, isNull } from 'drizzle-orm';
import { db } from '@/libs/DB';
import {
  academicClassOfferings,
  academicRooms,
  classScheduleSlots,
  classSections,
  classSubjects,
  classTeachers,
  subjectTeachers,
  timetableVersions,
  user,
} from '@/models/Schema';

export type ReadinessCheck = {
  id: string;
  title: string;
  score: number;
  status: 'conforme' | 'attention' | 'critique' | 'bloque';
  detail: string;
};

export type ReadinessSnapshot = {
  sessionYearId: string;
  overallScore: number;
  checks: ReadinessCheck[];
};

function statusFor(score: number, isBinary = false): ReadinessCheck['status'] {
  if (isBinary) return score === 100 ? 'conforme' : 'critique';
  return score >= 90 ? 'conforme' : score >= 50 ? 'attention' : 'critique';
}

// Computes the academic readiness score for a tenant's session year across six
// checks: class offerings, primary teachers, subject teachers, published
// timetable, room allocation, and student placement. Shared by the live GET
// endpoint and the snapshot-capture POST endpoint so both report identical
// figures.
export async function computeReadiness(tenantId: string, targetSessionId: string): Promise<ReadinessSnapshot> {
  // 1. Total sections vs offerings
  const [[totalSections], [totalOfferings]] = await Promise.all([
    db.select({ count: count() }).from(classSections).where(eq(classSections.tenantId, tenantId)),
    db
      .select({ count: count() })
      .from(academicClassOfferings)
      .where(and(eq(academicClassOfferings.tenantId, tenantId), eq(academicClassOfferings.sessionYearId, targetSessionId))),
  ]);

  const sectionCoverage = totalSections?.count ? Math.min(100, Math.round(((totalOfferings?.count ?? 0) / totalSections.count) * 100)) : 0;

  // 2. Primary teachers assigned
  const [offeringsWithPrimary] = await db
    .select({ count: count() })
    .from(academicClassOfferings)
    .innerJoin(
      classTeachers,
      and(
        eq(classTeachers.offeringId, academicClassOfferings.id),
        eq(classTeachers.role, 'primary'),
        isNull(classTeachers.endsOn),
      )
    )
    .where(and(eq(academicClassOfferings.tenantId, tenantId), eq(academicClassOfferings.sessionYearId, targetSessionId)));

  const primaryCoverage = totalOfferings?.count ? Math.min(100, Math.round(((offeringsWithPrimary?.count ?? 0) / totalOfferings.count) * 100)) : 0;

  // 3. Subject teachers assigned
  const [[totalClassSubjects], [assignedSubjects]] = await Promise.all([
    db.select({ count: count() }).from(classSubjects).where(and(eq(classSubjects.tenantId, tenantId), eq(classSubjects.isActive, true))),
    db
      .select({ count: countDistinct(classSubjects.id) })
      .from(classSubjects)
      .innerJoin(subjectTeachers, eq(subjectTeachers.classSubjectId, classSubjects.id))
      .where(and(eq(classSubjects.tenantId, tenantId), eq(classSubjects.isActive, true))),
  ]);

  const subjectCoverage = totalClassSubjects?.count ? Math.min(100, Math.round(((assignedSubjects?.count ?? 0) / totalClassSubjects.count) * 100)) : 0;

  // 4. Timetable published check
  const [publishedTimetable] = await db
    .select({ id: timetableVersions.id })
    .from(timetableVersions)
    .where(and(
      eq(timetableVersions.tenantId, tenantId),
      eq(timetableVersions.sessionYearId, targetSessionId),
      eq(timetableVersions.status, 'published'),
    ))
    .limit(1);

  const timetableScore = publishedTimetable ? 100 : 0;

  // 5. Rooms allocated
  const [[totalSlots], [slotsWithRoom]] = await Promise.all([
    db.select({ count: count() }).from(classScheduleSlots).where(eq(classScheduleSlots.tenantId, tenantId)),
    db.select({ count: count() }).from(classScheduleSlots).where(and(eq(classScheduleSlots.tenantId, tenantId), isNotNull(classScheduleSlots.roomLabel))),
  ]);

  const roomScore = totalSlots?.count ? Math.min(100, Math.round(((slotsWithRoom?.count ?? 0) / totalSlots.count) * 100)) : 0;

  // 6. Student Placement Rate (role = 'student')
  const [[totalStudents], [placedStudents]] = await Promise.all([
    db.select({ count: count() }).from(user).where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'))),
    db.select({ count: count() }).from(user).where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), isNotNull(user.classSectionId))),
  ]);

  const studentScore = totalStudents?.count ? Math.min(100, Math.round(((placedStudents?.count ?? 0) / totalStudents.count) * 100)) : 0;

  const scores = [sectionCoverage, primaryCoverage, subjectCoverage, timetableScore, roomScore, studentScore];
  const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  const checks: ReadinessCheck[] = [
    {
      id: 'class_offerings',
      title: 'Offres de Classes',
      score: sectionCoverage,
      status: totalSections?.count ? statusFor(sectionCoverage) : 'bloque',
      detail: totalSections?.count ? `${totalOfferings?.count ?? 0} / ${totalSections.count} sections ouvertes en offres.` : 'Créez des sections avant de mesurer la couverture.',
    },
    {
      id: 'primary_teachers',
      title: 'Professeurs Principaux / Titulaires',
      score: primaryCoverage,
      status: totalOfferings?.count ? statusFor(primaryCoverage) : 'bloque',
      detail: totalOfferings?.count ? `${offeringsWithPrimary?.count ?? 0} / ${totalOfferings.count} classes ont un titulaire assigné.` : 'Ouvrez les classes en offres avant de désigner leurs titulaires.',
    },
    {
      id: 'subject_teachers',
      title: 'Attribution des Matières',
      score: subjectCoverage,
      status: totalClassSubjects?.count ? statusFor(subjectCoverage) : 'bloque',
      detail: totalClassSubjects?.count ? `${assignedSubjects?.count ?? 0} / ${totalClassSubjects.count} matières ont un enseignant assigné.` : 'Configurez les matières de classe avant d’attribuer les enseignants.',
    },
    {
      id: 'timetable_published',
      title: 'Publication Emploi du Temps',
      score: timetableScore,
      status: statusFor(timetableScore, true),
      detail: publishedTimetable ? 'Emploi du temps officiel publié.' : 'Aucun emploi du temps publié pour cette session.',
    },
    {
      id: 'rooms_allocated',
      title: 'Salles de Cours Affectées',
      score: roomScore,
      status: totalSlots?.count ? statusFor(roomScore) : 'bloque',
      detail: totalSlots?.count ? `${slotsWithRoom?.count ?? 0} / ${totalSlots.count} créneaux ont une salle attribuée.` : 'Créez des créneaux avant de mesurer l’affectation des salles.',
    },
    {
      id: 'student_placements',
      title: 'Réinscription & Affectation Élèves',
      score: studentScore,
      status: totalStudents?.count ? statusFor(studentScore) : 'bloque',
      detail: totalStudents?.count ? `${placedStudents?.count ?? 0} / ${totalStudents.count} élèves affectés dans une section.` : 'Inscrivez des élèves avant de mesurer leur affectation.',
    },
  ];

  return { sessionYearId: targetSessionId, overallScore, checks };
}
