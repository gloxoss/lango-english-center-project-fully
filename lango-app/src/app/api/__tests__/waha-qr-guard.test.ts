import { beforeEach, describe, expect, it, vi } from 'vitest';

// Security audit P0-A: the WAHA QR route previously accepted endpointUrl,
// apiKey and session from the QUERY STRING with no role/capability/addon
// guard — any logged-in parent or student could use the server as a
// full-read SSRF proxy, exfiltrate the WAHA key, or read another school's
// pairing QR. The route now derives everything server-side.

const requireRequestContext = vi.fn();
const requireCapability = vi.fn();
const requireAddon = vi.fn();
const getConnectionWithSecrets = vi.fn();

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: (...args: unknown[]) => requireRequestContext(...args),
  requireTenant: (ctx: { tenantId: string | null }) => {
    if (!ctx.tenantId) throw new (require('@/libs/api/errors').ApiError)(403, 'TENANT_REQUIRED', 'tenant required');
    return ctx.tenantId;
  },
}));

vi.mock('@/libs/api/permissions', () => ({
  requireCapability: (...args: unknown[]) => requireCapability(...args),
}));

vi.mock('@/libs/api/entitlements', () => ({
  requireAddon: (...args: unknown[]) => requireAddon(...args),
}));

vi.mock('@/features/broadcast/services/connections-service', () => ({
  getConnectionWithSecrets: (...args: unknown[]) => getConnectionWithSecrets(...args),
}));

vi.mock('@/libs/DB', () => ({ db: {} }));

const TENANT = '11111111-1111-1111-1111-111111111111';
const SANITIZED_SESSION = `tenant_${TENANT.replace(/-/g, '_')}`;
const schoolCtx = { userId: 'u1', tenantId: TENANT, role: 'school_admin', baseRole: 'school_admin', name: 'A', email: 'a@t', sessionId: null, impersonated: false };
const parentCtx = { ...schoolCtx, userId: 'p1', role: 'parent', baseRole: 'parent' };

function routeUrl(query = '', role?: string): Request {
  return new Request(`http://localhost/api/addons/broadcast/waha/qr${query}`, {
    headers: role ? { 'x-test-role': role } : {},
  });
}

const fetchMock = vi.fn();

beforeEach(async () => {
  vi.clearAllMocks();
  const { ApiError } = await import('@/libs/api/errors');
  requireRequestContext.mockImplementation((req: Request) => {
    const ctx = req.headers.get('x-test-role') === 'parent' ? parentCtx : schoolCtx;
    return Promise.resolve(ctx);
  });
  requireAddon.mockResolvedValue(undefined);
  requireCapability.mockResolvedValue(undefined);
  getConnectionWithSecrets.mockResolvedValue({
    configJson: { endpointUrl: 'http://waha-internal:3000', apiKey: 'stored-key', session: 'attacker-chosen' },
  });
  getConnectionWithSecrets.mockRejectedValue = getConnectionWithSecrets.mockRejectedValue;
  delete process.env.WAHA_ENDPOINT_URL;
  delete process.env.WAHA_API_KEY;
  void ApiError;
  vi.stubGlobal('fetch', fetchMock);
});

function wahaJson(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('GET /api/addons/broadcast/waha/qr — P0-A hardening', () => {
  it('parent (no broadcast.manage) is refused with 403', async () => {
    const { ApiError } = await import('@/libs/api/errors');
    requireCapability.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'refused'));
    const { GET } = await import('@/app/api/addons/broadcast/waha/qr/route');
    const res = await GET(routeUrl('?connectionId=c1', 'parent'));
    expect(res.status).toBe(403);
    expect(getConnectionWithSecrets).not.toHaveBeenCalled();
  });

  it('endpointUrl/apiKey query params are ignored — the stored connection endpoint is used', async () => {
    fetchMock.mockResolvedValue(wahaJson({ status: 'WORKING' }));
    const { GET } = await import('@/app/api/addons/broadcast/waha/qr/route');
    const res = await GET(routeUrl('?endpointUrl=http://127.0.0.1:9&apiKey=stolen&connectionId=c1'));
    expect(res.status).toBe(200);
    const calledUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(calledUrl.origin).toBe('http://waha-internal:3000');
  });

  it('session query param is ignored — session is always tenant_<tenantId>', async () => {
    getConnectionWithSecrets.mockResolvedValue({
      configJson: { endpointUrl: 'http://waha-internal:3000', apiKey: 'stored-key', session: 'tenant_OTHERSCHOOL' },
    });
    fetchMock.mockResolvedValue(wahaJson({ status: 'WORKING' }));
    const { GET } = await import('@/app/api/addons/broadcast/waha/qr/route');
    const res = await GET(routeUrl('?session=tenant_OTHERSCHOOL&connectionId=c1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.session).toBe(SANITIZED_SESSION);
    const calledUrl = fetchMock.mock.calls[0]![0] as string;
    expect(calledUrl).toContain(`/api/sessions/${SANITIZED_SESSION}`);
    expect(calledUrl).not.toContain('OTHERSCHOOL');
  });

  it('another tenant connection id is unreachable (tenant-scoped lookup 404)', async () => {
    const { ApiError } = await import('@/libs/api/errors');
    getConnectionWithSecrets.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'not found'));
    const { GET } = await import('@/app/api/addons/broadcast/waha/qr/route');
    const res = await GET(routeUrl('?connectionId=foreign-conn'));
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('unconfigured WAHA answers a clean 503, never an unhandled 500', async () => {
    const { GET } = await import('@/app/api/addons/broadcast/waha/qr/route');
    const res = await GET(routeUrl());
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error.code).toBe('WAHA_NOT_CONFIGURED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('unreachable WAHA host answers 503 (was the recurring 500)', async () => {
    process.env.WAHA_ENDPOINT_URL = 'http://schoolos-waha:3000';
    process.env.WAHA_API_KEY = 'env-key';
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const { GET } = await import('@/app/api/addons/broadcast/waha/qr/route');
    const res = await GET(routeUrl());
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('WAHA_UNREACHABLE');
  });
});
