import { registerProvider, type BroadcastChannel, type BroadcastProvider, type DeliveryTarget, type ProviderSendResult } from './provider';

// Deterministic log/test provider — the app's honest-simulation convention.
// No external bytes are sent. Outcomes are driven deterministically from the
// recipient address so verification is reproducible without real carriers:
//   "BOUNCE…"  → permanent failure (bounced)
//   "RETRY…"   → transient failure (retryable)
//   "DELIVERED" → accepted then reported delivered (provider evidence)
//   otherwise  → accepted (sent)
//
// The immutable delivery_events row is the persistent record of the outcome;
// the provider itself performs no I/O beyond building the result.

let seq = 0;

export class TestProvider implements BroadcastProvider {
  readonly provider = 'test';
  readonly channels: BroadcastChannel[] = ['sms', 'email', 'whatsapp', 'telegram', 'messenger'];

  async send(target: DeliveryTarget): Promise<ProviderSendResult> {
    const to = (target.to || '').toLowerCase();
    const ref = `test:${++seq}:${Date.now().toString(36)}`;
    if (to.includes('bounce')) {
      return { ok: false, status: 'bounced', providerRef: ref, failureReason: 'simulated_bounce', retryable: false };
    }
    if (to.includes('retryfail')) {
      return { ok: false, status: 'failed', providerRef: ref, failureReason: 'simulated_transient', retryable: true };
    }
    if (to.includes('delivered')) {
      return { ok: true, status: 'delivered', providerRef: ref };
    }
    return { ok: true, status: 'sent', providerRef: ref };
  }

  async testConnection() {
    return { ok: true, message: 'Connexion de test OK (aucun envoi réel).' };
  }
}

registerProvider(new TestProvider());
