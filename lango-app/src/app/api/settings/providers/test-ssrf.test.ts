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
const { saveProviders } = await import('./_lib');
const { POST } = await import('./[id]/test/route');

const hasDb = Boolean(process.env.DATABASE_URL);

function provider(id: string, endpointUrl: string) {
  return {
    id, name: 'Evil', category: 'smtp', providerName: 'test', endpointUrl,
    status: 'disconnected' as const, latencyMs: 0, ownerName: 'x',
    quotaUsed: 0, quotaTotal: 0, quotaUnit: 'mois', senderId: 'SENDER',
    lastPing: '—',
  };
}

describe.skipIf(!hasDb)('POST /api/settings/providers/[id]/test — SSRF guard', () => {
  const suffix = Date.now();
  const tenantId = crypto.randomUUID();
  const adminId = `SSRF-ADMIN-${suffix}`;
  const ctx = { userId: adminId, tenantId, branchId: null, role: 'school_admin' as const, baseRole: 'school_admin' as const, name: 'S', email: 's@t.local' };

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'SSRF Tenant', slug: `ssrf-${suffix}` });
    await db.insert(user).values({ id: adminId, tenantId, name: 'S', email: `s-${suffix}@t.local`, role: 'school_admin', userStatus: 'active' });
    await saveProviders(tenantId, null, [provider('p-loopback', 'http://127.0.0.1:8080')], ctx);
  });

  afterAll(async () => {
    const { settingValues } = await import('@/models/Schema');
    await db.delete(settingValues).where(eq(settingValues.tenantId, tenantId));
    await db.delete(user).where(eq(user.id, adminId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  async function testEndpoint(id: string): Promise<Response> {
    return POST(new Request(`http://localhost/api/settings/providers/${id}/test`, { method: 'POST' }), { params: Promise.resolve({ id }) });
  }

  it('rejects an internal endpoint without making a request', async () => {
    currentSessionUserId = adminId;
    const res = await testEndpoint('p-loopback');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('SSRF_BLOCKED');
  });

  it('unauthenticated request is rejected before any validation', async () => {
    currentSessionUserId = null;
    const res = await testEndpoint('p-loopback');
    expect([401, 403]).toContain(res.status);
  });
});
