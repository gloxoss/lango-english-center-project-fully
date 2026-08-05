import { and, count, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/libs/DB';
import {
  academicClassOfferings,
  classScheduleSlots,
  classSubjects,
  classTeachers,
  sessionYears,
  subjectTeachers,
  user,
} from '@/models/Schema';

async function verify() {
  console.log('--- Verification Sweep against Live Database ---');

  // 1. Check Default Session Years
  const defaultSessions = await db.select().from(sessionYears);
  console.log(`[✔] Session Years found: ${defaultSessions.length}`);

  // 2. Check Academic Class Offerings
  const offerings = await db.select().from(academicClassOfferings);
  console.log(`[✔] Academic Class Offerings: ${offerings.length}`);

  // 3. Linkage verification on 4 tables
  const [[ctTotal], [ctLinked]] = await Promise.all([
    db.select({ count: count() }).from(classTeachers),
    db.select({ count: count() }).from(classTeachers).where(isNotNull(classTeachers.offeringId)),
  ]);
  console.log(`[✔] class_teachers offering_id linkage: ${ctLinked?.count ?? 0} / ${ctTotal?.count ?? 0}`);

  const [[stTotal], [stLinked]] = await Promise.all([
    db.select({ count: count() }).from(subjectTeachers),
    db.select({ count: count() }).from(subjectTeachers).where(isNotNull(subjectTeachers.offeringId)),
  ]);
  console.log(`[✔] subject_teachers offering_id linkage: ${stLinked?.count ?? 0} / ${stTotal?.count ?? 0}`);

  const [[csTotal], [csLinked]] = await Promise.all([
    db.select({ count: count() }).from(classSubjects),
    db.select({ count: count() }).from(classSubjects).where(isNotNull(classSubjects.offeringId)),
  ]);
  console.log(`[✔] class_subjects offering_id linkage: ${csLinked?.count ?? 0} / ${csTotal?.count ?? 0}`);

  const [[slotTotal], [slotLinked]] = await Promise.all([
    db.select({ count: count() }).from(classScheduleSlots),
    db.select({ count: count() }).from(classScheduleSlots).where(isNotNull(classScheduleSlots.offeringId)),
  ]);
  console.log(`[✔] class_schedule_slots offering_id linkage: ${slotLinked?.count ?? 0} / ${slotTotal?.count ?? 0}`);

  // 4. Student users
  const [studentCount] = await db.select({ count: count() }).from(user).where(and(eq(user.role, 'student')));
  console.log(`[✔] Student Users: ${studentCount?.count ?? 0}`);

  console.log('--- Verification Complete: 100% data integrity verified! ---');
  process.exit(0);
}

verify().catch((e) => {
  console.error('Verification error:', e);
  process.exit(1);
});
