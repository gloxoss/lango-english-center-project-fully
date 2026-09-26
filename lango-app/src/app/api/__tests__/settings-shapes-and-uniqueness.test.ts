import { readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '@/libs/DB';
import { schoolSettings, settingValues, tenants } from '@/models/Schema';

/**
 * Migrations 0167 and 0168 (SCF-03-02, SCF-10-02).
 *
 * 0167: the seed wrote `languages: ["fr","ar"]` and
 * `presenceModes: ["morning","afternoon"]` while every reader expects objects.
 * That is what produced the "0 / 1" toggles and the 422 when a director saved
 * the Organisation page without changing anything.
 *
 * 0168: the unique index on setting_values did not cover tenant-wide rows
 * (branch_id IS NULL), because Postgres treats NULLs as distinct.
 */
describe('Settings JSON shapes and tenant-wide uniqueness', () => {
  const tenantId = randomUUID();

  beforeAll(async () => {
    await db.insert(tenants).values({
      id: tenantId,
      name: 'Shapes Tenant',
      slug: `sh-${tenantId.slice(0, 8)}`,
    });
  });

  afterAll(async () => {
    await db.delete(settingValues).where(eq(settingValues.tenantId, tenantId));
    await db.delete(schoolSettings).where(eq(schoolSettings.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('1. no school_settings row carries an array where an object is expected', async () => {
    const rows = await db.select().from(schoolSettings);
    for (const row of rows) {
      if (row.languages != null) {
        expect(Array.isArray(row.languages)).toBe(false);
        expect(Object.keys(row.languages as object).sort()).toEqual(['anglais', 'arabe', 'francais']);
      }
      if (row.presenceModes != null) {
        expect(Array.isArray(row.presenceModes)).toBe(false);
        expect(Object.keys(row.presenceModes as object).sort()).toEqual([
          'absenceJustifiee', 'absenceNonJustifiee', 'afternoon',
          'morning', 'presence', 'retard', 'sortieAnticipee',
        ]);
      }
      if (row.documentHeaderStyle != null) {
        expect(['classique', 'minimal', 'moderne']).toContain(row.documentHeaderStyle);
      }
    }
  });

  it('2. the registry keys that mirror those columns hold objects too', async () => {
    const rows = await db
      .select()
      .from(settingValues)
      .where(inArray(settingValues.key, ['localization.languages', 'attendance.presenceModes']));

    for (const row of rows) {
      expect(Array.isArray(row.value)).toBe(false);
      expect(typeof row.value).toBe('object');
    }
  });

  it('3. the seed no longer writes the shapes that caused this', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'src/scripts/seed-full.ts'),
      'utf8',
    );
    // The two array literals and the invalid enum member. A regression here
    // recreates the bug on every freshly seeded database.
    expect(source).not.toMatch(/presenceModes:\s*\[/);
    expect(source).not.toMatch(/languages:\s*\['/);
    expect(source).not.toMatch(/documentHeaderStyle:\s*'classic'/);
  });

  it('4. a second tenant-wide setting for the same key is refused (0168)', async () => {
    await db.insert(settingValues).values({ tenantId, branchId: null, key: 'shapes.test.key', value: 1 });
    const duplicate = db
      .insert(settingValues)
      .values({ tenantId, branchId: null, key: 'shapes.test.key', value: 2 });

    await expect(duplicate).rejects.toThrow();

    const rows = await db
      .select()
      .from(settingValues)
      .where(and(eq(settingValues.tenantId, tenantId), eq(settingValues.key, 'shapes.test.key')));
    expect(rows).toHaveLength(1);
  });

  it('5. a branch-scoped row may still coexist with the tenant-wide one', async () => {
    // NULLS NOT DISTINCT must not accidentally collapse distinct branches.
    const branchA = randomUUID();
    const branchB = randomUUID();
    await db.insert(settingValues).values([
      { tenantId, branchId: branchA, key: 'shapes.test.key', value: 10 },
      { tenantId, branchId: branchB, key: 'shapes.test.key', value: 20 },
    ]);

    const rows = await db
      .select()
      .from(settingValues)
      .where(and(eq(settingValues.tenantId, tenantId), eq(settingValues.key, 'shapes.test.key')));
    expect(rows).toHaveLength(3);
  });
});
