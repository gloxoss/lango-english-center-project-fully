import crypto from 'node:crypto';
import { ApiError } from '@/libs/api/errors';
import {
  registerPaymentProvider,
  type CreateSessionInput,
  type CreateSessionResult,
  type PaymentGatewayProvider,
  type VerifyCallbackInput,
  type VerifyCallbackResult,
} from './provider';

const STRIPE_API = 'https://api.stripe.com/v1';
const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

// Stripe hosted-checkout provider. Sandbox mode mirrors CMI's offline simulator
// (no real redirect, the simulator drives the callback); live mode creates a
// real Stripe Checkout Session and verifies the `Stripe-Signature` header over
// the exact raw body (HMAC-SHA256, time-tolerant). No SDK — plain fetch + crypto.
export class StripeProvider implements PaymentGatewayProvider {
  readonly id = 'stripe';

  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    if (input.mode === 'sandbox') {
      return { redirectUrl: null, externalReference: input.externalReference, mode: 'sandbox' };
    }
    if (!input.storeKey) {
      throw new ApiError(422, 'GATEWAY_NOT_CONFIGURED', 'Clé secrète Stripe manquante.');
    }

    const form = new URLSearchParams({
      mode: 'payment',
      success_url: input.returnUrl,
      cancel_url: input.cancelUrl,
      'line_items[0][price_data][currency]': input.currency.toLowerCase(),
      'line_items[0][price_data][unit_amount]': String(Math.round(input.amount * 100)),
      'line_items[0][price_data][product_data][name]': `Facture ${input.invoiceId}`,
      'line_items[0][quantity]': '1',
      'metadata[external_reference]': input.externalReference,
      'metadata[tenant_id]': input.tenantId,
      'metadata[invoice_id]': input.invoiceId,
    });

    const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.storeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    const json = (await res.json()) as { url?: string; error?: { message?: string } };
    if (!res.ok || !json.url) {
      throw new ApiError(502, 'GATEWAY_ERROR', `Échec de création de session Stripe : ${json.error?.message ?? res.status}`);
    }

    return { redirectUrl: json.url, externalReference: input.externalReference, mode: 'live' };
  }

  async verifyCallback(input: VerifyCallbackInput): Promise<VerifyCallbackResult> {
    if (input.mode === 'sandbox') {
      // The sandbox simulator is authoritative; no real signature boundary.
      return {
        externalReference: String(input.rawBody.externalReference ?? input.rawBody.oid ?? ''),
        status: input.rawBody.status === 'failed' ? 'failed' : 'paid',
        amount: Number(input.rawBody.amount),
        currency: String(input.rawBody.currency ?? 'MAD'),
      };
    }

    if (!input.webhookSecret || !input.signature || !input.rawPayload) {
      throw new ApiError(400, 'GATEWAY_SIGNATURE_MISSING', 'Signature ou corps brut manquant pour la vérification Stripe.');
    }

    const event = verifyStripeSignature(input.rawPayload, input.signature, input.webhookSecret);
    if (event.type !== 'checkout.session.completed') {
      return { externalReference: '', status: 'failed', amount: 0, currency: 'MAD' };
    }

    const session = event.data.object as {
      payment_status?: string;
      amount_total?: number;
      currency?: string;
      metadata?: { external_reference?: string };
    };

    return {
      externalReference: session.metadata?.external_reference ?? '',
      status: session.payment_status === 'paid' ? 'paid' : 'failed',
      amount: (session.amount_total ?? 0) / 100,
      currency: String(session.currency ?? '').toUpperCase(),
    };
  }
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyStripeSignature(rawPayload: string, signatureHeader: string, secret: string): {
  type: string;
  data: { object: Record<string, unknown> };
} {
  let timestamp = '';
  let signature = '';
  for (const part of signatureHeader.split(',')) {
    const [key, ...rest] = part.trim().split('=');
    const value = rest.join('=');
    if (key === 't') timestamp = value;
    if (key === 'v1') signature = value;
  }

  if (!timestamp || !signature) {
    throw new ApiError(400, 'GATEWAY_SIGNATURE_INVALID', 'Signature Stripe malformée.');
  }

  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawPayload}`).digest('hex');
  if (!timingSafeEqualHex(expected, signature)) {
    throw new ApiError(400, 'GATEWAY_SIGNATURE_INVALID', 'Signature Stripe invalide.');
  }

  const timestampMs = Number(timestamp) * 1000;
  if (Number.isFinite(timestampMs) && Math.abs(Date.now() - timestampMs) > SIGNATURE_TOLERANCE_MS) {
    throw new ApiError(400, 'GATEWAY_SIGNATURE_EXPIRED', 'Signature Stripe expirée.');
  }

  return JSON.parse(rawPayload) as { type: string; data: { object: Record<string, unknown> } };
}

registerPaymentProvider(new StripeProvider());
