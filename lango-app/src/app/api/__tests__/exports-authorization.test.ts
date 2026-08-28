import { beforeEach, describe, expect, it, vi } from 'vitest';

// D-12-class defect found in the 165-route capability sweep (2026-08-27).
//
// 1. POST /api/exports required only an authenticated session. Any principal —
//    student, parent, guard, librarian, alumni — could enqueue the 'audit-logs'
//    report and receive a CSV of the entire tenant's audit trail (actor names,
//    every action on every entity), while GET /api/audit-logs restricts exactly
//    that data to school_admin/super_admin. A privilege-escalation bypass.
//
// 2. GET /api/exports/[id] looked the job up by id + tenantId only, so any
//    authenticated user could read another user's export job and its
//    resultPath download link.
//
// These assertions fail if either guard is removed.

const requireCapabilityMock = vi.fn();
const createExportJobMock = vi.fn(async (_input: unknown) => "job-1");
const getExportJobMock = vi.fn();

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(async () => ({
    userId: 'user-student',
    tenantId: 'tenant-a',
    role: 'student',
  })),
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
}));

vi.mock('@/libs/api/permissions', () => ({
  requireCapability: (ctx: unknown, cap: string) => requireCapabilityMock(ctx, cap),
}));

vi.mock('@/libs/services/export-service', () => ({
  createExportJob: (arg: unknown) => createExportJobMock(arg),
  listExportJobs: vi.fn(async () => []),
  getExportJob: (id: string, tenantId: string) => getExportJobMock(id, tenantId),
}));

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/exports', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireCapabilityMock.mockReset();
  createExportJobMock.mockClear();
  getExportJobMock.mockReset();
});

describe('POST /api/exports authorization', () => {
  it('requires the capability the report type declares', async () => {
    const { POST } = await import('@/app/api/exports/route');
    await POST(postRequest({ reportType: 'audit-logs' }));

    // audit-logs must be gated on audit.read, not merely on being logged in.
    expect(requireCapabilityMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-student' }),
      'audit.read',
    );
  });

  it('does not enqueue the job when the capability check rejects', async () => {
    requireCapabilityMock.mockRejectedValueOnce(
      Object.assign(new Error('forbidden'), { status: 403 }),
    );

    const { POST } = await import('@/app/api/exports/route');
    const res = await POST(postRequest({ reportType: 'audit-logs' }));

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(createExportJobMock).not.toHaveBeenCalled();
  });

  it('fails closed on a report type with no declared capability', async () => {
    const { POST } = await import('@/app/api/exports/route');
    const res = await POST(postRequest({ reportType: 'not-a-real-report' }));

    expect(res.status).toBe(422);
    expect(requireCapabilityMock).not.toHaveBeenCalled();
    expect(createExportJobMock).not.toHaveBeenCalled();
  });
});

describe('GET /api/exports/[id] ownership', () => {
  it("hides another user's export job", async () => {
    getExportJobMock.mockResolvedValueOnce({
      id: 'job-1',
      tenantId: 'tenant-a',
      requestedBy: 'someone-else',
      resultPath: 'exports/secret.csv',
      status: 'complete',
    });

    const { GET } = await import('@/app/api/exports/[id]/route');
    const res = await GET(new Request('http://localhost/api/exports/job-1'), {
      params: Promise.resolve({ id: 'job-1' }),
    });

    expect(res.status).toBe(404);
    const body = await res.text();
    expect(body).not.toContain('secret.csv');
  });

  it('returns the caller’s own export job', async () => {
    getExportJobMock.mockResolvedValueOnce({
      id: 'job-1',
      tenantId: 'tenant-a',
      requestedBy: 'user-student',
      resultPath: 'exports/mine.csv',
      status: 'complete',
    });

    const { GET } = await import('@/app/api/exports/[id]/route');
    const res = await GET(new Request('http://localhost/api/exports/job-1'), {
      params: Promise.resolve({ id: 'job-1' }),
    });

    expect(res.status).toBe(200);
  });
});
