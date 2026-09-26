import { randomUUID } from 'node:crypto';
import { desc, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '@/libs/DB';
import { currentTenantPrefix, reserveMatricule } from '@/libs/services/matricule';
import { namingSeries, tenants, user } from '@/models/Schema';

/**
 * Real-DB test (no mocks) for the matricule prefix resolver. The regex in
 * currentTenantPrefix lost its backslashes (`(.*D)(d{3,})`), so it never
 * matched a real matricule and every new student silently fell back to
 * STD-{year}-, opening a second series next to the school's own.
 * Discovery DISC-SETTINGS-CORE-01, matricule-analysis.md.
 */
describe('Matricule prefix continuation (SCF-01)', () => {
  const tenantExisting = randomUUID();
  const tenantEmpty = randomUUID();
  const studentExistingId = `STU-${randomUUID()}`;

  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantExisting, name: 'Matricule Tenant (existing series)', slug: `mx-${tenantExisting.slice(0, 6)}` },
      { id: tenantEmpty, name: 'Matricule Tenant (no series)', slug: `me-${tenantEmpty.slice(0, 6)}` },
    ]);

    // Tenant 1 already numbers its students ATL-2526-#### (see seed-full).
    await db.insert(user).values([
      {
        id: studentExistingId,
        tenantId: tenantExisting,
        email: `atl-${studentExistingId.slice(-8)}@example.test`,
        name: 'Élève Existant',
        matricule: 'ATL-2526-0006',
        role: 'student',
      },
      // An older row with a different format: proves the resolver reads the
      // most recent matricule, not just any row.
      {
        id: `STU-${randomUUID()}`,
        tenantId: tenantExisting,
        email: `old-${randomUUID().slice(0, 8)}@example.test`,
        name: 'Ancien Élève',
        matricule: 'STD-2019-0001',
        role: 'student',
      },
    ]);
    await db
      .update(user)
      .set({ createdAt: '2019-09-01 08:00:00' })
      .where(eq(user.matricule, 'STD-2019-0001'));
  });

  afterAll(async () => {
    await db.delete(namingSeries).where(inArray(namingSeries.tenantId, [tenantExisting, tenantEmpty]));
    await db.delete(user).where(inArray(user.tenantId, [tenantExisting, tenantEmpty]));
    await db.delete(tenants).where(inArray(tenants.id, [tenantExisting, tenantEmpty]));
  });

  it('1. currentTenantPrefix returns the format of the most recent matricule', async () => {
    await expect(currentTenantPrefix(db, tenantExisting)).resolves.toBe('ATL-2526-');
  });

  it('2. reserveMatricule continues the existing series instead of restarting STD-', async () => {
    const reserved = await db.transaction(tx => reserveMatricule(tx, tenantExisting));
    expect(reserved).toBe('ATL-2526-0007');
  });

  it('3. a tenant with no matricule yet falls back to STD-{year}-0001', async () => {
    const fallback = `STD-${new Date().getFullYear()}-`;
    await expect(currentTenantPrefix(db, tenantEmpty)).resolves.toBe(fallback);

    const reserved = await db.transaction(tx => reserveMatricule(tx, tenantEmpty));
    expect(reserved).toBe(`${fallback}0001`);
  });

  it('4. consecutive reservations advance by one and never repeat', async () => {
    const first = await db.transaction(tx => reserveMatricule(tx, tenantExisting));
    const second = await db.transaction(tx => reserveMatricule(tx, tenantExisting));

    const seq = (m: string) => Number.parseInt(m.slice('ATL-2526-'.length), 10);
    expect(second).not.toBe(first);
    expect(seq(second)).toBe(seq(first) + 1);

    // The counter must be persisted, not re-derived from user rows each call:
    // SCF-06 edits exactly this row.
    const [series] = await db
      .select()
      .from(namingSeries)
      .where(eq(namingSeries.tenantId, tenantExisting))
      .orderBy(desc(namingSeries.currentVal))
      .limit(1);
    expect(series?.prefix).toBe('ATL-2526-');
    expect(series?.currentVal).toBe(seq(second));
  });
});
