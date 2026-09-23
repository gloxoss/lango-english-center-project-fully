import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { getPaymentProvider } from '@/libs/payments';
import { createPayment } from '@/libs/services/payment-create';
import { resolveSecretByKey } from '@/features/settings/services/secrets-service';
import { accountingAdapterExceptions, paymentGatewaySessions, paymentMethodConfigurations } from '@/models/Schema';

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

// Candidate external reference, read from the SHAPES gateways actually send:
//  - CMI/sandbox form or JSON posts carry it at the top level (externalReference / oid),
//  - Stripe webhooks nest it at data.object.metadata.external_reference.
// This pre-extraction only SELECTS which session (and therefore which webhook
// secret) verifies the signature — no money moves before the provider's
// signature verification passes, and a forged reference just fails
// verification against that tenant's secret. The reference used for posting is
// the PROVIDER-VERIFIED one, never the raw candidate.
function extractCandidateReference(body: Record<string, unknown>): string {
  const topLevel = String(body.externalReference ?? body.oid ?? '');
  if (topLevel) return topLevel;
  const data = body.data as { object?: { metadata?: { external_reference?: unknown } } } | undefined;
  const nested = data?.object?.metadata?.external_reference;
  return nested ? String(nested) : '';
}

// POST /api/finance/payments/online/callback — unauthenticated gateway webhook.
//
// Security audit P0-C. Order of operations:
//   1. candidate reference → session → tenant → provider + webhook secret,
//   2. provider VERIFIES the signature (money never moves on an unverified body),
//   3. irrelevant signed events → acknowledged, session untouched,
//   4. the pending session is claimed ATOMICALLY (status pending→processing),
//      so two concurrent deliveries cannot both post,
//   5. createPayment runs with idempotencyKey = the verified reference as a
//      second line of defence; on error the claim is released so the gateway
//      retry can succeed.
export async function POST(request: Request) {
  try {
    const { body, rawPayload, signature } = await readCallback(request);
    const candidateReference = extractCandidateReference(body);

    const [session] = candidateReference
      ? await db
        .select()
        .from(paymentGatewaySessions)
        .where(eq(paymentGatewaySessions.externalReference, candidateReference))
        .limit(1)
      : [];
    if (!session) {
      return NextResponse.json({ success: false, message: 'Session introuvable.' }, { status: 404 });
    }

    // Idempotent replay: already terminal (or in flight) → acknowledge without re-posting.
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

    // Validly signed but not a completion event: acknowledge, change nothing.
    if (result.ignored) {
      return NextResponse.json({ success: true, data: { status: 'ignored' }, message: 'Événement ignoré.' });
    }

    // Atomic claim: exactly one concurrent delivery gets the row back.
    const claimed = await db
      .update(paymentGatewaySessions)
      .set({ status: 'processing', rawCallback: body as never, updatedAt: new Date().toISOString() })
      .where(and(eq(paymentGatewaySessions.id, session.id), eq(paymentGatewaySessions.status, 'pending')))
      .returning({ id: paymentGatewaySessions.id });
    if (claimed.length === 0) {
      return NextResponse.json({ success: true, data: { status: session.status }, message: 'Déjà traité.' });
    }

    // The family paid through the gateway, but a verified amount different
    // from what this session asked for is never posted blindly: park it for
    // an accountant to reconcile and keep it visible.
    if (result.status === 'paid' && Math.round(result.amount * 100) !== Math.round(Number(session.amount) * 100)) {
      await db
        .update(paymentGatewaySessions)
        .set({ status: 'review', updatedAt: new Date().toISOString() })
        .where(and(eq(paymentGatewaySessions.id, session.id), eq(paymentGatewaySessions.status, 'processing')));
      await db.insert(accountingAdapterExceptions).values({
        tenantId: session.tenantId,
        sourceModule: 'online_payment',
        sourceDocumentType: 'payment_gateway_session',
        sourceDocumentId: session.id,
        version: 1,
        reason: 'gateway_amount_mismatch',
        detail: `Montant confirmé par la passerelle (${result.amount.toFixed(2)} MAD) différent du montant demandé (${Number(session.amount).toFixed(2)} MAD). Paiement non imputé.`,
        payload: { expected: Number(session.amount), received: result.amount, reference: result.externalReference || candidateReference },
        status: 'open',
        createdBy: null,
      }).onConflictDoNothing();
      // 200 so the gateway stops retrying: the session is parked, not lost.
      return NextResponse.json({ success: false, data: { status: 'review' }, message: 'Montant différent : paiement mis en vérification.' });
    }

    if (result.status === 'paid') {
      try {
        const created = await createPayment({
          tenantId: session.tenantId,
          actorId: null,
          allocations: [{ invoiceId: session.invoiceId, amount: result.amount.toFixed(2) }],
          paymentMethod: session.methodCode,
          referenceId: result.externalReference || candidateReference,
          idempotencyKey: result.externalReference || candidateReference,
          receivedById: null,
        });

        await db
          .update(paymentGatewaySessions)
          .set({
            status: 'paid',
            paymentId: created.payment.id,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(paymentGatewaySessions.id, session.id));

        return NextResponse.json({ success: true, data: { paymentId: created.payment.id, status: 'paid' } });
      } catch (postError) {
        // Release the claim so the gateway's retry can complete the payment.
        await db
          .update(paymentGatewaySessions)
          .set({ status: 'pending', updatedAt: new Date().toISOString() })
          .where(and(eq(paymentGatewaySessions.id, session.id), eq(paymentGatewaySessions.status, 'processing')));
        throw postError;
      }
    }

    await db
      .update(paymentGatewaySessions)
      .set({ status: 'failed', rawCallback: body as never, updatedAt: new Date().toISOString() })
      .where(and(eq(paymentGatewaySessions.id, session.id), eq(paymentGatewaySessions.status, 'processing')));

    return NextResponse.json({ success: true, data: { status: 'failed' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
