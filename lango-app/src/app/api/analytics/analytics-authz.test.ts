import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let currentSessionUserId: string | null = null;
vi.mock('@/libs/auth', () => ({
  auth: {
    api: {
      getSession: async () => (currentSessionUserId ? { user: { id: currentSessionUserId } } : null),
    },
  },
}));

const { db } = await import('@/libs/DB');
const { tenants, user } = await import('@/models/Schema');
const { GET } = await import('./route');

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('GET /api/analytics — role authorization', () => {
  const suffix = Date.now();
  const tenantId = crypto.randomUUID();
  const teacherId = `ANL-TEACHER-${suffix}`;
  const studentId = `ANL-STUDENT-${suffix}`;

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'Analytics Tenant', slug: `anl-${suffix}` });
    await db.insert(user).values([
      { id: teacherId, tenantId, name: 'Prof', email: `prof-${suffix}@t.local`, role: 'teacher', userStatus: 'active' },
      { id: studentId, tenantId, name: 'Etoile', email: `etu-${suffix}@t.local`, role: 'student', userStatus: 'active' },
    ]);
  });

  afterAll(async () => {
    await db.delete(user).where(eq(user.id, teacherId));
    await db.delete(user).where(eq(user.id, studentId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('blocks a teacher with 403 (leadership portal is school_admin-only)', async () => {
    currentSessionUserId = teacherId;
    const res = await GET(new Request('http://localhost/api/analytics'));
    expect(res.status).toBe(403);
  });

  it('blocks a student with 403', async () => {
    currentSessionUserId = studentId;
    const res = await GET(new Request('http://localhost/api/analytics'));
    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request', async () => {
    currentSessionUserId = null;
    const res = await GET(new Request('http://localhost/api/analytics'));
    expect([401, 403]).toContain(res.status);
  });
});
