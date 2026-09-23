import { db } from '@/libs/DB';
import { classSections, classes, sections, studentPlacements } from '@/models/Schema';
import { eq, and, count } from 'drizzle-orm';

async function main() {
  const tenantId = '06ab27c5-7862-4e07-93af-49ef1935bfe6';
  const rows = await db
    .select({
      id: classSections.id,
      className: classes.name,
      sectionName: sections.name,
      maxStudents: classSections.maxStudents,
      branchId: classes.branchId,
    })
    .from(classSections)
    .innerJoin(classes, eq(classSections.classId, classes.id))
    .innerJoin(sections, eq(classSections.sectionId, sections.id))
    .where(eq(classSections.tenantId, tenantId));

  for (const r of rows) {
    const [p] = await db
      .select({ c: count() })
      .from(studentPlacements)
      .where(and(
        eq(studentPlacements.tenantId, tenantId),
        eq(studentPlacements.classSectionId, r.id),
        eq(studentPlacements.isCurrent, true),
      ));
    console.log(`Section: ${r.className} (${r.sectionName}) [id=${r.id}] -> max: ${r.maxStudents}, enrolled: ${p?.c}, branchId: ${r.branchId}`);
  }
}

main().catch(console.error);
