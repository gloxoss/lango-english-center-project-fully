import 'dotenv/config';
import { db } from '@/libs/DB';
import { classSections } from '@/models/Schema';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Reverting fabricated capacity backfill on class_sections...');

  const reverted = await db
    .update(classSections)
    .set({
      maxStudents: null,
      updatedAt: sql`NOW()`,
    })
    .returning({ id: classSections.id, maxStudents: classSections.maxStudents });

  console.log(`Reverted maxStudents to null for ${reverted.length} sections:`);
  for (const r of reverted) {
    console.log(`- ${r.id}: maxStudents = ${r.maxStudents}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Revert failed:', err);
  process.exit(1);
});
