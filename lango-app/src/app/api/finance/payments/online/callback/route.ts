import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { getPaymentProvider } from '@/libs/payments';
import { createPayment } from '@/libs/services/payment-create';
import { resolveSecretByKey } from '@/features/settings/services/secrets-service';
import { paymentGatewaySessions, paymentMethodConfigurations } from '@/models/Schema';

// Reads a gateway callback body (JSON or urlencoded form) into a plain record,
// preserving the raw payload string + the Stripe-Signature header for providers
// that verify the exact signed body (Stripe) rather than a hashed field (CMI).
async function readCallback(request: Request): Promise<{ body: Record<string, unknown>; rawPayload: string; signature: string | null }> {
  const rawPayload = await request.text();
  const contentType = request.headers.get('content-type') ?? '';
  let body: Record<string, unknown> = {};
  if (contentType.includes('application/json')) {
    try { body = JSON.parse(rawPayload) as Record<string, unknown>; } catch { body = {}; }
  } else {
    body = Object.fromEntries(new URLSearchParams(rawPayload).entries());
  }
  const headerSignature = request.headers.get('stripe-signature');
  const bodySignature = String(body.hash ?? body.HASH ?? '') || null;
  return { body, rawPayload, signature: headerSignature ?? bodySignature };
}

// POST /api/finance/payments/online/callback — unauthenticated gateway webhook.
// The tenant is derived from the externalReference lookup, and the provider
// verifies its own signature before any money moves. Idempotent: a session
// already terminal short-circuits so gateway retries don't double-post.
export async function POST(request: Request) {
  try {
    const { body, rawPayload, signature } = await readCallback(request);
    const externalReference = String(body.externalReference ?? body.oid ?? '');

    const [session] = await db
      .select()
      .from(paymentGatewaySessions)
      .where(eq(paymentGatewaySessions.externalReference, externalReference))
      .limit(1);
    if (!session) {
      return NextResponse.json({ success: false, message: 'Session introuvable.' }, { status: 404 });
    }

    // Idempotent replay: already terminal → acknowledge without re-posting.
    if (session.status !== 'pending') {
      return NextResponse.json({ success: true, data: { status: session.status }, message: 'Déjà traité.' });
    }

    if (session.mode === 'sandbox' && process.env.NODE_ENV === 'production' && process.env.ALLOW_PAYMENT_SANDBOX !== 'true') {
      return NextResponse.json({ success: false, message: 'Les callbacks de paiement sandbox sont désactivés en production.' }, { status: 403 });
    }

    const [methodConfig] = await db
      .select()
      .from(paymentMethodConfigurations)
      .where(and(
        eq(paymentMethodConfigurations.tenantId, session.tenantId),
        eq(paymentMethodConfigurations.methodCode, session.methodCode),
      ))
      .limit(1);
    if (!methodConfig || !methodConfig.provider) {
      return NextResponse.json({ success: false, message: 'Configuration introuvable.' }, { status: 404 });
    }

    const provider = getPaymentProvider(methodConfig.provider);
    if (!provider) {
      return NextResponse.json({ success: false, message: `Passerelle « ${methodConfig.provider} » inconnue.` }, { status: 422 });
    }

    let webhookSecret: string | undefined;
    if (session.mode === 'live') {
      if (!methodConfig.webhookSecretKey) {
        return NextResponse.json({ success: false, message: 'Secret webhook non configuré.' }, { status: 422 });
      }
      webhookSecret = (await resolveSecretByKey(session.tenantId, methodConfig.webhookSecretKey)).value;
    }

    const result = await provider.verifyCallback({
      rawBody: body,
      signature,
      mode: session.mode as 'sandbox' | 'live',
      webhookSecret,
      rawPayload,
    });

    if (result.status === 'paid') {
      const created = await createPayment({
        tenantId: session.tenantId,
        actorId: null,
        allocations: [{ invoiceId: session.invoiceId, amount: result.amount.toFixed(2) }],
        paymentMethod: session.methodCode,
        referenceId: externalReference,
        receivedById: null,
      });

      await db
        .update(paymentGatewaySessions)
        .set({
          status: 'paid',
          paymentId: created.payment.id,
          rawCallback: body as never,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(paymentGatewaySessions.id, session.id));

      return NextResponse.json({ success: true, data: { paymentId: created.payment.id, status: 'paid' } });
    }

    await db
      .update(paymentGatewaySessions)
      .set({ status: 'failed', rawCallback: body as never, updatedAt: new Date().toISOString() })
      .where(eq(paymentGatewaySessions.id, session.id));

    return NextResponse.json({ success: true, data: { status: 'failed' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
