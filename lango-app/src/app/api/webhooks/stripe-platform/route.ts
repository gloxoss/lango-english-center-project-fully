import type Stripe from 'stripe';
import type { RequestContext } from '@/libs/api/context';
import { eq, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { constructPlatformWebhookEvent, isPlatformBillingMetadata } from '@/libs/payments/platform-billing-provider';
import { processedStripeEvents, tenants } from '@/models/Schema';

type StoredSubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'unpaid' | 'canceled' | 'suspended' | 'cancelled';

function systemContext(tenantId: string): RequestContext {
  return {
    userId: 'system:stripe-platform',
    tenantId,
    branchId: null,
    role: 'super_admin',
    baseRole: 'super_admin',
    name: 'Stripe Platform',
    email: 'stripe-platform@schoolos.local',
  };
}

function stripeId(value: string | { id: string } | null | undefined): string | null {
  if (typeof value === 'string') {
    return value;
  }
  return value?.id ?? null;
}

function mapStripeStatus(status: Stripe.Subscription.Status): StoredSubscriptionStatus {
  switch (status) {
    case 'active': return 'active';
    case 'trialing': return 'trialing';
    case 'past_due': return 'past_due';
    case 'unpaid': return 'unpaid';
    case 'canceled': return 'canceled';
    default: return 'suspended';
  }
}

function currentPeriodEnd(subscription: Stripe.Subscription): string | null {
  const ends = subscription.items.data
    .map(item => item.current_period_end)
    .filter((value): value is number => typeof value === 'number');
  return ends.length > 0 ? new Date(Math.max(...ends) * 1000).toISOString() : null;
}

async function tenantForSubscription(subscriptionId: string | null, metadataTenantId?: string): Promise<string | null> {
  if (metadataTenantId) {
    const [row] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, metadataTenantId)).limit(1);
    return row?.id ?? null;
  }
  if (!subscriptionId) {
    return null;
  }
  const [row] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.stripeSubscriptionId, subscriptionId))
    .limit(1);
  return row?.id ?? null;
}

async function handleCheckoutCompleted(event: Stripe.Event): Promise<boolean> {
  const session = event.data.object as Stripe.Checkout.Session;
  if (!isPlatformBillingMetadata(session.metadata)) {
    return false;
  }
  const tenantId = session.metadata?.tenantId ?? session.client_reference_id;
  const customerId = stripeId(session.customer);
  const subscriptionId = stripeId(session.subscription);
  if (!tenantId || !customerId || !subscriptionId) {
    throw new ApiError(422, 'INVALID_PLATFORM_CHECKOUT', 'La session Stripe plateforme ne contient pas les identifiants requis.');
  }
  const [updated] = await db
    .update(tenants)
    .set({
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      subscriptionStatus: 'active',
    })
    .where(eq(tenants.id, tenantId))
    .returning({ id: tenants.id });
  if (!updated) {
    throw new ApiError(404, 'TENANT_NOT_FOUND', 'Établissement Stripe introuvable.');
  }
  recordAudit(systemContext(tenantId), 'update', 'tenant_platform_subscription', subscriptionId, {
    stripeEventId: event.id,
    eventType: event.type,
    status: 'active',
  });
  return true;
}

async function handleSubscriptionUpdated(event: Stripe.Event): Promise<boolean> {
  const subscription = event.data.object as Stripe.Subscription;
  if (!isPlatformBillingMetadata(subscription.metadata)) {
    return false;
  }
  const tenantId = await tenantForSubscription(subscription.id, subscription.metadata.tenantId);
  if (!tenantId) {
    throw new ApiError(404, 'TENANT_NOT_FOUND', 'Abonnement Stripe sans établissement correspondant.');
  }
  const priceId = subscription.items.data[0]?.price.id ?? null;
  const status = mapStripeStatus(subscription.status);
  await db.update(tenants).set({
    stripeCustomerId: stripeId(subscription.customer),
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    stripeCurrentPeriodEnd: currentPeriodEnd(subscription),
    subscriptionStatus: status,
  }).where(eq(tenants.id, tenantId));
  recordAudit(systemContext(tenantId), 'update', 'tenant_platform_subscription', subscription.id, {
    stripeEventId: event.id,
    eventType: event.type,
    stripeStatus: subscription.status,
  });
  return true;
}

async function handleSubscriptionDeleted(event: Stripe.Event): Promise<boolean> {
  const subscription = event.data.object as Stripe.Subscription;
  if (!isPlatformBillingMetadata(subscription.metadata)) {
    return false;
  }
  const tenantId = await tenantForSubscription(subscription.id, subscription.metadata.tenantId);
  if (!tenantId) {
    throw new ApiError(404, 'TENANT_NOT_FOUND', 'Abonnement Stripe sans établissement correspondant.');
  }
  await db.update(tenants).set({
    subscriptionStatus: 'cancelled',
    stripeCurrentPeriodEnd: currentPeriodEnd(subscription),
  }).where(eq(tenants.id, tenantId));
  recordAudit(systemContext(tenantId), 'update', 'tenant_platform_subscription', subscription.id, {
    stripeEventId: event.id,
    eventType: event.type,
    status: 'cancelled',
  });
  return true;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const raw = invoice as unknown as {
    subscription?: string | { id: string } | null;
    parent?: { subscription_details?: { subscription?: string | { id: string } | null } } | null;
  };
  return stripeId(raw.subscription ?? raw.parent?.subscription_details?.subscription);
}

async function handlePaymentFailed(event: Stripe.Event): Promise<boolean> {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) {
    return false;
  }
  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(or(eq(tenants.stripeSubscriptionId, subscriptionId), eq(tenants.stripeCustomerId, stripeId(invoice.customer) ?? '')))
    .limit(1);
  if (!tenant) {
    return false;
  }
  await db.update(tenants).set({ subscriptionStatus: 'suspended' }).where(eq(tenants.id, tenant.id));
  recordAudit(systemContext(tenant.id), 'update', 'tenant_platform_subscription', subscriptionId, {
    stripeEventId: event.id,
    eventType: event.type,
    invoiceId: invoice.id,
    status: 'suspended',
  });
  return true;
}

export async function POST(request: Request) {
  try {
    const signature = request.headers.get('stripe-signature');
    if (!signature) {
      throw new ApiError(400, 'STRIPE_SIGNATURE_MISSING', 'Signature Stripe manquante.');
    }
    const event = constructPlatformWebhookEvent(await request.text(), signature);

    // Idempotency: Stripe guarantees at-least-once delivery. Skip if already processed.
    const [existing] = await db
      .select({ eventId: processedStripeEvents.eventId })
      .from(processedStripeEvents)
      .where(eq(processedStripeEvents.eventId, event.id))
      .limit(1);
    if (existing) {
      return NextResponse.json({ received: true, processed: false, reason: 'already_processed' });
    }

    let processed = false;
    if (event.type === 'checkout.session.completed') {
      processed = await handleCheckoutCompleted(event);
    } else if (event.type === 'customer.subscription.updated') {
      processed = await handleSubscriptionUpdated(event);
    } else if (event.type === 'customer.subscription.deleted') {
      processed = await handleSubscriptionDeleted(event);
    } else if (event.type === 'invoice.payment_failed') {
      processed = await handlePaymentFailed(event);
    }

    if (processed) {
      await db.insert(processedStripeEvents).values({ eventId: event.id }).onConflictDoNothing();
    }

    return NextResponse.json({ received: true, processed });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
