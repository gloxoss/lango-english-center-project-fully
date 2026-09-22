import 'dotenv/config';
import { db } from '@/libs/DB';
import { user, studentPlacements, classSections, classes, sections, sessionYears } from '@/models/Schema';
import { eq, and } from 'drizzle-orm';

async function main() {
  const tenantId = '06ab27c5-7862-4e07-93af-49ef1935bfe6'; // Atlas

  const activeSessions = await db
    .select()
    .from(sessionYears)
    .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.isDefault, true)));

  console.log('ACTIVE DEFAULT SESSIONS:', activeSessions.map(s => ({ id: s.id, name: s.name })));

  const students = await db
    .select({
      id: user.id,
      name: user.name,
      matricule: user.matricule,
      classSectionId: user.classSectionId,
      className: user.className,
      branchId: user.branchId,
    })
    .from(user)
    .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student')));

  console.log('\nSTUDENTS in Atlas:');
  for (const s of students) {
    const placements = await db
      .select({
        id: studentPlacements.id,
        sessionYearId: studentPlacements.sessionYearId,
        classSectionId: studentPlacements.classSectionId,
        status: studentPlacements.status,
      })
      .from(studentPlacements)
      .where(and(eq(studentPlacements.tenantId, tenantId), eq(studentPlacements.studentId, s.id)));

    console.log(`- ${s.name} (${s.id}):`);
    console.log(`  user.classSectionId: ${s.classSectionId}, user.className: ${s.className}`);
    console.log(`  studentPlacements:`, placements);
  }

  const secRows = await db
    .select({
      id: classSections.id,
      classId: classSections.classId,
      className: classes.name,
      sectionName: sections.name,
      maxStudents: classSections.maxStudents,
    })
    .from(classSections)
    .innerJoin(classes, eq(classSections.classId, classes.id))
    .innerJoin(sections, eq(classSections.sectionId, sections.id))
    .where(eq(classSections.tenantId, tenantId));

  console.log('\nSECTIONS in Atlas:');
  for (const sec of secRows) {
    console.log(`- ${sec.className} ${sec.sectionName} (${sec.id}): maxStudents = ${sec.maxStudents}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
