import 'dotenv/config';
import { db } from '@/libs/DB';
import { classSections } from '@/models/Schema';

async function main() {
  const sections = await db.select().from(classSections);
  console.log('TOTAL_SECTIONS:', sections.length);
  for (const s of sections) {
    console.log(`- ClassSection ${s.id} (sectionId: ${s.sectionId}): maxStudents = ${s.maxStudents}, tenantId = ${s.tenantId}`);
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
