import { beforeEach, describe, expect, it, vi } from 'vitest';

// A refund above what is left on a payment used to reach the DB trigger and
// come back as a bare 500 "internal error". The route now says how much is
// still refundable, and any 23514 check violation maps to a 422.

const selectResults: unknown[][] = [];

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(async () => ({ userId: 'acc-1', tenantId: 't1', role: 'accountant' })),
}));
vi.mock('@/libs/api/permissions', () => ({
  requireCapability: vi.fn(async () => undefined),
  hasCapability: vi.fn(async () => false),
}));
vi.mock('@/libs/services/refund-approval', () => ({
  applyApprovedRefund: vi.fn(),
  decideRefund: vi.fn(),
}));
vi.mock('@/libs/DB', () => {
  const chain = () => {
    const builder: Record<string, unknown> = {};
    for (const m of ['from', 'where', 'innerJoin', 'orderBy']) {
      builder[m] = () => builder;
    }
    builder.limit = async () => selectResults.shift() ?? [];
    builder.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) =>
      Promise.resolve(selectResults.shift() ?? []).then(ok, ko);
    return builder;
  };
  return { db: { select: vi.fn(chain), transaction: vi.fn(async () => ({ record: { id: 'rf-1' } })) } };
});

const { POST } = await import('@/app/api/finance/refunds/route');
const { db } = await import('@/libs/DB');
const { apiErrorResponse } = await import('@/libs/api/errors');

const PAYMENT_ID = '00000000-0000-4000-8000-0000000000aa';

function post(amount: string) {
  return POST(new Request('http://localhost/api/finance/refunds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: 'stu-1', paymentId: PAYMENT_ID, amount, reason: 'Trop-perçu' }),
  }) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  selectResults.length = 0;
});

describe('refund cap', () => {
  it('refuses a refund above the remaining refundable amount, with the amount left', async () => {
    selectResults.push([{ id: PAYMENT_ID, amount: '500.00', status: 'posted' }], [{ refundedCents: '40000' }]);
    const res = await post('150.00');

    expect(res.status).toBe(422);

    const json = await res.json();

    expect(json.error.code).toBe('REFUND_EXCEEDS_PAYMENT');
    expect(json.error.message).toContain('100.00');
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('accepts a refund that fits in what is left', async () => {
    selectResults.push([{ id: PAYMENT_ID, amount: '500.00', status: 'posted' }], [{ refundedCents: '40000' }]);
    const res = await post('100.00');

    expect(res.status).toBe(201);
    expect(db.transaction).toHaveBeenCalledOnce();
  });

  it('refuses a payment that is already reversed or refunded', async () => {
    selectResults.push([{ id: PAYMENT_ID, amount: '500.00', status: 'reversed' }]);
    const res = await post('10.00');

    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('PAYMENT_NOT_REFUNDABLE');
  });
});

describe('apiErrorResponse', () => {
  it('maps a PostgreSQL 23514 check violation to 422, not 500', async () => {
    const res = apiErrorResponse({ cause: { code: '23514', message: 'refunds exceed original payment' } });

    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('INTEGRITY_RULE');
  });
});
