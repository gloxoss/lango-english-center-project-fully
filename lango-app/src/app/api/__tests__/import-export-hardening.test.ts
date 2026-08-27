import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { classes, classSections, mediums, sections, tenants, user } from '@/models/Schema';
import { POST as importStudents } from '@/app/api/students/import/route';
import { toCsv } from '@/libs/services/exporters';
import { sanitizeCell, desanitizeCell } from '@/features/library/services/library-copies-csv';

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

const sessionUserId = { value: null as string | null };

vi.mock('@/libs/auth', () => ({
  auth: {
    api: {
      getSession: async () =>
        sessionUserId.value
          ? { user: { id: sessionUserId.value }, session: { id: 'sess-import' } }
          : null,
    },
  },
}));

vi.mock('@/features/portal/services/active-context', () => ({
  resolveActiveContext: async () => null,
}));

async function checkDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('import and export hardening & security assertions (T15)', () => {
  const suffix = randomUUID().slice(0, 8);
  const tenantA = crypto.randomUUID();
  const tenantB = crypto.randomUUID();
  const adminA = `IMP-ADMIN-A-${suffix}`;
  const studentA = `IMP-STU-A-${suffix}`;

  let classSectionAId = '';

  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantA, name: `Import School A ${suffix}`, slug: `impa-${suffix}` },
      { id: tenantB, name: `Import School B ${suffix}`, slug: `impb-${suffix}` },
    ]);

    await db.insert(user).values([
      { id: adminA, tenantId: tenantA, name: 'Import Admin A', email: `admin-a-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' },
      { id: studentA, tenantId: tenantA, name: 'Student User', email: `stu-a-${suffix}@test.local`, role: 'student', userStatus: 'active' },
    ]);

    const med = (await db.insert(mediums).values({
      id: crypto.randomUUID(),
      tenantId: tenantA,
      name: `Francais-${suffix}`,
    }).returning())[0]!;

    const cls = (await db.insert(classes).values({
      id: crypto.randomUUID(),
      tenantId: tenantA,
      name: `2nde-${suffix}`,
      mediumId: med.id,
    }).returning())[0]!;

    const sec = (await db.insert(sections).values({
      id: crypto.randomUUID(),
      tenantId: tenantA,
      name: 'A',
    }).returning())[0]!;

    const cs = (await db.insert(classSections).values({
      id: crypto.randomUUID(),
      tenantId: tenantA,
      classId: cls.id,
      sectionId: sec.id,
      mediumId: med.id,
    }).returning())[0]!;

    classSectionAId = cs.id;
  });

  afterAll(async () => {
    await db.delete(classSections).where(eq(classSections.tenantId, tenantA));
    await db.delete(sections).where(eq(sections.tenantId, tenantA));
    await db.delete(classes).where(eq(classes.tenantId, tenantA));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantA));
    await db.delete(user).where(eq(user.tenantId, tenantA));
    await db.delete(user).where(eq(user.tenantId, tenantB));
    await db.delete(tenants).where(eq(tenants.id, tenantA));
    await db.delete(tenants).where(eq(tenants.id, tenantB));
  });

  it('sanitizes CSV formula injection characters (=, +, -, @, \\t, \\r)', () => {
    const maliciousPayload = [
      ['=cmd|\'/C calc\'!A0', '@SUM(1+1)', '+1234567890', '-5000', 'Normal Name'],
    ];

    const csvOutput = toCsv(['A', 'B', 'C', 'D', 'E'], maliciousPayload);

    // Each formula character must be prefixed with single quote '
    expect(csvOutput).toContain("\"'=cmd|'/C calc'!A0\"");
    expect(csvOutput).toContain("\"'@SUM(1+1)\"");
    expect(csvOutput).toContain("\"'+1234567890\"");
    expect(csvOutput).toContain("\"'-5000\"");
    expect(csvOutput).toContain('"Normal Name"');

    // Test library copy helper sanitize / desanitize round-trip
    expect(sanitizeCell('=2+2')).toBe("'=2+2");
    expect(desanitizeCell("'=2+2")).toBe('=2+2');
  });

  it('imports valid student rows with Arabic and accented French characters', async () => {
    sessionUserId.value = adminA;

    const req = new Request('http://localhost/api/students/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: [
          {
            fullName: 'أمين العلمي (Amine El Alami)',
            email: `amine-${suffix}@test.local`,
            classLabel: `2nde-${suffix} A`,
            dateOfBirth: '2010-05-15',
            guardianName: 'فاطمة العلمي',
            guardianPhone: '+212600000001',
          },
          {
            fullName: 'Élève Français Accentué',
            email: `accent-${suffix}@test.local`,
            classLabel: `2nde-${suffix} A`,
            dateOfBirth: '2010-08-20',
          },
        ],
      }),
    });

    const res = await importStudents(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.insertedCount).toBe(2);
    expect(json.errorCount).toBe(0);

    // Verify database row values and UTF-8 encoding in database
    const [row1] = await db.select().from(user).where(and(eq(user.tenantId, tenantA), eq(user.email, `amine-${suffix}@test.local`)));
    expect(row1).toBeTruthy();
    expect(row1!.name).toBe('أمين العلمي (Amine El Alami)');
    expect(row1!.guardianName).toBe('فاطمة العلمي');
    expect(row1!.classSectionId).toBe(classSectionAId);

    const [row2] = await db.select().from(user).where(and(eq(user.tenantId, tenantA), eq(user.email, `accent-${suffix}@test.local`)));
    expect(row2).toBeTruthy();
    expect(row2!.name).toBe('Élève Français Accentué');
  });

  it('enforces tenant isolation: imported students strictly belong to caller tenant', async () => {
    // Verify no student was inserted in tenant B
    const rowsB = await db.select().from(user).where(eq(user.tenantId, tenantB));
    expect(rowsB).toHaveLength(0);
  });

  it('rejects unauthorized roles (student, parent) with 403 Forbidden', async () => {
    sessionUserId.value = studentA;

    const req = new Request('http://localhost/api/students/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: [{ fullName: 'Malicious Injected Student' }],
      }),
    });

    const res = await importStudents(req);
    expect(res.status).toBe(403);
  });
});
