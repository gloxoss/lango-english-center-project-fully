import fs from 'node:fs';
import path from 'node:path';
import { and, eq, like } from 'drizzle-orm';
import { computeHmacHash } from '@/libs/api/badge-crypto';
import { db } from '@/libs/DB';
import {
  classScheduleSlots,
  classSections,
  classSubjects,
  classes,
  identityBadgeCredentials,
  tenants,
  timetableVersions,
  user,
} from '@/models/Schema';

// DEMO SEED for the scanning flows (fix-plan-02).
//
// Both scanning homes only do something while a lesson is inside its register
// window, so outside school hours every screen is legitimately empty and neither
// flow can be shown or screenshotted. This adds the minimum that makes them
// live, and nothing else:
//
//   * one timetable slot, marked by its room label, whose window STRADDLES NOW
//     (so it works whatever hour this is run at), for one real section with a
//     real teacher who has a login;
//   * known badge tokens for a handful of that section's students, so a scan can
//     be driven from a script — the badges the seed already ships hash their
//     tokens, so their raw tokens cannot be recovered from the database.
//
// Idempotent: re-running moves the demo window to the current time and leaves one
// badge per student. Rows are marked so they can be found and removed again:
// the slot by its room label, the credentials by the token prefix.
//
//   npx tsx scripts/seed-attendance-demo.ts            # add / refresh demo data
//   npx tsx scripts/seed-attendance-demo.ts --remove   # take it all back out
//
// It refuses to run against anything but the audit database: this is demo data
// and must never land in a real one.

const DEMO_ROOM = 'DEMO-SEANCE';

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = rawLine.trim().match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1]!.trim()]) {
      process.env[match[1]!.trim()] = match[2]!.trim();
    }
  }
}

/** Casablanca wall clock, which is the only clock the attendance code trusts. */
function casablanca(now = new Date()) {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Casablanca',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Casablanca',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? '0');
  const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Casablanca', weekday: 'long' })
    .format(now)
    .toLowerCase();
  return { iso, minutes: hour * 60 + minute, weekday };
}

const hm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

async function main() {
  loadLocalEnv();

  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('schoolos_audit')) {
    console.error('Refusing to run: DATABASE_URL must point at schoolos_audit.');
    console.error(`  got: ${url.replace(/:[^:@]*@/, ':****@')}`);
    process.exit(1);
  }

  const remove = process.argv.includes('--remove');
  const { iso: today, minutes: nowMinutes, weekday } = casablanca();

  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, 'atlas'))
    .limit(1);
  if (!tenant) {
    console.error('No atlas tenant found.');
    process.exit(1);
  }
  const tenantId = tenant.id;

  // The teacher comes first, and the lesson is placed in THAT teacher's campus.
  // Order matters: the scan path compares the student's campus with the
  // operator's and refuses a mismatch, so a lesson built in another branch can
  // be opened but never scanned into — the flow would look wired up and do
  // nothing. Deriving the section from the teacher's branch prevents that.
  const [teacher] = await db
    .select({ id: user.id, email: user.email, branchId: user.branchId })
    .from(user)
    .where(and(eq(user.tenantId, tenantId), like(user.email, 'prof.05@%')))
    .limit(1);

  if (!teacher?.branchId) {
    console.error('No teacher prof.05 with a campus found; the demo needs one who can log in.');
    process.exit(1);
  }

  const [section] = await db
    .select({
      sectionId: classSections.id,
      classId: classSections.classId,
    })
    .from(classSections)
    .innerJoin(classes, eq(classes.id, classSections.classId))
    .innerJoin(classSubjects, eq(classSubjects.classId, classSections.classId))
    .where(and(eq(classSections.tenantId, tenantId), eq(classes.branchId, teacher.branchId)))
    .limit(1);

  if (!section) {
    console.error(`No class section in the campus of ${teacher.email}.`);
    process.exit(1);
  }

  const students = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(and(eq(user.tenantId, tenantId), eq(user.classSectionId, section.sectionId), eq(user.role, 'student')))
    .limit(8);

  if (remove) {
    await db.delete(classScheduleSlots).where(and(
      eq(classScheduleSlots.tenantId, tenantId),
      eq(classScheduleSlots.roomLabel, DEMO_ROOM),
    ));
    // A badge stores only the hash of its token, so the demo badges are found by
    // recomputing the hash of the token this script issued — no marker column and
    // no chance of deleting a real badge. This walks EVERY student of the tenant
    // rather than the current section, so changing the demo section between runs
    // cannot strand badges behind.
    const everyone = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student')));

    let badgesRemoved = 0;
    for (const student of everyone) {
      const gone = await db.delete(identityBadgeCredentials).where(and(
        eq(identityBadgeCredentials.tenantId, tenantId),
        eq(identityBadgeCredentials.userId, student.id),
        eq(identityBadgeCredentials.tokenHash, computeHmacHash(`demo-${student.id}`)),
      )).returning({ id: identityBadgeCredentials.id });
      badgesRemoved += gone.length;
    }
    console.log(`Demo data removed (lesson + ${badgesRemoved} badge(s)).`);
    process.exit(0);
  }

  const [classSubject] = await db
    .select({ id: classSubjects.id })
    .from(classSubjects)
    .where(and(eq(classSubjects.tenantId, tenantId), eq(classSubjects.classId, section.classId)))
    .limit(1);

  const [version] = await db
    .select({ id: timetableVersions.id })
    .from(timetableVersions)
    .where(and(eq(timetableVersions.tenantId, tenantId), eq(timetableVersions.status, 'published')))
    .limit(1);

  if (!classSubject || !version) {
    console.error('Need a class subject and a published timetable version to place the demo lesson.');
    process.exit(1);
  }

  // A window that straddles now, whatever hour this runs at: the register opens
  // 5 min before the start and closes 15 min after the end, so this stays live
  // for well over an hour.
  const start = Math.max(0, nowMinutes - 10);
  const end = Math.min(23 * 60 + 55, start + 100);

  const [existingSlot] = await db
    .select({ id: classScheduleSlots.id })
    .from(classScheduleSlots)
    .where(and(
      eq(classScheduleSlots.tenantId, tenantId),
      eq(classScheduleSlots.classSectionId, section.sectionId),
      eq(classScheduleSlots.roomLabel, DEMO_ROOM),
    ))
    .limit(1);

  const slotValues = {
    tenantId,
    classSectionId: section.sectionId,
    classSubjectId: classSubject.id,
    teacherId: teacher.id,
    dayOfWeek: weekday as 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
    startTime: hm(start),
    endTime: hm(end),
    roomLabel: DEMO_ROOM,
    versionId: version.id,
  };

  if (existingSlot) {
    await db.update(classScheduleSlots).set(slotValues).where(eq(classScheduleSlots.id, existingSlot.id));
  } else {
    await db.insert(classScheduleSlots).values(slotValues);
  }

  let issued = 0;
  for (const student of students) {
    // A token we know, so a scan can be scripted. The demo badge is identified by
    // ITS OWN hash, not by "does this student already have a badge" — every
    // seeded student already holds a real one whose token cannot be recovered,
    // so the looser test skipped everyone and left nothing to scan with.
    const tokenHash = computeHmacHash(`demo-${student.id}`);
    const [already] = await db
      .select({ id: identityBadgeCredentials.id })
      .from(identityBadgeCredentials)
      .where(and(
        eq(identityBadgeCredentials.tenantId, tenantId),
        eq(identityBadgeCredentials.userId, student.id),
        eq(identityBadgeCredentials.tokenHash, tokenHash),
      ))
      .limit(1);
    if (already) {
      continue;
    }

    await db.insert(identityBadgeCredentials).values({
      tenantId,
      userId: student.id,
      tokenHash,
      status: 'active',
    });
    issued += 1;
  }

  console.log(`Demo lesson: ${weekday} ${hm(start)}-${hm(end)} (${DEMO_ROOM}) for section ${section.sectionId}`);
  console.log(`Teacher who may activate it: ${teacher.email} (${teacher.id})`);
  console.log(`Badges issued to ${issued} of ${students.length} students.`);
  for (const student of students) {
    console.log(`  ${student.id}  ${student.name}`);
  }
  console.log('');
  console.log('Today (Casablanca):', today);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
