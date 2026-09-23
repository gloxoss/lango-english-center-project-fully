import { registerProvider, type BroadcastChannel, type BroadcastProvider, type DeliveryTarget, type ProviderSendResult } from './provider';
import { normalizeMoroccanPhone } from '@/libs/sms/moroccan-sms-adapter';

/**
 * Android SMS Gateway Relay Adapter (Textbee / SMSGate / Android HTTP Gateway)
 * 100% free cellular SMS by relaying via an Android phone with a Moroccan SIM card
 * (Maroc Telecom, Orange Maroc, Inwi) with unlimited SMS forfait.
 *
 * Config schema:
 * {
 *   endpointUrl: string; // e.g. "https://api.textbee.dev/api/v1/gateway/devices/{id}/send-sms" or "http://192.168.1.50:8080/send-sms"
 *   apiKey?: string;     // API Key or Bearer token
 *   deviceId?: string;   // Device ID if required by the relay service
 *   simSlot?: number;    // 1 or 2 (for dual-SIM phones)
 *   timeoutMs?: number;
 * }
 */
export type AndroidSmsConfig = {
  endpointUrl?: string;
  apiKey?: string;
  deviceId?: string;
  simSlot?: number;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 12000;

export class AndroidSmsProvider implements BroadcastProvider {
  readonly provider = 'android-sms';
  readonly channels: BroadcastChannel[] = ['sms'];

  async send(target: DeliveryTarget): Promise<ProviderSendResult> {
    const cfg = (target.config ?? {}) as AndroidSmsConfig;
    let url = typeof cfg.endpointUrl === 'string' && cfg.endpointUrl.trim() ? cfg.endpointUrl.trim() : null;

    if (!url) {
      return { ok: false, status: 'failed', failureReason: 'no_android_gateway_url', retryable: false };
    }

    // If URL contains {deviceId} placeholder and deviceId is provided, substitute it
    if (cfg.deviceId && url.includes('{deviceId}')) {
      url = url.replace('{deviceId}', encodeURIComponent(cfg.deviceId));
    }

    const normalizedPhone = normalizeMoroccanPhone(target.to);
    const timeoutMs = typeof cfg.timeoutMs === 'number' && cfg.timeoutMs > 0 ? cfg.timeoutMs : DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (cfg.apiKey?.trim()) {
        headers['x-api-key'] = cfg.apiKey.trim();
        headers['Authorization'] = `Bearer ${cfg.apiKey.trim()}`;
      }

      // Payload accommodating Textbee, SMSGate, and standard Android relay apps
      const payload = {
        phone: normalizedPhone,
        recipients: [normalizedPhone],
        message: target.bodyText,
        text: target.bodyText,
        deviceId: cfg.deviceId || undefined,
        simSlot: cfg.simSlot || 1,
      };

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const responseText = await res.text().catch(() => '');
      const ref = `android-sms:${res.status}`;

      if (res.ok) {
        let msgId: string | null = null;
        try {
          const parsed = JSON.parse(responseText);
          msgId = parsed.id || parsed.messageId || parsed.data?.id || null;
        } catch {
          // fallback to ref
        }
        return { ok: true, status: 'sent', providerRef: msgId ?? ref };
      }

      return {
        ok: false,
        status: 'failed',
        failureReason: `android_sms_http_${res.status}: ${responseText.slice(0, 120)}`,
        retryable: res.status >= 500,
        providerRef: ref,
      };
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      return {
        ok: false,
        status: 'failed',
        failureReason: aborted ? 'android_sms_timeout' : `android_sms_error: ${err instanceof Error ? err.message : String(err)}`,
        retryable: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async testConnection(config: Record<string, unknown>): Promise<{ ok: boolean; message: string }> {
    const cfg = config as AndroidSmsConfig;
    let url = typeof cfg.endpointUrl === 'string' && cfg.endpointUrl.trim() ? cfg.endpointUrl.trim() : null;

    if (!url) {
      return { ok: false, message: 'URL de la passerelle Android SMS manquante.' };
    }

    if (cfg.deviceId && url.includes('{deviceId}')) {
      url = url.replace('{deviceId}', encodeURIComponent(cfg.deviceId));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (cfg.apiKey?.trim()) {
        headers['x-api-key'] = cfg.apiKey.trim();
        headers['Authorization'] = `Bearer ${cfg.apiKey.trim()}`;
      }

      // Try GET on base URL or ping
      const baseUrl = url.split('?')[0]!;
      let testRes: Response;
      try {
        testRes = await fetch(baseUrl, { method: 'GET', headers, signal: controller.signal });
      } catch {
        // Fallback to sending a validation ping if GET isn't supported
        testRes = await fetch(baseUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ ping: true }),
          signal: controller.signal,
        });
      }

      // Any HTTP response below 500 confirms the gateway server is alive and responding
      if (testRes.status < 500) {
        return { ok: true, message: `Passerelle Android SMS joignable (Code HTTP ${testRes.status}). Téléphone prêt pour l'envoi.` };
      }

      return { ok: false, message: `Erreur serveur relais Android (Code HTTP ${testRes.status}).` };
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      return {
        ok: false,
        message: aborted
          ? 'Délai d\'attente dépassé : impossible de joindre le smartphone relais Android.'
          : `Erreur de connexion au smartphone relais : ${err instanceof Error ? err.message : String(err)}`,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

registerProvider(new AndroidSmsProvider());
