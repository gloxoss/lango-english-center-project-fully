import 'dotenv/config';
import { db } from '@/libs/DB';
import { user, studentPlacements, sessionYears } from '@/models/Schema';
import { eq } from 'drizzle-orm';

async function main() {
  const allStudents = await db.select({
    id: user.id,
    name: user.name,
    status: user.userStatus,
    tenantId: user.tenantId,
    branchId: user.branchId,
    classSectionId: user.classSectionId,
    createdAt: user.createdAt,
  }).from(user).where(eq(user.role, 'student'));

  const placements = await db.select({
    id: studentPlacements.id,
    studentId: studentPlacements.studentId,
    sessionYearId: studentPlacements.sessionYearId,
    classSectionId: studentPlacements.classSectionId,
    status: studentPlacements.status,
    startDate: studentPlacements.startDate,
  }).from(studentPlacements);

  console.log('TOTAL_STUDENTS:', allStudents.length);
  console.log('TOTAL_PLACEMENTS:', placements.length);

  const studentsWithPlacements = new Set(placements.map(p => p.studentId));
  const studentsWithoutPlacement = allStudents.filter(s => !studentsWithPlacements.has(s.id));
  console.log('LEGACY_STUDENTS_WITHOUT_PLACEMENT:', studentsWithoutPlacement.length);

  const activeSessions = await db.select({
    id: sessionYears.id,
    name: sessionYears.name,
    isDefault: sessionYears.isDefault,
  }).from(sessionYears);
  console.log('ACTIVE_SESSIONS_COUNT:', activeSessions.length);

  let activeWithoutCurrentPlacement = 0;
  for (const s of allStudents.filter(u => u.status === 'active')) {
    const hasPlacementInActiveSession = placements.some(p => p.studentId === s.id && activeSessions.some(as => as.id === p.sessionYearId));
    if (!hasPlacementInActiveSession) {
      activeWithoutCurrentPlacement++;
    }
  }
  console.log('ACTIVE_STUDENTS_WITHOUT_CURRENT_PLACEMENT:', activeWithoutCurrentPlacement);

  if (studentsWithoutPlacement.length > 0) {
    console.log('STUDENTS_WITHOUT_PLACEMENT_SAMPLE:', studentsWithoutPlacement.slice(0, 5));
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
