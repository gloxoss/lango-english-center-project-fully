import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { getPaymentProvider } from './provider';
import './stripe-provider';

const provider = getPaymentProvider('stripe')!;

function signStripeEvent(secret: string, rawPayload: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawPayload}`).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

describe('StripeProvider', () => {
  it('sandbox createSession returns a null redirect (simulator drives the callback)', async () => {
    const result = await provider.createSession({
      tenantId: 't',
      invoiceId: 'i',
      amount: 300,
      currency: 'MAD',
      mode: 'sandbox',
      externalReference: 'GW-1',
      returnUrl: '',
      cancelUrl: '',
    });
    expect(result.redirectUrl).toBeNull();
    expect(result.externalReference).toBe('GW-1');
  });

  it('sandbox verifyCallback returns the posted status/amount/currency', async () => {
    const result = await provider.verifyCallback({
      rawBody: { externalReference: 'GW-1', amount: 300, currency: 'MAD', status: 'paid' },
      signature: null,
      mode: 'sandbox',
    });
    expect(result.status).toBe('paid');
    expect(result.amount).toBe(300);
    expect(result.currency).toBe('MAD');
  });

  it('live verifyCallback accepts a valid signature and maps the Stripe session', async () => {
    const secret = 'whsec_test_secret_1234567890';
    const rawPayload = JSON.stringify({
      type: 'checkout.session.completed',
      data: {
        object: {
          payment_status: 'paid',
          amount_total: 30000,
          currency: 'eur',
          metadata: { external_reference: 'GW-9' },
        },
      },
    });

    const result = await provider.verifyCallback({
      rawBody: JSON.parse(rawPayload),
      signature: signStripeEvent(secret, rawPayload),
      mode: 'live',
      webhookSecret: secret,
      rawPayload,
    });

    expect(result.status).toBe('paid');
    expect(result.amount).toBe(300);
    expect(result.currency).toBe('EUR');
    expect(result.externalReference).toBe('GW-9');
  });

  it('live verifyCallback rejects a tampered payload, wrong secret, and missing signature', async () => {
    const secret = 'whsec_test_secret_1234567890';
    const rawPayload = JSON.stringify({
      type: 'checkout.session.completed',
      data: { object: { payment_status: 'paid', amount_total: 30000, currency: 'eur', metadata: {} } },
    });
    const signature = signStripeEvent(secret, rawPayload);

    // Tampered raw payload → signature mismatch.
    const tampered = rawPayload.replace('"amount_total":30000', '"amount_total":1');
    await expect(
      provider.verifyCallback({ rawBody: {}, signature, mode: 'live', webhookSecret: secret, rawPayload: tampered }),
    ).rejects.toThrow();

    // Wrong secret → signature mismatch.
    await expect(
      provider.verifyCallback({ rawBody: {}, signature, mode: 'live', webhookSecret: 'wrong', rawPayload }),
    ).rejects.toThrow();

    // Missing signature header.
    await expect(
      provider.verifyCallback({ rawBody: {}, signature: null, mode: 'live', webhookSecret: secret, rawPayload }),
    ).rejects.toThrow();
  });
});
