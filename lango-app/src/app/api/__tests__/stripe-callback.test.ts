import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Security audit P0-C: Stripe live webhooks were never recorded. The route
// looked the session up at body top level, but Stripe nests the reference at
// data.object.metadata.external_reference — every real webhook 404'd and the
// family was charged with no invoice credit. The route now verifies first and
// posts with the PROVIDER-VERIFIED reference, claims the session atomically
// (pending→processing), passes idempotencyKey to createPayment, and leaves
// irrelevant signed events untouched.

vi.mock('@/libs/DB', () => ({ db: {
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(() => ({ values: () => ({ onConflictDoNothing: async () => undefined }) })),
} }));
vi.mock('@/libs/payments', () => ({
  getPaymentProvider: vi.fn(),
}));
vi.mock('@/libs/services/payment-create', () => ({
  createPayment: vi.fn(),
}));
vi.mock('@/features/settings/services/secrets-service', () => ({
  resolveSecretByKey: vi.fn(),
}));

const mockedDB = vi.mocked(await import('@/libs/DB'));
const paymentsLib = vi.mocked(await import('@/libs/payments'));
const paymentCreate = vi.mocked(await import('@/libs/services/payment-create'));
const secrets = vi.mocked(await import('@/features/settings/services/secrets-service'));

const WEBHOOK_SECRET = 'whsec_test_0123456789';
const REFERENCE = 'GW-test-0001';
const SESSION = {
  id: 'sess-1',
  tenantId: 'tenant-1',
  invoiceId: 'inv-1',
  paymentId: null,
  methodCode: 'card_stripe',
  provider: 'stripe',
  externalReference: REFERENCE,
  amount: 1500,
  currency: 'MAD',
  status: 'pending',
  mode: 'live',
  rawCallback: null,
  expiresAt: null,
  createdAt: '2026-09-22T00:00:00Z',
  updatedAt: '2026-09-22T00:00:00Z',
};

function signStripePayload(payload: string, secret = WEBHOOK_SECRET, timestampSec = Math.floor(Date.now() / 1000)): string {
  const sig = crypto.createHmac('sha256', secret).update(`${timestampSec}.${payload}`).digest('hex');
  return `t=${timestampSec},v1=${sig}`;
}

function stripeEvent(type: string, amountTotal = 150000): string {
  return JSON.stringify({
    id: 'evt_1',
    type,
    data: { object: { id: 'cs_1', payment_status: 'paid', amount_total: amountTotal, currency: 'mad', metadata: { external_reference: REFERENCE } } },
  });
}

function post(payload: string, signature: string): Request {
  return new Request('http://localhost/api/finance/payments/online/callback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': signature },
    body: payload,
  });
}

/** Minimal stateful db fake: first select = session lookup, second = methodConfig. */
function installDb(sessionStatus: string) {
  const session = { ...SESSION, status: sessionStatus };
  const methodConfig = { tenantId: 'tenant-1', methodCode: 'card_stripe', provider: 'stripe', webhookSecretKey: 'wh_key' };
  let selectCall = 0;
  (mockedDB.db.select as any).mockImplementation(() => {
    const row = selectCall++ === 0 ? session : methodConfig;
    return {
      from: () => ({
        where: () => ({
          limit: async () => [row],
        }),
      }),
    } as never;
  });

  const setMock = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      returning: async () => (session.status === 'pending' ? [{ id: session.id }] : []),
    }),
  });
  (mockedDB.db.update as any).mockReturnValue({ set: setMock } as never);
  return { session, setMock };
}

beforeEach(async () => {
  vi.clearAllMocks();
  (process.env as any).NODE_ENV = 'test';
  const { StripeProvider } = await import('@/libs/payments/stripe-provider');
  paymentsLib.getPaymentProvider.mockReturnValue(new StripeProvider());
  secrets.resolveSecretByKey.mockResolvedValue({ value: WEBHOOK_SECRET } as never);
  paymentCreate.createPayment.mockResolvedValue({ payment: { id: 'pay-1' } } as never);
});

describe('POST /api/finance/payments/online/callback — Stripe live webhook (P0-C)', () => {
  it('a real Stripe-shaped signed payload credits the invoice with idempotencyKey', async () => {
    installDb('pending');
    const { POST } = await import('@/app/api/finance/payments/online/callback/route');
    const payload = stripeEvent('checkout.session.completed');
    const res = await POST(post(payload, signStripePayload(payload)));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('paid');
    expect(json.data.paymentId).toBe('pay-1');

    expect(paymentCreate.createPayment).toHaveBeenCalledTimes(1);
    const call = paymentCreate.createPayment.mock.calls[0]![0]!;
    expect(call.idempotencyKey).toBe(REFERENCE);
    expect(call.referenceId).toBe(REFERENCE);
    expect(call.allocations[0]).toMatchObject({ invoiceId: 'inv-1', amount: '1500.00' });
  });

  it('two concurrent deliveries of the same webhook credit exactly once (atomic claim)', async () => {
    const session = { ...SESSION, status: 'pending' };
    const methodConfig = { tenantId: 'tenant-1', methodCode: 'card_stripe', provider: 'stripe', webhookSecretKey: 'wh_key' };
    let claimWinner = true;
    let selectCall = 0;

    (mockedDB.db.select as any).mockImplementation(() => {
      const row = selectCall++ === 0 ? session : methodConfig;
      return {
        from: () => ({
          where: () => ({
            limit: async () => [row],
          }),
        }),
      } as never;
    });

    // The claim UPDATE ... WHERE status='pending' RETURNING: the first
    // concurrent caller wins, the second finds no pending row.
    (mockedDB.db.update as any).mockImplementation((() => ({
      set: () => ({
        where: () => ({
          returning: async () => {
            if (claimWinner) {
              claimWinner = false;
              return [{ id: session.id }];
            }
            return [];
          },
        }),
      }),
    })) as never);

    const { POST } = await import('@/app/api/finance/payments/online/callback/route');
    const payload = stripeEvent('checkout.session.completed');
    const signature = signStripePayload(payload);
    const [resA, resB] = await Promise.all([
      POST(post(payload, signature)),
      POST(post(payload, signature)),
    ]);

    const jsonA = await resA.json();
    const jsonB = await resB.json();
    const paid = [jsonA, jsonB].filter(j => j.data?.status === 'paid');
    const already = [jsonA, jsonB].filter(j => j.message === 'Déjà traité.');
    expect(paid).toHaveLength(1);
    expect(already).toHaveLength(1);
    expect(paymentCreate.createPayment).toHaveBeenCalledTimes(1);
  });

  it('a validly signed irrelevant event is acknowledged WITHOUT changing session state', async () => {
    const { setMock } = installDb('pending');
    const { POST } = await import('@/app/api/finance/payments/online/callback/route');
    const payload = stripeEvent('payment_intent.created');
    const res = await POST(post(payload, signStripePayload(payload)));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('ignored');
    expect(paymentCreate.createPayment).not.toHaveBeenCalled();
    expect(setMock).not.toHaveBeenCalled();
  });

  it('a forged payload referencing the session fails signature verification and posts nothing', async () => {
    installDb('pending');
    const { POST } = await import('@/app/api/finance/payments/online/callback/route');
    const payload = stripeEvent('checkout.session.completed');
    const res = await POST(post(payload, signStripePayload(payload, 'attacker-secret')));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(paymentCreate.createPayment).not.toHaveBeenCalled();
  });

  it('a verified amount different from the session is parked for review, not posted', async () => {
    const { setMock } = installDb('pending');
    const { POST } = await import('@/app/api/finance/payments/online/callback/route');
    const payload = stripeEvent('checkout.session.completed', 100000);
    const res = await POST(post(payload, signStripePayload(payload)));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('review');
    expect(paymentCreate.createPayment).not.toHaveBeenCalled();
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'review' }));
    expect(mockedDB.db.insert).toHaveBeenCalledTimes(1);
  });
});
