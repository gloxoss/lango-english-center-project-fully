import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { guardians, guardianStudents, portalPreferences } from '@/models/Schema';

// Law 09-08 / CNDP: guardian consent governs use of a student's photo. Parents
// set `mediaConsent` in the parent portal (one flag per parent account). A
// student's photo is withheld as soon as ANY active linked guardian refused;
// 'unset' means nobody has answered yet (the school should collect it).
export type MediaConsentStatus = 'granted' | 'refused' | 'unset';

export async function getStudentMediaConsent(tenantId: string, studentId: string): Promise<MediaConsentStatus> {
  const linked = await db
    .select({ userId: guardians.userId })
    .from(guardianStudents)
    .innerJoin(guardians, and(eq(guardianStudents.guardianId, guardians.id), eq(guardians.tenantId, tenantId)))
    .where(and(
      eq(guardianStudents.tenantId, tenantId),
      eq(guardianStudents.studentId, studentId),
      eq(guardianStudents.status, 'active'),
    ));
  const userIds = linked.map(l => l.userId).filter((id): id is string => Boolean(id));
  if (userIds.length === 0) return 'unset';

  const prefs = await db
    .select({ value: portalPreferences.value })
    .from(portalPreferences)
    .where(and(
      eq(portalPreferences.tenantId, tenantId),
      inArray(portalPreferences.userId, userIds),
      eq(portalPreferences.prefKey, 'mediaConsent'),
    ));
  if (prefs.some(p => p.value === false)) return 'refused';
  if (prefs.some(p => p.value === true)) return 'granted';
  return 'unset';
}

/** True unless a guardian explicitly refused. */
export async function mayUseStudentPhoto(tenantId: string, studentId: string): Promise<boolean> {
  return (await getStudentMediaConsent(tenantId, studentId)) !== 'refused';
}
