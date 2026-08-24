import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { getTenantCurrency } from '@/libs/finance/currency';
import { validatePaymentMethod } from '@/libs/finance/payment-methods';
import { getPaymentProvider } from '@/libs/payments';
import { resolveSecretByKey } from '@/features/settings/services/secrets-service';
import { invoices, paymentGatewaySessions } from '@/models/Schema';

const onlinePaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  paymentMethod: z.string().trim().min(1).max(50),
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
}).strict();

// POST /api/finance/payments/online — start an online gateway session for a
// single invoice (charges its outstanding balance). Returns a redirect URL
// (null in sandbox mode, where the simulator drives the callback).
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    const body = await parseJson(request, onlinePaymentSchema);

    const [invoice] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, body.invoiceId), eq(invoices.tenantId, tenantId)))
      .limit(1);
    if (!invoice) {
      throw new ApiError(404, 'NOT_FOUND', 'Facture introuvable.');
    }
    if (invoice.status === 'cancelled') {
      throw new ApiError(409, 'INVOICE_CANCELLED', 'Une facture annulée ne peut pas être réglée.');
    }

    const methodConfig = await validatePaymentMethod(tenantId, body.paymentMethod);
    if (!methodConfig || !methodConfig.provider) {
      throw new ApiError(422, 'PAYMENT_METHOD_NOT_ONLINE', `Le moyen de paiement « ${body.paymentMethod} » n'est pas configuré pour le paiement en ligne.`);
    }

    const provider = getPaymentProvider(methodConfig.provider);
    if (!provider) {
      throw new ApiError(422, 'GATEWAY_UNKNOWN', `Passerelle « ${methodConfig.provider} » inconnue.`);
    }

    const amount = Number(invoice.netAmount) - Number(invoice.paidAmount);
    if (amount <= 0) {
      throw new ApiError(409, 'INVOICE_ALREADY_PAID', 'Cette facture est déjà soldée.');
    }

    const currency = await getTenantCurrency(tenantId);
    const mode = (methodConfig.gatewayMode ?? 'sandbox') as 'sandbox' | 'live';
    const externalReference = `GW-${crypto.randomUUID()}`;

    // Resolve merchant creds (live only) before creating the session so a
    // misconfigured secret fails fast rather than leaving a dangling session.
    let storeKey: string | undefined;
    if (mode === 'live') {
      if (!methodConfig.credentialSecretKey) {
        throw new ApiError(422, 'GATEWAY_NOT_CONFIGURED', 'Aucune clé d\'identifiants marchand configurée pour cette passerelle.');
      }
      storeKey = (await resolveSecretByKey(tenantId, methodConfig.credentialSecretKey)).value;
    }

    const [session] = await db
      .insert(paymentGatewaySessions)
      .values({
        tenantId,
        invoiceId: body.invoiceId,
        methodCode: body.paymentMethod,
        provider: methodConfig.provider,
        externalReference,
        amount,
        currency,
        status: 'pending',
        mode,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      })
      .returning();

    const result = await provider.createSession({
      tenantId,
      invoiceId: body.invoiceId,
      amount,
      currency,
      mode,
      externalReference,
      returnUrl: body.returnUrl ?? '',
      cancelUrl: body.cancelUrl ?? '',
      storeKey,
    });

    recordAudit(context, 'create', 'payment_gateway_session', session!.id, {
      invoiceId: body.invoiceId,
      provider: methodConfig.provider,
      externalReference,
      amount,
      currency,
      mode,
    });

    return NextResponse.json({
      success: true,
      data: { sessionId: session!.id, externalReference, redirectUrl: result.redirectUrl, mode },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
