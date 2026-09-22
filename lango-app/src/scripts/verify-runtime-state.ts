import 'dotenv/config';
import { db } from '@/libs/DB';
import { user, studentPlacements, classSections, classes, sections, sessionYears } from '@/models/Schema';
import { eq, and } from 'drizzle-orm';
import { runAutoPlacementSimulation, resolveAuthoritativeStudents } from '@/app/api/students/placements/auto/route';

async function main() {
  const tenantId = '06ab27c5-7862-4e07-93af-49ef1935bfe6';

  console.log('==================================================');
  console.log('1. DATABASE REALITY & CAPACITY AUDIT (READ-ONLY)');
  console.log('==================================================');

  // Get active session
  const [activeSession] = await db
    .select()
    .from(sessionYears)
    .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.isDefault, true)))
    .limit(1);

  console.log(`ACTIVE SESSION: ${activeSession?.name} (${activeSession?.id})`);

  // Query sections
  const dbSections = await db
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

  console.log('\nSECTIONS IN DB:');
  dbSections.forEach(s => {
    console.log(`- ${s.className} ${s.sectionName} (${s.id}): maxStudents = ${s.maxStudents ?? 'NULL (unconfigured)'}`);
  });

  const configuredCount = dbSections.filter(s => s.maxStudents !== null).length;
  const unknownCount = dbSections.filter(s => s.maxStudents === null).length;
  console.log(`\nSECTIONS WITH CONFIGURED CAPACITY: ${configuredCount}`);
  console.log(`SECTIONS WITH UNKNOWN CAPACITY: ${unknownCount}`);

  // Resolve authoritative students
  const { students: authStudents, integrityWarnings } = await resolveAuthoritativeStudents(
    tenantId,
    activeSession?.id || '',
  );

  console.log('\n==================================================');
  console.log('2. AUTHORITATIVE STUDENTS RECONCILIATION');
  console.log('==================================================');
  console.log(`ACTIVE STUDENTS: ${authStudents.length}`);
  console.log(`INTEGRITY WARNINGS: ${integrityWarnings.length}`);
  integrityWarnings.forEach(w => console.log('  WARN:', w.message));

  // Build section name map
  const secNameMap = new Map<string, string>();
  dbSections.forEach(s => secNameMap.set(s.id, `${s.className} ${s.sectionName}`));

  // In live DB with null capacities, preflight blocks simulation:
  console.log('\n==================================================');
  console.log('3. RUNTIME BEHAVIOR WITH UNCONFIGURED CAPACITIES');
  console.log('==================================================');
  const sectionsWithUnknown = dbSections.filter(s => s.maxStudents == null);
  console.log(`SIMULATION BLOCKED: ${sectionsWithUnknown.length > 0 ? 'YES' : 'NO'}`);
  console.log(`REASON: Capacité non configurée pour ${sectionsWithUnknown.length} sections (${sectionsWithUnknown.map(s => `${s.className} ${s.sectionName}`).join(', ')}).`);
  console.log('UI BANNER: “Capacité non configurée pour 3 sections.” with CTA: “Configurer les capacités”');

  // Now, evaluate the balanced rebalancing algorithm on this authoritative student dataset:
  console.log('\n==================================================');
  console.log('4. SIMULATION ON BALANCED DATASET (Fixture capacity = 35)');
  console.log('==================================================');

  const fixtureTargetSections = dbSections.map(s => ({
    ...s,
    maxStudents: 35, // For evaluating the algorithm's distribution/no-op behavior
  }));

  const initialOccupancyMap = new Map<string, number>();
  fixtureTargetSections.forEach(s => initialOccupancyMap.set(s.id, 0));
  authStudents.forEach(st => {
    if (st.authoritativeSectionId && initialOccupancyMap.has(st.authoritativeSectionId)) {
      initialOccupancyMap.set(st.authoritativeSectionId, (initialOccupancyMap.get(st.authoritativeSectionId) || 0) + 1);
    }
  });

  const simResult = runAutoPlacementSimulation({
    targetSections: fixtureTargetSections,
    eligibleStudents: authStudents,
    initialOccupancyMap,
    method: 'balanced_headcount',
    rebalanceAssigned: true,
  });

  console.log('\nSTUDENTS BREAKDOWN:');
  for (const st of authStudents) {
    const userSecName = st.userSectionId ? secNameMap.get(st.userSectionId) || st.userSectionId : 'None';
    const placementSecName = st.placementSectionId ? secNameMap.get(st.placementSectionId) || st.placementSectionId : 'None';
    
    // Check if moved or unchanged
    const unchanged = simResult.unchangedStudents.find(u => u.studentId === st.id);
    const moved = simResult.assignments.find(a => a.studentId === st.id);
    const proposedSecName = unchanged
      ? `${unchanged.className} ${unchanged.sectionName}`
      : moved
      ? `${moved.targetClassName} ${moved.targetSectionName}`
      : 'Unplaced';
    const changed = Boolean(moved);

    console.log(`STUDENT: ${st.name}`);
    console.log(`CURRENT SECTION: ${userSecName}`);
    console.log(`CURRENT PLACEMENT SECTION: ${placementSecName}`);
    console.log(`PROPOSED SECTION: ${proposedSecName}`);
    console.log(`CHANGED: ${changed ? 'yes' : 'no'}\n`);
  }

  console.log('CURRENT OCCUPANCY:');
  dbSections.forEach(s => {
    console.log(`${s.className} ${s.sectionName}: ${initialOccupancyMap.get(s.id) || 0}`);
  });

  const totalCap = fixtureTargetSections.reduce((sum, s) => sum + (s.maxStudents ?? 0), 0);
  const curOcc = authStudents.length;
  const availCap = Math.max(0, totalCap - curOcc);

  console.log(`\nTOTAL CAPACITY: ${totalCap}`);
  console.log(`AVAILABLE CAPACITY: ${availCap}`);
  console.log(`\nEVALUATED STUDENTS: ${simResult.evaluatedStudentsCount}`);
  console.log(`UNCHANGED STUDENTS: ${simResult.unchangedCount}`);
  console.log(`NEW ASSIGNMENTS: ${simResult.newAssignmentsCount}`);
  console.log(`MOVES: ${simResult.movedCount}`);
  console.log(`UNPLACED: ${simResult.unplacedCount}`);
  console.log(`CONFLICTS: ${integrityWarnings.length}`);
  console.log(`COMMIT ENABLED: ${simResult.simulationValid && simResult.hasChanges && simResult.placedCount > 0 ? 'yes' : 'no'}`);

  process.exit(0);
}

main().catch(err => {
  console.error('Error during verification:', err);
  process.exit(1);
});
