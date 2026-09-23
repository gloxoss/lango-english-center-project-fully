import { beforeEach, describe, expect, it, vi } from 'vitest';
import { releaseStudent } from '../release-service';

const mocks = vi.hoisted(() => ({
  requireTenantGate: vi.fn(),
  insertScanEvidence: vi.fn(),
  recordAudit: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/libs/DB', () => ({ db: { transaction: mocks.transaction } }));
vi.mock('@/features/guard/services/visitors-service', () => ({ requireTenantGate: mocks.requireTenantGate }));
vi.mock('@/features/guard/services/credential-adapter', () => ({ insertScanEvidence: mocks.insertScanEvidence }));
vi.mock('@/libs/api/audit', () => ({ recordAudit: mocks.recordAudit }));

const context = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  userId: 'guard-1',
  role: 'guard' as const,
  baseRole: 'guard' as const,
  branchId: null,
  name: 'Guard',
  email: 'guard@example.test',
};
const input = {
  studentId: 'student-1',
  authorizationId: '22222222-2222-2222-2222-222222222222',
  gateId: '33333333-3333-3333-3333-333333333333',
  method: 'manual' as const,
};

function mockTransaction(linkExists: boolean) {
  const responses = [
    [{
      id: input.authorizationId,
      studentId: input.studentId,
      pickupPersonId: '44444444-4444-4444-4444-444444444444',
      status: 'active',
      authorizedFrom: new Date(Date.now() - 60000).toISOString(),
      authorizedUntil: new Date(Date.now() + 60000).toISOString(),
      relationshipType: 'parent',
    }],
    [{ id: input.studentId, name: 'Student' }],
    [{ id: '44444444-4444-4444-4444-444444444444', firstName: 'Parent', lastName: 'One' }],
    linkExists ? [{ id: '55555555-5555-5555-5555-555555555555' }] : [],
  ];
  const rowLock = vi.fn();
  const insert = vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) }));
  const update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) }));
  const tx = {
    select: vi.fn(() => {
      const rows = responses.shift() ?? [];
      const query = {
        from: vi.fn(),
        where: vi.fn(),
        for: vi.fn(),
        limit: vi.fn().mockResolvedValue(rows),
      };
      query.from.mockReturnValue(query);
      query.where.mockReturnValue(query);
      query.for.mockImplementation(() => { rowLock(); return query; });
      return query;
    }),
    insert,
    update,
  };
  mocks.transaction.mockImplementation(async (callback: (arg: typeof tx) => Promise<unknown>) => callback(tx));
  return { tx, insert, rowLock };
}

describe('student release live guardian right', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireTenantGate.mockResolvedValue(undefined);
    mocks.insertScanEvidence.mockResolvedValue(undefined);
  });

  it('rejects a previously issued authorization after its live guardian link is revoked', async () => {
    const { insert, rowLock } = mockTransaction(false);

    await expect(releaseStudent(context, input)).rejects.toMatchObject({ code: 'PICKUP_RIGHT_REVOKED' });
    expect(rowLock).toHaveBeenCalledTimes(2);
    expect(insert).not.toHaveBeenCalled();
    expect(mocks.insertScanEvidence).not.toHaveBeenCalled();
  });

  it('locks the active relationship before recording and consuming a release', async () => {
    const { insert, rowLock } = mockTransaction(true);

    await expect(releaseStudent(context, input)).resolves.toMatchObject({ student: { id: input.studentId } });
    expect(rowLock).toHaveBeenCalledTimes(2);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(mocks.insertScanEvidence).toHaveBeenCalledTimes(1);
  });
});
