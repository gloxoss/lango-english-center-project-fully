import { db } from '../libs/DB';
import { applicants, applicantDocuments, studentDocuments } from '../models/Schema';
import { eq } from 'drizzle-orm';

async function main() {
  const tenantId = '06ab27c5-7862-4e07-93af-49ef1935bfe6';
  const apps = await db.select().from(applicants).where(eq(applicants.tenantId, tenantId));
  console.log(`Found ${apps.length} applicants:`);
  for (const a of apps) {
    console.log(`Applicant: id=${a.id}, name=${a.firstName} ${a.lastName}, status=${a.status}, enrolledStudentId=${(a as any).enrolledStudentId}`);
    const docs = await db.select().from(applicantDocuments).where(eq(applicantDocuments.applicantId, a.id));
    console.log(`  Applicant docs:`, docs);
  }

  const sDocs = await db.select().from(studentDocuments).where(eq(studentDocuments.tenantId, tenantId));
  console.log(`Found ${sDocs.length} student docs:`, sDocs);
}

main().catch(console.error);
