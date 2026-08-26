import type Stripe from 'stripe';
import type { RequestContext } from '@/libs/api/context';
import { and, eq, isNull } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import {
  getPlatformPriceId,
  getPlatformStripe,
  PLATFORM_BILLING_METADATA_KEY,
  PLATFORM_BILLING_METADATA_VALUE,
} from '@/libs/payments/platform-billing-provider';
import { tenants } from '@/models/Schema';

export function requirePlatformBillingAdmin(context: RequestContext): string {
  if (context.role !== 'school_admin' || context.baseRole !== 'school_admin' || !context.tenantId) {
    throw new ApiError(403, 'FORBIDDEN', 'La facturation de la plateforme est réservée aux administrateurs de l’établissement.');
  }
  return context.tenantId;
}

async function getTenant(tenantId: string) {
  const [tenant] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      stripeCustomerId: tenants.stripeCustomerId,
      stripeSubscriptionId: tenants.stripeSubscriptionId,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!tenant) {
    throw new ApiError(404, 'TENANT_NOT_FOUND', 'Établissement introuvable.');
  }
  return tenant;
}

async function getOrCreateCustomer(tenantId: string): Promise<string> {
  const tenant = await getTenant(tenantId);
  if (tenant.stripeCustomerId) {
    return tenant.stripeCustomerId;
  }

  const stripe = getPlatformStripe();
  const customer = await stripe.customers.create({
    name: tenant.name,
    metadata: {
      tenantId,
      [PLATFORM_BILLING_METADATA_KEY]: PLATFORM_BILLING_METADATA_VALUE,
    },
  });

  // Atomic claim: only set stripeCustomerId if it's still null.
  // If a concurrent request won the race, this returns no rows.
  const [updated] = await db
    .update(tenants)
    .set({ stripeCustomerId: customer.id })
    .where(and(eq(tenants.id, tenantId), isNull(tenants.stripeCustomerId)))
    .returning({ stripeCustomerId: tenants.stripeCustomerId });

  if (updated) {
    return updated.stripeCustomerId!;
  }

  // Another request won — clean up and use the winner's customer.
  await stripe.customers.del(customer.id).catch(() => {});
  const winner = await getTenant(tenantId);
  return winner.stripeCustomerId!;
}

export async function createPlatformCheckoutSession(tenantId: string, origin: string): Promise<Stripe.Checkout.Session> {
  const stripe = getPlatformStripe();
  const customer = await getOrCreateCustomer(tenantId);
  const priceId = getPlatformPriceId();
  return stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    client_reference_id: tenantId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/dashboard/settings/subscription?checkout=success`,
    cancel_url: `${origin}/dashboard/settings/subscription?checkout=cancelled`,
    metadata: {
      tenantId,
      [PLATFORM_BILLING_METADATA_KEY]: PLATFORM_BILLING_METADATA_VALUE,
    },
    subscription_data: {
      metadata: {
        tenantId,
        [PLATFORM_BILLING_METADATA_KEY]: PLATFORM_BILLING_METADATA_VALUE,
      },
    },
  });
}

export async function createPlatformPortalSession(tenantId: string, origin: string): Promise<Stripe.BillingPortal.Session> {
  const tenant = await getTenant(tenantId);
  if (!tenant.stripeCustomerId || !tenant.stripeSubscriptionId) {
    throw new ApiError(409, 'PLATFORM_SUBSCRIPTION_REQUIRED', 'Aucun abonnement Stripe actif n’est lié à cet établissement.');
  }
  return getPlatformStripe().billingPortal.sessions.create({
    customer: tenant.stripeCustomerId,
    return_url: `${origin}/dashboard/settings/subscription`,
  });
}
