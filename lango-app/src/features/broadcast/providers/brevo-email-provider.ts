import { registerProvider, type BroadcastChannel, type BroadcastProvider, type DeliveryTarget, type ProviderSendResult } from './provider';

/**
 * Brevo (formerly Sendinblue) Transactional Email Adapter
 * Generous free tier (300 emails/day free).
 *
 * Config schema:
 * {
 *   apiKey: string;       // Brevo API Key (xkeysib-...)
 *   fromAddress?: string; // Sender email
 *   fromName?: string;    // Sender display name
 *   timeoutMs?: number;
 * }
 */
export type BrevoConfig = {
  apiKey?: string;
  fromAddress?: string;
  fromName?: string;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 10000;

export class BrevoEmailProvider implements BroadcastProvider {
  readonly provider = 'brevo';
  readonly channels: BroadcastChannel[] = ['email'];

  async send(target: DeliveryTarget): Promise<ProviderSendResult> {
    const cfg = (target.config ?? {}) as BrevoConfig;
    const apiKey = cfg.apiKey?.trim();

    if (!apiKey) {
      return {
        ok: false,
        status: 'failed',
        failureReason: 'missing_brevo_api_key',
        retryable: false,
      };
    }

    const fromAddress = cfg.fromAddress?.trim() || 'contact@schoolos.ma';
    const fromName = cfg.fromName?.trim() || 'SchoolOS';
    const timeoutMs = typeof cfg.timeoutMs === 'number' && cfg.timeoutMs > 0 ? cfg.timeoutMs : DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const payload: Record<string, unknown> = {
        sender: { name: fromName, email: fromAddress },
        to: [{ email: target.to }],
        subject: target.subject?.trim() || 'Notification SchoolOS',
        textContent: target.bodyText,
      };
      if (target.bodyHtml?.trim()) {
        payload.htmlContent = target.bodyHtml.trim();
      }

      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const responseText = await res.text().catch(() => '');
      const ref = `brevo:${res.status}`;

      if (res.ok) {
        let messageId: string | null = null;
        try {
          const parsed = JSON.parse(responseText);
          messageId = parsed.messageId || null;
        } catch {
          // fallback
        }
        return { ok: true, status: 'delivered', providerRef: messageId ?? ref };
      }

      let errorMsg = `brevo_http_${res.status}`;
      try {
        const parsed = JSON.parse(responseText);
        if (parsed.message) errorMsg = `brevo_error: ${parsed.message}`;
      } catch {
        errorMsg = `brevo_http_${res.status}: ${responseText.slice(0, 100)}`;
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
        failureReason: aborted ? 'brevo_timeout' : `brevo_error: ${err instanceof Error ? err.message : String(err)}`,
        retryable: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async testConnection(config: Record<string, unknown>): Promise<{ ok: boolean; message: string }> {
    const cfg = config as BrevoConfig;
    const apiKey = cfg.apiKey?.trim();

    if (!apiKey) {
      return { ok: false, message: 'Clé d\'API Brevo manquante.' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch('https://api.brevo.com/v3/account', {
        method: 'GET',
        headers: {
          'api-key': apiKey,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const email = data.email || 'compte vérifié';
        return { ok: true, message: `Compte Brevo authentifié avec succès (${email}). Prêt pour l'envoi d'emails.` };
      }

      const errText = await res.text().catch(() => '');
      return { ok: false, message: `Échec d'authentification Brevo (Code HTTP ${res.status}): ${errText.slice(0, 100)}` };
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      return {
        ok: false,
        message: aborted ? 'Délai d\'attente dépassé vers Brevo.' : `Erreur Brevo: ${err instanceof Error ? err.message : String(err)}`,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

registerProvider(new BrevoEmailProvider());
