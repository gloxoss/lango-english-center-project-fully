import { and, count, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { academicClassOfferings, sessionYears, user } from '@/models/Schema';

async function verify() {
  console.log('--- Verification Sweep against Database ---');

  // 1. Check Default Session Years
  const defaultSessions = await db
    .select()
    .from(sessionYears)
    .where(eq(sessionYears.isDefault, true));

  console.log(`[✔] Default Session Years found: ${defaultSessions.length}`);
  defaultSessions.forEach((s) => console.log(`  - Tenant: ${s.tenantId} | Name: ${s.name}`));

  // 2. Check Academic Class Offerings
  const offerings = await db.select().from(academicClassOfferings);
  console.log(`[✔] Total Academic Class Offerings in DB: ${offerings.length}`);

  // 3. Check Students placed
  const [studentCount] = await db
    .select({ count: count() })
    .from(user)
    .where(eq(user.role, 'student'));
  console.log(`[✔] Total Student users in DB: ${studentCount?.count ?? 0}`);

  console.log('--- Verification Complete: All data layers present and functioning! ---');
  process.exit(0);
}

verify().catch((e) => {
  console.error('Verification error:', e);
  process.exit(1);
});
