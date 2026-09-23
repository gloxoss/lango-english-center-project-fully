import { beforeEach, describe, expect, it, vi } from 'vitest';

// Visual audit pass 2, item 1 (security audit P1-C): a super admin's tenant
// scope comes ONLY from the audited httpOnly cookie written by
// /api/super-admin/tenant-context. The x-tenant-id header (custom-domain
// middleware) and ?tenantId= query param previously let a super admin enter
// any school with no audit row and no 8h bound.

const getSession = vi.fn();
const resolveActiveContext = vi.fn();

vi.mock('@/libs/auth', () => ({
  auth: { api: { getSession: (...args: unknown[]) => getSession(...args) } },
}));

vi.mock('@/libs/DB', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('@/features/portal/services/active-context', () => ({
  resolveActiveContext: (...args: unknown[]) => resolveActiveContext(...args),
}));

const mockedDB = vi.mocked(await import('@/libs/DB'));

const principal = {
  id: 'super-1',
  tenantId: null,
  branchId: null,
  role: 'super_admin',
  status: 'active',
  name: 'Platform Admin',
  email: 'platform@schoolos.ma',
  tenantActive: null,
  tenantSubscriptionStatus: null,
};

const schoolPrincipal = {
  ...principal,
  id: 'admin-1',
  tenantId: 'tenant-real',
  role: 'school_admin',
  tenantActive: true,
  tenantSubscriptionStatus: 'active',
};

function mockPrincipal(row: Record<string, unknown>) {
  vi.mocked(mockedDB.db.select).mockReturnValue({
    from: () => ({
      leftJoin: () => ({
        where: () => ({
          limit: async () => [row],
        }),
      }),
    }),
  } as never);
}

function request(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ user: { id: principal.id }, session: { id: 'sess-1' } });
  resolveActiveContext.mockResolvedValue(null);
});

describe('requireRequestContext — super admin tenant resolution (audit pass 2)', () => {
  it('super_admin with ?tenantId=X and no cookie resolves to tenantId null', async () => {
    mockPrincipal(principal);
    const { requireRequestContext } = await import('@/libs/api/context');
    const ctx = await requireRequestContext(request('http://localhost/api/students?tenantId=00000000-0000-0000-0000-000000000009'), ['super_admin']);
    expect(ctx.tenantId).toBeNull();
    expect(ctx.impersonated).toBe(false);
  });

  it('super_admin with x-tenant-id header and no cookie resolves to tenantId null', async () => {
    mockPrincipal(principal);
    const { requireRequestContext } = await import('@/libs/api/context');
    const ctx = await requireRequestContext(request('http://localhost/api/students', { 'x-tenant-id': '00000000-0000-0000-0000-000000000009' }), ['super_admin']);
    expect(ctx.tenantId).toBeNull();
  });

  it('the bypass is CLOSED: super_admin without the cookie can no longer pass school_admin routes', async () => {
    mockPrincipal(principal);
    const { requireRequestContext } = await import('@/libs/api/context');
    await expect(requireRequestContext(
      request('http://localhost/api/students?tenantId=00000000-0000-0000-0000-000000000009'),
      ['school_admin'],
    )).rejects.toMatchObject({ status: 403 });
  });

  it('super_admin with the audited cookie resolves into that tenant and is marked impersonated', async () => {
    mockPrincipal(principal);
    const { requireRequestContext } = await import('@/libs/api/context');
    const ctx = await requireRequestContext(
      request('http://localhost/api/students?tenantId=00000000-0000-0000-0000-000000000009', {
        cookie: 'schoolos_active_tenant_id=tenant-audited',
      }),
      ['school_admin'],
    );
    expect(ctx.tenantId).toBe('tenant-audited');
    expect(ctx.impersonated).toBe(true);
  });

  it('super_admin sentinel cookie values stay global', async () => {
    mockPrincipal(principal);
    const { requireRequestContext } = await import('@/libs/api/context');
    for (const value of ['none', 'all']) {
      const ctx = await requireRequestContext(
        request('http://localhost/api/students', { cookie: `schoolos_active_tenant_id=${value}` }),
      );
      expect(ctx.tenantId).toBeNull();
    }
  });

  it('non-super user with a mismatched x-tenant-id header is still refused', async () => {
    mockPrincipal(schoolPrincipal);
    const { requireRequestContext } = await import('@/libs/api/context');
    await expect(requireRequestContext(
      request('http://localhost/api/students', { 'x-tenant-id': 'tenant-other' }),
    )).rejects.toMatchObject({ status: 403 });
  });

  it('non-super user with the middleware header matching their tenant is unaffected', async () => {
    mockPrincipal(schoolPrincipal);
    const { requireRequestContext } = await import('@/libs/api/context');
    const ctx = await requireRequestContext(
      request('http://localhost/api/students', { 'x-tenant-id': 'tenant-real' }),
    );
    expect(ctx.tenantId).toBe('tenant-real');
    expect(ctx.impersonated).toBe(false);
  });
});
