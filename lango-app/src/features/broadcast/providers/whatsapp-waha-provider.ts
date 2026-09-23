import { registerProvider, type BroadcastChannel, type BroadcastProvider, type DeliveryTarget, type ProviderSendResult } from './provider';
import { normalizeMoroccanPhone } from '@/libs/sms/moroccan-sms-adapter';

/**
 * WhatsApp HTTP API (WAHA / Baileys) Adapter
 * 100% free self-hosted gateway paired via QR Code.
 *
 * Config schema:
 * {
 *   endpointUrl: string; // e.g. "http://localhost:3000" or "https://waha.school.ma"
 *   apiKey?: string;     // Optional API key configured in WAHA
 *   session?: string;    // Session name, defaults to "default"
 *   timeoutMs?: number;
 * }
 */
export type WahaConfig = {
  endpointUrl?: string;
  apiKey?: string;
  session?: string;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 10000;

export function formatWhatsAppChatId(phone: string): string {
  if (phone.includes('@')) return phone;
  const normalized = normalizeMoroccanPhone(phone).replace(/^\+/, '');
  return `${normalized}@c.us`;
}

export class WhatsAppWahaProvider implements BroadcastProvider {
  readonly provider = 'whatsapp-waha';
  readonly channels: BroadcastChannel[] = ['whatsapp'];

  async send(target: DeliveryTarget): Promise<ProviderSendResult> {
    const cfg = (target.config ?? {}) as WahaConfig;
    const baseUrl = typeof cfg.endpointUrl === 'string' && cfg.endpointUrl.trim()
      ? cfg.endpointUrl.trim().replace(/\/+$/, '')
      : null;

    if (!baseUrl) {
      return { ok: false, status: 'failed', failureReason: 'no_waha_endpoint', retryable: false };
    }

    const session = typeof cfg.session === 'string' && cfg.session.trim() ? cfg.session.trim() : 'default';
    const chatId = formatWhatsAppChatId(target.to);
    const timeoutMs = typeof cfg.timeoutMs === 'number' && cfg.timeoutMs > 0 ? cfg.timeoutMs : DEFAULT_TIMEOUT_MS;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (cfg.apiKey?.trim()) {
        headers['X-Api-Key'] = cfg.apiKey.trim();
        headers['Authorization'] = `Bearer ${cfg.apiKey.trim()}`;
      }

      const res = await fetch(`${baseUrl}/api/sendText`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          chatId,
          text: target.bodyText,
          session,
        }),
        signal: controller.signal,
      });

      const responseText = await res.text().catch(() => '');
      const ref = `waha:${res.status}`;

      if (res.ok) {
        let msgId: string | null = null;
        try {
          const parsed = JSON.parse(responseText);
          msgId = parsed.id || parsed.messageId || null;
        } catch {
          // keep ref
        }
        return { ok: true, status: 'delivered', providerRef: msgId ?? ref };
      }

      return {
        ok: false,
        status: 'failed',
        failureReason: `waha_http_${res.status}: ${responseText.slice(0, 120)}`,
        retryable: res.status >= 500,
        providerRef: ref,
      };
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      return {
        ok: false,
        status: 'failed',
        failureReason: aborted ? 'waha_timeout' : `waha_error: ${err instanceof Error ? err.message : String(err)}`,
        retryable: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async testConnection(config: Record<string, unknown>): Promise<{ ok: boolean; message: string }> {
    const cfg = config as WahaConfig;
    const baseUrl = typeof cfg.endpointUrl === 'string' && cfg.endpointUrl.trim()
      ? cfg.endpointUrl.trim().replace(/\/+$/, '')
      : null;

    if (!baseUrl) {
      return { ok: false, message: 'URL du serveur WAHA manquante.' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const headers: Record<string, string> = {};
      if (cfg.apiKey?.trim()) {
        headers['X-Api-Key'] = cfg.apiKey.trim();
        headers['Authorization'] = `Bearer ${cfg.apiKey.trim()}`;
      }

      // Check sessions endpoint
      const res = await fetch(`${baseUrl}/api/sessions`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (!res.ok) {
        return { ok: false, message: `Serveur WAHA a répondu avec code HTTP ${res.status}.` };
      }

      const data = await res.json().catch(() => []);
      const sessionName = cfg.session?.trim() || 'default';
      const targetSession = Array.isArray(data)
        ? data.find((s: any) => s.name === sessionName)
        : null;

      if (targetSession) {
        const status = targetSession.status || 'unknown';
        if (status === 'WORKING' || status === 'SCAN_QR_CODE' || status === 'CONNECTED') {
          return { ok: true, message: `WAHA connecté avec succès (Session « ${sessionName} », État: ${status}).` };
        }
        return { ok: true, message: `WAHA joignable. Session « ${sessionName} » à l'état : ${status}.` };
      }

      return { ok: true, message: `Serveur WAHA en ligne et accessible (${Array.isArray(data) ? data.length : 0} session(s)).` };
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      return {
        ok: false,
        message: aborted ? 'Délai d\'attente dépassé (timeout) vers le serveur WAHA.' : `Impossible de joindre le serveur WAHA : ${err instanceof Error ? err.message : String(err)}`,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

registerProvider(new WhatsAppWahaProvider());
