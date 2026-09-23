import { registerProvider, type BroadcastChannel, type BroadcastProvider, type DeliveryTarget, type ProviderSendResult } from './provider';
import { normalizeMoroccanPhone } from '@/libs/sms/moroccan-sms-adapter';

/**
 * SMS.to Gateway Adapter
 * Popular low-cost SMS platform for Morocco and international SMS routing.
 *
 * Config schema:
 * {
 *   apiKey: string;
 *   senderId?: string; // e.g. "SchoolOS" or school name
 *   timeoutMs?: number;
 * }
 */
export type SmsToConfig = {
  apiKey?: string;
  senderId?: string;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 10000;

export class SmsToProvider implements BroadcastProvider {
  readonly provider = 'smsto';
  readonly channels: BroadcastChannel[] = ['sms'];

  async send(target: DeliveryTarget): Promise<ProviderSendResult> {
    const cfg = (target.config ?? {}) as SmsToConfig;
    const apiKey = cfg.apiKey?.trim();

    if (!apiKey) {
      return {
        ok: false,
        status: 'failed',
        failureReason: 'missing_smsto_api_key',
        retryable: false,
      };
    }

    const normalizedPhone = normalizeMoroccanPhone(target.to);
    const senderId = cfg.senderId?.trim() || 'SchoolOS';
    const timeoutMs = typeof cfg.timeoutMs === 'number' && cfg.timeoutMs > 0 ? cfg.timeoutMs : DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch('https://api.sms.to/sms/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          to: normalizedPhone,
          message: target.bodyText,
          sender_id: senderId,
        }),
        signal: controller.signal,
      });

      const responseText = await res.text().catch(() => '');
      const ref = `smsto:${res.status}`;

      if (res.ok) {
        let msgId: string | null = null;
        try {
          const parsed = JSON.parse(responseText);
          msgId = parsed.message_id || parsed.id || parsed.data?.id || null;
        } catch {
          // fallback
        }
        return { ok: true, status: 'sent', providerRef: msgId ?? ref };
      }

      let errorMsg = `smsto_http_${res.status}`;
      try {
        const parsed = JSON.parse(responseText);
        if (parsed.message) errorMsg = `smsto_error: ${parsed.message}`;
      } catch {
        errorMsg = `smsto_http_${res.status}: ${responseText.slice(0, 100)}`;
      }

      return {
        ok: false,
        status: 'failed',
        failureReason: errorMsg,
        retryable: res.status >= 500,
        providerRef: ref,
      };
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      return {
        ok: false,
        status: 'failed',
        failureReason: aborted ? 'smsto_timeout' : `smsto_error: ${err instanceof Error ? err.message : String(err)}`,
        retryable: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async testConnection(config: Record<string, unknown>): Promise<{ ok: boolean; message: string }> {
    const cfg = config as SmsToConfig;
    const apiKey = cfg.apiKey?.trim();

    if (!apiKey) {
      return { ok: false, message: 'Clé d\'API SMS.to manquante.' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch('https://api.sms.to/v1/balance', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const balance = data.balance ?? data.credits ?? 'N/A';
        const currency = data.currency ?? '';
        return { ok: true, message: `SMS.to authentifié avec succès (Solde: ${balance} ${currency}).` };
      }

      const errText = await res.text().catch(() => '');
      return { ok: false, message: `Échec d'authentification SMS.to (Code HTTP ${res.status}): ${errText.slice(0, 100)}` };
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      return {
        ok: false,
        message: aborted ? 'Délai d\'attente dépassé vers SMS.to.' : `Erreur SMS.to: ${err instanceof Error ? err.message : String(err)}`,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

registerProvider(new SmsToProvider());
