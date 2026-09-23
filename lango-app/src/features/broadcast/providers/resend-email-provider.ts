import { registerProvider, type BroadcastChannel, type BroadcastProvider, type DeliveryTarget, type ProviderSendResult } from './provider';

/**
 * Resend Transactional Email Adapter
 * Generous free tier (3,000 emails/month free).
 *
 * Config schema:
 * {
 *   apiKey: string;      // Resend API Key (re_...)
 *   fromAddress?: string; // Sender email or "SchoolOS <notifications@schoolos.ma>"
 *   timeoutMs?: number;
 * }
 */
export type ResendConfig = {
  apiKey?: string;
  fromAddress?: string;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 10000;

export class ResendEmailProvider implements BroadcastProvider {
  readonly provider = 'resend';
  readonly channels: BroadcastChannel[] = ['email'];

  async send(target: DeliveryTarget): Promise<ProviderSendResult> {
    const cfg = (target.config ?? {}) as ResendConfig;
    const apiKey = cfg.apiKey?.trim();

    if (!apiKey) {
      return {
        ok: false,
        status: 'failed',
        failureReason: 'missing_resend_api_key',
        retryable: false,
      };
    }

    const from = cfg.fromAddress?.trim() || 'SchoolOS <notifications@resend.dev>';
    const timeoutMs = typeof cfg.timeoutMs === 'number' && cfg.timeoutMs > 0 ? cfg.timeoutMs : DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const payload: Record<string, unknown> = {
        from,
        to: [target.to],
        subject: target.subject?.trim() || 'Notification SchoolOS',
        text: target.bodyText,
      };
      if (target.bodyHtml?.trim()) {
        payload.html = target.bodyHtml.trim();
      }

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const responseText = await res.text().catch(() => '');
      const ref = `resend:${res.status}`;

      if (res.ok) {
        let emailId: string | null = null;
        try {
          const parsed = JSON.parse(responseText);
          emailId = parsed.id || null;
        } catch {
          // fallback
        }
        return { ok: true, status: 'delivered', providerRef: emailId ?? ref };
      }

      let errorMsg = `resend_http_${res.status}`;
      try {
        const parsed = JSON.parse(responseText);
        if (parsed.message) errorMsg = `resend_error: ${parsed.message}`;
      } catch {
        errorMsg = `resend_http_${res.status}: ${responseText.slice(0, 100)}`;
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
        failureReason: aborted ? 'resend_timeout' : `resend_error: ${err instanceof Error ? err.message : String(err)}`,
        retryable: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async testConnection(config: Record<string, unknown>): Promise<{ ok: boolean; message: string }> {
    const cfg = config as ResendConfig;
    const apiKey = cfg.apiKey?.trim();

    if (!apiKey) {
      return { ok: false, message: 'Clé d\'API Resend manquante.' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch('https://api.resend.com/api-keys', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      });

      if (res.ok) {
        return { ok: true, message: 'Compte Resend authentifié avec succès. Service prêt pour l\'envoi d\'emails.' };
      }

      const errText = await res.text().catch(() => '');
      return { ok: false, message: `Échec d'authentification Resend (Code HTTP ${res.status}): ${errText.slice(0, 100)}` };
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      return {
        ok: false,
        message: aborted ? 'Délai d\'attente dépassé vers Resend.' : `Erreur Resend: ${err instanceof Error ? err.message : String(err)}`,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

registerProvider(new ResendEmailProvider());
