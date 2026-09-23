import { registerProvider, type BroadcastChannel, type BroadcastProvider, type DeliveryTarget, type ProviderSendResult } from './provider';
import { normalizeMoroccanPhone } from '@/libs/sms/moroccan-sms-adapter';

/**
 * Twilio Cloud Communications Adapter (SMS & WhatsApp)
 *
 * Config schema:
 * {
 *   accountSid: string;
 *   authToken: string;
 *   fromNumber: string; // Twilio phone number or alphanumeric Sender ID
 *   timeoutMs?: number;
 * }
 */
export type TwilioConfig = {
  accountSid?: string;
  authToken?: string;
  fromNumber?: string;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 10000;

export class TwilioSmsProvider implements BroadcastProvider {
  readonly provider = 'twilio';
  readonly channels: BroadcastChannel[] = ['sms', 'whatsapp'];

  async send(target: DeliveryTarget): Promise<ProviderSendResult> {
    const cfg = (target.config ?? {}) as TwilioConfig;
    const accountSid = cfg.accountSid?.trim();
    const authToken = cfg.authToken?.trim();
    const fromNumber = cfg.fromNumber?.trim();

    if (!accountSid || !authToken || !fromNumber) {
      return {
        ok: false,
        status: 'failed',
        failureReason: 'missing_twilio_credentials',
        retryable: false,
      };
    }

    const normalizedPhone = normalizeMoroccanPhone(target.to);
    const isWhatsApp = target.channel === 'whatsapp';
    const toFormatted = isWhatsApp && !normalizedPhone.startsWith('whatsapp:')
      ? `whatsapp:${normalizedPhone}`
      : normalizedPhone;
    const fromFormatted = isWhatsApp && !fromNumber.startsWith('whatsapp:')
      ? `whatsapp:${fromNumber}`
      : fromNumber;

    const timeoutMs = typeof cfg.timeoutMs === 'number' && cfg.timeoutMs > 0 ? cfg.timeoutMs : DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const params = new URLSearchParams();
      params.append('To', toFormatted);
      params.append('From', fromFormatted);
      params.append('Body', target.bodyText);

      const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
        signal: controller.signal,
      });

      const responseText = await res.text().catch(() => '');
      const ref = `twilio:${res.status}`;

      if (res.ok) {
        let sid: string | null = null;
        try {
          const parsed = JSON.parse(responseText);
          sid = parsed.sid || null;
        } catch {
          // fallback
        }
        return { ok: true, status: 'sent', providerRef: sid ?? ref };
      }

      let errorMsg = `twilio_http_${res.status}`;
      try {
        const parsed = JSON.parse(responseText);
        if (parsed.message) errorMsg = `twilio_${parsed.code ?? res.status}: ${parsed.message}`;
      } catch {
        errorMsg = `twilio_http_${res.status}: ${responseText.slice(0, 100)}`;
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
        failureReason: aborted ? 'twilio_timeout' : `twilio_error: ${err instanceof Error ? err.message : String(err)}`,
        retryable: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async testConnection(config: Record<string, unknown>): Promise<{ ok: boolean; message: string }> {
    const cfg = config as TwilioConfig;
    const accountSid = cfg.accountSid?.trim();
    const authToken = cfg.authToken?.trim();

    if (!accountSid || !authToken) {
      return { ok: false, message: 'Identifiants Twilio incomplets (Account SID et Auth Token requis).' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}.json`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
        },
        signal: controller.signal,
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const name = data.friendly_name || accountSid;
        return { ok: true, message: `Compte Twilio authentifié avec succès (« ${name} »).` };
      }

      const errText = await res.text().catch(() => '');
      return { ok: false, message: `Échec d'authentification Twilio (Code HTTP ${res.status}): ${errText.slice(0, 100)}` };
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      return {
        ok: false,
        message: aborted ? 'Délai d\'attente dépassé vers Twilio.' : `Erreur Twilio: ${err instanceof Error ? err.message : String(err)}`,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

registerProvider(new TwilioSmsProvider());
