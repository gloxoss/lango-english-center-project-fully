// Audit 3 P1-M: guardian media consent (CNDP) decides whether a student's photo
// may be used. Any active guardian's explicit refusal wins. Real DB.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { getStudentMediaConsent, mayUseStudentPhoto } from '@/features/students/services/media-consent';
import { resolveSubjectData } from '@/features/cards/services/issue-service';
import { guardians, guardianStudents, portalPreferences, tenants, user } from '@/models/Schema';

async function checkDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('student media consent', () => {
  const suffix = Date.now().toString(36);
  const tenantId = crypto.randomUUID();
  const ids = {
    noGuardian: `stu-mc-none-${suffix}`,
    granted: `stu-mc-ok-${suffix}`,
    refused: `stu-mc-no-${suffix}`,
    parentYes: `par-mc-yes-${suffix}`,
    parentNo: `par-mc-no-${suffix}`,
  };
  const gYes = crypto.randomUUID();
  const gNo = crypto.randomUUID();

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: `MC ${suffix}`, slug: `mc-${suffix}` });
    await db.insert(user).values([
      { id: ids.noGuardian, tenantId, name: 'Sans Tuteur', email: `${ids.noGuardian}@t.local`, role: 'student', photoUrl: 'students/x.jpg' },
      { id: ids.granted, tenantId, name: 'Photo Ok', email: `${ids.granted}@t.local`, role: 'student', photoUrl: 'students/y.jpg' },
      { id: ids.refused, tenantId, name: 'Photo Refusee', email: `${ids.refused}@t.local`, role: 'student', photoUrl: 'students/z.jpg' },
      { id: ids.parentYes, tenantId, name: 'Parent Oui', email: `${ids.parentYes}@t.local`, role: 'parent' },
      { id: ids.parentNo, tenantId, name: 'Parent Non', email: `${ids.parentNo}@t.local`, role: 'parent' },
    ]);
    await db.insert(guardians).values([
      { id: gYes, tenantId, userId: ids.parentYes, firstName: 'Oui', lastName: 'Parent' },
      { id: gNo, tenantId, userId: ids.parentNo, firstName: 'Non', lastName: 'Parent' },
    ]);
    await db.insert(guardianStudents).values([
      { tenantId, guardianId: gYes, studentId: ids.granted, relationshipType: 'mother' },
      // The refused child has one consenting and one refusing guardian: refusal wins.
      { tenantId, guardianId: gYes, studentId: ids.refused, relationshipType: 'mother' },
      { tenantId, guardianId: gNo, studentId: ids.refused, relationshipType: 'father' },
    ]);
    await db.insert(portalPreferences).values([
      { tenantId, userId: ids.parentYes, prefKey: 'mediaConsent', value: true },
      { tenantId, userId: ids.parentNo, prefKey: 'mediaConsent', value: false },
    ]);
  }, 30_000);

  afterAll(async () => {
    await db.delete(portalPreferences).where(eq(portalPreferences.tenantId, tenantId));
    await db.delete(guardianStudents).where(eq(guardianStudents.tenantId, tenantId));
    await db.delete(guardians).where(eq(guardians.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  }, 30_000);

  it('is unset when no guardian answered, granted or refused otherwise', async () => {
    expect(await getStudentMediaConsent(tenantId, ids.noGuardian)).toBe('unset');
    expect(await getStudentMediaConsent(tenantId, ids.granted)).toBe('granted');
    expect(await getStudentMediaConsent(tenantId, ids.refused)).toBe('refused');
  });

  it('any refusal blocks photo use; unset and granted allow it', async () => {
    expect(await mayUseStudentPhoto(tenantId, ids.refused)).toBe(false);
    expect(await mayUseStudentPhoto(tenantId, ids.granted)).toBe(true);
    expect(await mayUseStudentPhoto(tenantId, ids.noGuardian)).toBe(true);
  });

  it('a student card drops the photo when a guardian refused', async () => {
    const refused = await resolveSubjectData(tenantId, 'student', ids.refused);
    expect(refused.data.photo).toBe('');
    const granted = await resolveSubjectData(tenantId, 'student', ids.granted);
    expect(granted.data.photo).toContain(ids.granted);
  });
});
