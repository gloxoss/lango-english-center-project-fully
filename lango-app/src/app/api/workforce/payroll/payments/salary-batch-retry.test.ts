import { beforeEach, describe, expect, it, vi } from 'vitest';

// "fail" used to accept a paid batch, and a new batch for the same payroll hit
// the unique index with a vague duplicate error, even after a real failure.

const selectResults: unknown[][] = [];
const updates: Array<{ set: Record<string, unknown> }> = [];

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(async () => ({ userId: 'u-2', tenantId: 't1', role: 'school_admin' })),
  requireTenant: vi.fn(() => 't1'),
}));
vi.mock('@/libs/api/entitlements', () => ({ requireWorkforceAddon: vi.fn(async () => undefined) }));
vi.mock('@/libs/api/permissions', () => ({ requireCapability: vi.fn(async () => undefined) }));
vi.mock('@/libs/api/audit', () => ({ recordAudit: vi.fn() }));
vi.mock('@/libs/DB', () => {
  const selectChain = () => {
    const b: Record<string, unknown> = {};
    for (const m of ['from', 'where', 'leftJoin', 'innerJoin', 'orderBy']) {
      b[m] = () => b;
    }
    b.for = async () => selectResults.shift() ?? [];
    b.limit = async () => selectResults.shift() ?? [];
    b.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(selectResults.shift() ?? []).then(ok, ko);
    return b;
  };
  const tx = {
    execute: vi.fn(async () => undefined),
    select: vi.fn(selectChain),
    insert: vi.fn(),
    update: vi.fn(() => ({
      set: (set: Record<string, unknown>) => {
        updates.push({ set });
        return { where: () => ({ returning: async () => [{ id: 'b1', ...set }], then: (ok: (v: unknown) => unknown) => Promise.resolve(undefined).then(ok) }) };
      },
    })),
  };
  return { db: { transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)) } };
});

const RUN_ID = '00000000-0000-4000-8000-0000000000b1';

function action(name: string) {
  return import('@/app/api/workforce/payroll/payments/[id]/action/route').then(({ POST }) => POST(
    new Request('http://localhost/api/workforce/payroll/payments/b1/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: name }),
    }),
    { params: Promise.resolve({ id: 'b1' }) },
  ));
}

beforeEach(() => {
  vi.clearAllMocks();
  selectResults.length = 0;
  updates.length = 0;
});

describe('salary batch "fail"', () => {
  it('refuses to mark a paid batch as failed', async () => {
    selectResults.push([{ id: 'b1', status: 'paid', method: 'cash', runId: RUN_ID }]);
    const res = await action('fail');

    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('PAYMENT_INVALID_TRANSITION');
    expect(updates).toHaveLength(0);
  });

  it('marks an approved batch failed and releases its pending payments', async () => {
    selectResults.push([{ id: 'b1', status: 'approved', method: 'cash', runId: RUN_ID }]);
    const res = await action('fail');

    expect(res.status).toBe(200);
    expect(updates.map(u => u.set.status)).toEqual(['failed', 'failed']);
  });

  it('reopens the payroll when a paid batch is reversed', async () => {
    selectResults.push([{ id: 'b1', status: 'paid', method: 'cash', runId: RUN_ID }]);
    const res = await action('reverse');

    expect(res.status).toBe(200);
    expect(updates.map(u => u.set.status)).toEqual(['reversed', 'posted', 'reversed']);
  });
});

describe('preparing a salary batch', () => {
  it('refuses clearly while another batch for the payroll is live', async () => {
    selectResults.push([{ id: RUN_ID, status: 'posted' }], [{ id: 'b0', status: 'approved' }]);
    const { POST } = await import('@/app/api/workforce/payroll/payments/route');
    const res = await POST(new Request('http://localhost/api/workforce/payroll/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: RUN_ID, method: 'cash' }),
    }));

    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('PAYMENT_BATCH_ACTIVE');
  });
});
