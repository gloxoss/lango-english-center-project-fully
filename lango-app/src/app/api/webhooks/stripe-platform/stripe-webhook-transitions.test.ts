import type Stripe from 'stripe';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { processedStripeEvents, tenants } from '@/models/Schema';

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/schoolos_test',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/libs/payments/platform-billing-provider', () => ({
  PLATFORM_BILLING_METADATA_KEY: 'billingConcern',
  PLATFORM_BILLING_METADATA_VALUE: 'schoolos_platform',
  constructPlatformWebhookEvent: (_body: string, _sig: string) => JSON.parse(_body),
  isPlatformBillingMetadata: (metadata: Record<string, string> | null | undefined) =>
    metadata?.billingConcern === 'schoolos_platform',
}));

const { POST: webhookHandler } = await import('./route');

function stripeEvent(
  type: string,
  data: Record<string, unknown>,
  id = `evt_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
): Stripe.Event {
  return { id, type, data: { object: data } } as unknown as Stripe.Event;
}

function webhookRequest(event: Stripe.Event): Request {
  return new Request('http://localhost/api/webhooks/stripe-platform', {
    method: 'POST',
    headers: { 'stripe-signature': 'test_sig', 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
}

async function checkDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('stripe-platform webhook state transitions', () => {
  const tenantId = crypto.randomUUID();
  const stripeCustomerId = `cus_test_${Date.now()}`;
  const stripeSubscriptionId = `sub_test_${Date.now()}`;

  beforeAll(async () => {
    await db.insert(tenants).values({
      id: tenantId,
      name: 'Webhook Test School',
      slug: `webhook-test-${tenantId}`,
      subscriptionStatus: 'active',
      isActive: true,
    });
  });

  afterAll(async () => {
    await db.delete(processedStripeEvents).where(eq(processedStripeEvents.eventId, processedStripeEvents.eventId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('checkout.session.completed links stripeCustomerId and stripeSubscriptionId', async () => {
    const event = stripeEvent('checkout.session.completed', {
      customer: stripeCustomerId,
      subscription: stripeSubscriptionId,
      client_reference_id: tenantId,
      metadata: { billingConcern: 'schoolos_platform', tenantId },
    });

    const res = await webhookHandler(webhookRequest(event));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.processed).toBe(true);

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    expect(tenant!.stripeCustomerId).toBe(stripeCustomerId);
    expect(tenant!.stripeSubscriptionId).toBe(stripeSubscriptionId);
    expect(tenant!.subscriptionStatus).toBe('active');
  });

  it.each([
    ['active', 'active'],
    ['past_due', 'past_due'],
    ['unpaid', 'unpaid'],
    ['trialing', 'trialing'],
  ] as const)('customer.subscription.updated with status=%s syncs to %s', async (stripeStatus, expected) => {
    const event = stripeEvent('customer.subscription.updated', {
      id: stripeSubscriptionId,
      status: stripeStatus,
      customer: stripeCustomerId,
      metadata: { billingConcern: 'schoolos_platform', tenantId },
      items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 86400, price: { id: 'price_test' } }] },
    });

    const res = await webhookHandler(webhookRequest(event));
    expect(res.status).toBe(200);

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    expect(tenant!.subscriptionStatus).toBe(expected);
  });

  it('customer.subscription.deleted sets cancelled', async () => {
    const event = stripeEvent('customer.subscription.deleted', {
      id: stripeSubscriptionId,
      status: 'canceled',
      customer: stripeCustomerId,
      metadata: { billingConcern: 'schoolos_platform', tenantId },
      items: { data: [{ current_period_end: Math.floor(Date.now() / 1000), price: { id: 'price_test' } }] },
    });

    const res = await webhookHandler(webhookRequest(event));
    expect(res.status).toBe(200);

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    expect(tenant!.subscriptionStatus).toBe('cancelled');
  });

  it('invoice.payment_failed sets suspended', async () => {
    // Reset to active first
    await db.update(tenants).set({ subscriptionStatus: 'active' }).where(eq(tenants.id, tenantId));

    const event = stripeEvent('invoice.payment_failed', {
      id: 'in_test_failed',
      customer: stripeCustomerId,
      subscription: stripeSubscriptionId,
    });

    const res = await webhookHandler(webhookRequest(event));
    expect(res.status).toBe(200);

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    expect(tenant!.subscriptionStatus).toBe('suspended');
  });

  it('replaying the same event.id is a no-op (idempotency)', async () => {
    // Reset to active
    await db.update(tenants).set({ subscriptionStatus: 'active' }).where(eq(tenants.id, tenantId));

    const eventId = `evt_replay_${Date.now()}`;
    const event = stripeEvent('customer.subscription.deleted', {
      id: stripeSubscriptionId,
      status: 'canceled',
      customer: stripeCustomerId,
      metadata: { billingConcern: 'schoolos_platform', tenantId },
      items: { data: [{ current_period_end: Math.floor(Date.now() / 1000), price: { id: 'price_test' } }] },
    }, eventId);

    // First call — should process
    const res1 = await webhookHandler(webhookRequest(event));
    const json1 = await res1.json();
    expect(json1.processed).toBe(true);

    const [afterFirst] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    expect(afterFirst!.subscriptionStatus).toBe('cancelled');

    // Reset to active to prove replay doesn't re-apply
    await db.update(tenants).set({ subscriptionStatus: 'active' }).where(eq(tenants.id, tenantId));

    // Second call — same event.id, should be skipped
    const res2 = await webhookHandler(webhookRequest(event));
    const json2 = await res2.json();
    expect(json2.processed).toBe(false);
    expect(json2.reason).toBe('already_processed');

    // Status should still be active (replay was rejected)
    const [afterReplay] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    expect(afterReplay!.subscriptionStatus).toBe('active');
  });
});
