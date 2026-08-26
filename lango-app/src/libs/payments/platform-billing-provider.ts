import Stripe from 'stripe';
import { ApiError } from '@/libs/api/errors';

export const PLATFORM_BILLING_METADATA_KEY = 'billingConcern';
export const PLATFORM_BILLING_METADATA_VALUE = 'schoolos_platform';

function requiredEnv(name: 'STRIPE_PLATFORM_SECRET_KEY' | 'STRIPE_PLATFORM_WEBHOOK_SECRET' | 'STRIPE_PLATFORM_PRICE_ID'): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ApiError(503, 'PLATFORM_BILLING_NOT_CONFIGURED', `${name} n'est pas configuré.`);
  }
  return value;
}

export function getPlatformStripe(): Stripe {
  return new Stripe(requiredEnv('STRIPE_PLATFORM_SECRET_KEY'));
}

export function getPlatformPriceId(): string {
  return requiredEnv('STRIPE_PLATFORM_PRICE_ID');
}

export function constructPlatformWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  try {
    return getPlatformStripe().webhooks.constructEvent(
      rawBody,
      signature,
      requiredEnv('STRIPE_PLATFORM_WEBHOOK_SECRET'),
    );
  } catch {
    throw new ApiError(400, 'STRIPE_SIGNATURE_INVALID', 'Signature Stripe plateforme invalide.');
  }
}

export function isPlatformBillingMetadata(metadata: Stripe.Metadata | null | undefined): boolean {
  return metadata?.[PLATFORM_BILLING_METADATA_KEY] === PLATFORM_BILLING_METADATA_VALUE;
}
