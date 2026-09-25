import { beforeEach, describe, expect, it, vi } from 'vitest';

// Cancel read the status, then updated unconditionally outside any lock, so a
// payment landing in between left a cancelled invoice that carried money.

const selectResults: unknown[][] = [];
const updateResults: unknown[][] = [];
const execute = vi.fn(async () => undefined);
const insert = vi.fn(() => ({ values: async () => undefined }));

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(async () => ({ userId: 'acc-1', tenantId: 't1', role: 'accountant' })),
  requireTenant: vi.fn(() => 't1'),
}));
vi.mock('@/libs/api/permissions', () => ({ requireCapability: vi.fn(async () => undefined) }));
vi.mock('@/libs/api/audit', () => ({ recordAudit: vi.fn() }));
vi.mock('@/libs/DB', () => {
  const tx = {
    execute,
    insert,
    select: () => ({ from: () => ({ where: () => ({ limit: async () => selectResults.shift() ?? [] }) }) }),
    update: () => ({ set: () => ({ where: () => ({ returning: async () => updateResults.shift() ?? [] }) }) }),
  };
  return { db: { transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)) } };
});

const { PUT } = await import('@/app/api/finance/invoices/[id]/cancel/route');

function cancel() {
  return PUT(new Request('http://localhost/api/finance/invoices/inv-1/cancel', { method: 'PUT' }), { params: Promise.resolve({ id: 'inv-1' }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  selectResults.length = 0;
  updateResults.length = 0;
});

describe('invoice cancel', () => {
  it('takes the same per-invoice lock as payments before reading', async () => {
    selectResults.push([{ id: 'inv-1', status: 'pending', paidAmount: 0, invoiceNumber: 'INV-1' }]);
    updateResults.push([{ id: 'inv-1', status: 'cancelled' }]);
    const res = await cancel();

    expect(res.status).toBe(200);
    expect(execute).toHaveBeenCalledOnce();
    expect(insert).toHaveBeenCalledOnce();
  });

  it('refuses when money is already on the invoice', async () => {
    selectResults.push([{ id: 'inv-1', status: 'pending', paidAmount: 150, invoiceNumber: 'INV-1' }]);
    const res = await cancel();

    expect(res.status).toBe(409);
    expect(insert).not.toHaveBeenCalled();
  });

  it('refuses when the status changed before the update landed', async () => {
    selectResults.push([{ id: 'inv-1', status: 'pending', paidAmount: 0, invoiceNumber: 'INV-1' }]);
    updateResults.push([]);
    const res = await cancel();

    expect(res.status).toBe(409);
    expect(insert).not.toHaveBeenCalled();
  });
});
