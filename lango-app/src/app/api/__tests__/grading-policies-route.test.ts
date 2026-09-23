import { beforeEach, describe, expect, it, vi } from 'vitest';

// Audit 2026-09-22 P0-3: the grading policy page wrote to localStorage and
// claimed success. The policy now persists server-side through the versioned
// settings registry — the same academic.passThreshold the promotions engine
// and report cards read. These tests pin the contract.

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(),
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
}));

vi.mock('@/libs/api/permissions', () => ({
  requireCapability: vi.fn(),
}));

vi.mock('@/libs/settings/registry', () => ({
  getEffectiveValue: vi.fn(),
  setSettingValue: vi.fn(),
}));

vi.mock('@/libs/DB', () => ({
  db: {},
}));

vi.mock('@/libs/api/audit', () => ({
  recordAudit: vi.fn(),
}));

function effective(value: unknown, version = 1) {
  return { key: 'x', value, source: 'tenant' as const, version, inherited: false, sensitivity: 'internal' as const };
}

const adminContext = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  branchId: null,
  role: 'school_admin',
  baseRole: 'school_admin',
  name: 'Director',
  email: 'director@school.ma',
  sessionId: null,
  impersonated: false,
};

const mockedContext = vi.mocked(await import('@/libs/api/context'));
const mockedPermissions = vi.mocked(await import('@/libs/api/permissions'));
const mockedRegistry = vi.mocked(await import('@/libs/settings/registry'));

beforeEach(() => {
  vi.clearAllMocks();
  mockedContext.requireRequestContext.mockResolvedValue(adminContext as never);
  mockedRegistry.getEffectiveValue.mockImplementation(((_tenant: string, _branch: unknown, key: string) => {
    if (key === 'academic.passThreshold') return Promise.resolve(effective(10, 3));
    if (key === 'academic.eliminatoryScore') return Promise.resolve(effective(5, 1));
    if (key === 'academic.evaluationWeights') return Promise.resolve(effective([], 0));
    if (key === 'academic.gradingScale') return Promise.resolve(effective('20', 0));
    return Promise.resolve(effective(null, 0));
  }) as never);
  mockedRegistry.setSettingValue.mockResolvedValue(4);
});

describe('GET /api/academics/grading-policies', () => {
  it('returns the stored policy composed from the settings registry', async () => {
    const { GET } = await import('@/app/api/academics/grading-policies/route');
    const res = await GET(new Request('http://localhost/api/academics/grading-policies'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.passingScore).toBe(10);
    expect(json.data.eliminatoryScore).toBe(5);
    expect(json.data.rules).toEqual([]);
    expect(json.data.gradingScale).toBe('20');
  });

  it('gates on settings.organization.manage', async () => {
    const { GET } = await import('@/app/api/academics/grading-policies/route');
    await GET(new Request('http://localhost/api/academics/grading-policies'));
    expect(mockedPermissions.requireCapability).toHaveBeenCalledWith(adminContext, 'settings.organization.manage');
  });
});

describe('PUT /api/academics/grading-policies', () => {
  const validBody = {
    passingScore: 12,
    eliminatoryScore: 5,
    rules: [
      { name: 'Examen Final', weight: 60 },
      { name: 'Contrôles Continus', weight: 40 },
    ],
  };

  it('persists the thresholds to the registry keys promotions and report cards read', async () => {
    const { PUT } = await import('@/app/api/academics/grading-policies/route');
    const res = await PUT(new Request('http://localhost/api/academics/grading-policies', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    expect(mockedRegistry.setSettingValue).toHaveBeenCalledTimes(3);
    const [tenantId, branchId, key, value, , , expectedVersion] = mockedRegistry.setSettingValue.mock.calls[0]!;
    expect(tenantId).toBe('tenant-1');
    expect(branchId).toBeNull();
    expect(key).toBe('academic.passThreshold');
    expect(value).toBe(12);
    // CAS on the shared passThreshold version so the promotions engine's
    // setting history stays linear.
    expect(expectedVersion).toBe(3);
    expect(mockedRegistry.setSettingValue.mock.calls[1]![2]).toBe('academic.eliminatoryScore');
    expect(mockedRegistry.setSettingValue.mock.calls[1]![3]).toBe(5);
    expect(mockedRegistry.setSettingValue.mock.calls[2]![2]).toBe('academic.evaluationWeights');
  });

  it('rejects weights that do not sum to 100 with 422 and writes nothing', async () => {
    const { PUT } = await import('@/app/api/academics/grading-policies/route');
    const res = await PUT(new Request('http://localhost/api/academics/grading-policies', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody, rules: [{ name: 'Examen Final', weight: 60 }] }),
    }));
    expect(res.status).toBe(422);
    expect(mockedRegistry.setSettingValue).not.toHaveBeenCalled();
  });

  it('rejects an eliminatory score above the passing score with 422', async () => {
    const { PUT } = await import('@/app/api/academics/grading-policies/route');
    const res = await PUT(new Request('http://localhost/api/academics/grading-policies', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody, eliminatoryScore: 13 }),
    }));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe('INVALID_THRESHOLDS');
    expect(mockedRegistry.setSettingValue).not.toHaveBeenCalled();
  });

  it('rejects unknown and missing fields (.strict())', async () => {
    const { PUT } = await import('@/app/api/academics/grading-policies/route');
    const extra = await PUT(new Request('http://localhost/api/academics/grading-policies', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody, evil: true }),
    }));
    expect(extra.status).toBeGreaterThanOrEqual(400);

    const missing = await PUT(new Request('http://localhost/api/academics/grading-policies', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passingScore: 10 }),
    }));
    expect(missing.status).toBeGreaterThanOrEqual(400);
    expect(mockedRegistry.setSettingValue).not.toHaveBeenCalled();
  });

  it('refuses non-admin callers', async () => {
    const { ApiError } = await import('@/libs/api/errors');
    mockedContext.requireRequestContext.mockRejectedValueOnce(new ApiError(403, 'FORBIDDEN', 'refused'));
    const { PUT } = await import('@/app/api/academics/grading-policies/route');
    const res = await PUT(new Request('http://localhost/api/academics/grading-policies', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    }));
    expect(res.status).toBe(403);
    expect(mockedRegistry.setSettingValue).not.toHaveBeenCalled();
  });
});
