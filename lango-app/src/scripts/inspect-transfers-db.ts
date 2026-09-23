import { db } from '@/libs/DB';
import { auditLogs, branches, classes, classSections, guardianStudents, invoices, studentPlacements, user } from '@/models/Schema';
import { eq } from 'drizzle-orm';

async function main() {
  const tenantId = '06ab27c5-7862-4e07-93af-49ef1935bfe6';
  
  const logs = await db.select().from(auditLogs).where(eq(auditLogs.tenantId, tenantId));
  const transferLogs = logs.filter(l => l.entityType === 'student_transfer' || l.entityType === 'student');
  console.log('Transfer / Student audit logs count:', transferLogs.length);
  for (const l of transferLogs) {
    console.log(`- ${l.createdAt}: entityType=${l.entityType}, action=${l.action}, entityId=${l.entityId}, meta=`, l.metadata);
  }

  const invs = await db.select().from(invoices).where(eq(invoices.tenantId, tenantId));
  console.log('Invoices count:', invs.length);

  const guardians = await db.select().from(guardianStudents).where(eq(guardianStudents.tenantId, tenantId));
  console.log('GuardianStudents count:', guardians.length);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
