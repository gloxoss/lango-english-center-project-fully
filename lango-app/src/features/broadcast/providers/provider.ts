import type { broadcastChannel } from '../models/broadcast-schema';

export type BroadcastChannel = (typeof broadcastChannel.enumValues)[number];

export type DeliveryTarget = {
  channel: BroadcastChannel;
  /** Phone (sms) or email (email) of the recipient. */
  to: string;
  subject?: string | null;
  bodyText: string;
  bodyHtml?: string | null;
};

export type ProviderSendResult =
  | { ok: true; status: 'sent' | 'delivered'; providerRef?: string | null }
  | { ok: false; status: 'failed' | 'bounced'; failureReason?: string | null; retryable: boolean; providerRef?: string | null };

export interface BroadcastProvider {
  readonly provider: string;
  readonly channels: BroadcastChannel[];
  send(target: DeliveryTarget): Promise<ProviderSendResult>;
  testConnection?(config: Record<string, unknown>): Promise<{ ok: boolean; message: string }>;
}

// Registry of provider adapters. Real carriers (WhatsApp/Telegram/SMTP/SMS
// gateways) are intentionally NOT wired: sending is log/test-only per the app's
// honesty convention. A new adapter implements BroadcastProvider and is added
// here without touching call sites.
const providers = new Map<string, BroadcastProvider>();

export function registerProvider(p: BroadcastProvider): void {
  providers.set(p.provider, p);
}

export function getProvider(name: string): BroadcastProvider | null {
  return providers.get(name) ?? null;
}

export function listProviders(): string[] {
  return [...providers.keys()];
}
